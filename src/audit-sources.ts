import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { runCommand } from "./core/command.ts";
import { discoverAppBundles } from "./core/discovery.ts";
import type { SourceAuditEvidence, SourceAuditFinding, SourceAuditMarker } from "./core/types.ts";

type Confidence = "high" | "medium";
type EvidenceKind = SourceAuditEvidence["kind"];
type MarkerId = SourceAuditMarker;

interface MarkerDefinition {
	id: MarkerId;
	patterns: RegExp[];
	domains: string[];
	pathPatterns?: RegExp[];
}

const MARKERS: MarkerDefinition[] = [
	{
		id: "macked",
		patterns: [/macked/i],
		domains: ["macked.app"],
	},
	{
		id: "tnt",
		patterns: [/(^|[^a-z])tnt([^a-z]|$)/i, /team\s*tnt/i],
		domains: ["team tnt", "tnt"],
		pathPatterns: [/^(?:lib)?tnt(?:[._-]|$)/i, /^team[-_\s]?tnt/i],
	},
	{
		id: "macwk",
		patterns: [/macwk/i],
		domains: ["macwk", "macwk.com"],
	},
	{
		id: "appstorrent",
		patterns: [/appstorrent/i, /apps[-\s]?torrent/i],
		domains: ["appstorrent.ru", "appstorrent"],
	},
	{
		id: "qiuchenly",
		patterns: [/qiuchenly/i, /qiu\s*chenly/i],
		domains: ["qiuchenly", "qiuchenlyopensource"],
	},
];

async function main(): Promise<void> {
	const locations = ["/Applications", join(homedir(), "Applications")];
	const appBundles = await discoverAppBundles(locations);
	const findings: SourceAuditFinding[] = [];

	for (const bundle of appBundles) {
		const evidence = await inspectBundle(bundle.path);

		if (!evidence.length) {
			continue;
		}

		findings.push({
			name: bundle.name,
			path: bundle.path,
			bundleId: bundle.bundleId,
			version: bundle.version,
			confidence: classifyConfidence(evidence),
			markers: uniqueMarkers(evidence),
			evidence,
		});
	}

	findings.sort((left, right) => {
		if (left.confidence !== right.confidence) {
			return left.confidence === "high" ? -1 : 1;
		}

		return left.name.localeCompare(right.name);
	});

	if (process.argv.includes("--save")) {
		const outputPath = resolve(process.cwd(), "data", "source-audit.json");
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, `${JSON.stringify(findings, null, 2)}\n`, "utf8");
		console.log(`Saved ${findings.length} findings to ${outputPath}`);
		return;
	}

	console.log(JSON.stringify(findings, null, 2));
}

async function inspectBundle(appPath: string): Promise<SourceAuditEvidence[]> {
	const pathEvidence = await collectPathEvidence(appPath);
	const receiptEvidence = await collectReceiptEvidence(appPath);
	const downloadSourceEvidence = await collectWhereFromsEvidence(appPath);
	const linkedLibraryEvidence =
		pathEvidence.length > 0 || receiptEvidence.length > 0
			? await collectLinkedLibraryEvidence(appPath)
			: [];

	return dedupeEvidence([
		...pathEvidence,
		...receiptEvidence,
		...linkedLibraryEvidence,
		...downloadSourceEvidence,
	]);
}

async function collectPathEvidence(appPath: string): Promise<SourceAuditEvidence[]> {
	const contentsPath = join(appPath, "Contents");
	const hits = await walkForMarkers(contentsPath, contentsPath, 4);

	return hits.map((hit) => ({
		kind: "bundle-path",
		marker: hit.marker,
		value: hit.path,
	}));
}

async function walkForMarkers(
	rootPath: string,
	currentPath: string,
	depth: number,
): Promise<Array<{ marker: MarkerId; path: string }>> {
	if (depth < 0) {
		return [];
	}

	let entries;
	try {
		entries = await readdir(currentPath, { withFileTypes: true });
	} catch {
		return [];
	}

	const hits: Array<{ marker: MarkerId; path: string }> = [];

	for (const entry of entries) {
		const entryPath = join(currentPath, entry.name);
		const relativePath = relative(rootPath, entryPath) || entry.name;

		for (const marker of MARKERS) {
			const pathPatterns = marker.pathPatterns ?? marker.patterns;
			if (pathPatterns.some((pattern) => pattern.test(entry.name))) {
				hits.push({
					marker: marker.id,
					path: relativePath,
				});
			}
		}

		if (entry.isDirectory()) {
			hits.push(...(await walkForMarkers(rootPath, entryPath, depth - 1)));
		}
	}

	return hits;
}

async function collectReceiptEvidence(appPath: string): Promise<SourceAuditEvidence[]> {
	const receiptPath = join(appPath, "Contents", "_MASReceipt", "receipt");

	try {
		await access(receiptPath, constants.F_OK);
	} catch {
		return [];
	}

	const buffer = await readFile(receiptPath);
	const haystack = extractPrintable(buffer);

	return collectTextMarkers(haystack, "receipt");
}

async function collectWhereFromsEvidence(appPath: string): Promise<SourceAuditEvidence[]> {
	const result = await runCommand("mdls", ["-raw", "-name", "kMDItemWhereFroms", appPath], {
		timeoutMs: 8_000,
	});

	if (!result.ok || !result.stdout || result.stdout.includes("(null)")) {
		return [];
	}

	return collectTextMarkers(result.stdout, "download-source");
}

async function collectLinkedLibraryEvidence(appPath: string): Promise<SourceAuditEvidence[]> {
	const executablePath = await resolveExecutablePath(appPath);

	if (!executablePath) {
		return [];
	}

	const result = await runCommand("otool", ["-L", executablePath], {
		timeoutMs: 12_000,
	});

	if (!result.ok) {
		return [];
	}

	return collectTextMarkers(result.stdout, "linked-library");
}

async function resolveExecutablePath(appPath: string): Promise<string | null> {
	const infoPath = join(appPath, "Contents", "Info.plist");
	const result = await runCommand("plutil", ["-convert", "json", "-o", "-", infoPath], {
		timeoutMs: 8_000,
	});

	if (!result.ok) {
		return null;
	}

	try {
		const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
		const executable = typeof parsed.CFBundleExecutable === "string" ? parsed.CFBundleExecutable : null;

		return executable ? join(appPath, "Contents", "MacOS", executable) : null;
	} catch {
		return null;
	}
}

function collectTextMarkers(input: string, kind: EvidenceKind): SourceAuditEvidence[] {
	const compact = input.replaceAll(/\s+/g, " ");
	const hits: SourceAuditEvidence[] = [];

	for (const marker of MARKERS) {
		const matchedPattern = marker.patterns.find((pattern) => pattern.test(compact));
		const matchedDomain = marker.domains.find((domain) => compact.toLowerCase().includes(domain.toLowerCase()));
		const value = matchedDomain ?? matchedPattern?.source;

		if (!value) {
			continue;
		}

		hits.push({
			kind,
			marker: marker.id,
			value: snippetAround(compact, matchedDomain ?? marker.id),
		});
	}

	return hits;
}

function extractPrintable(buffer: Buffer): string {
	return buffer
		.toString("latin1")
		.replaceAll(/[^\x20-\x7E]+/g, " ")
		.trim();
}

function snippetAround(input: string, token: string, size = 140): string {
	const index = input.toLowerCase().indexOf(token.toLowerCase());

	if (index < 0) {
		return truncate(input, size * 2);
	}

	const start = Math.max(0, index - size);
	const end = Math.min(input.length, index + token.length + size);

	return truncate(input.slice(start, end).trim(), size * 2);
}

function truncate(input: string, maxLength: number): string {
	if (input.length <= maxLength) {
		return input;
	}

	return `${input.slice(0, maxLength - 1)}…`;
}

function dedupeEvidence(evidence: SourceAuditEvidence[]): SourceAuditEvidence[] {
	const seen = new Set<string>();
	return evidence.filter((entry) => {
		const key = `${entry.kind}:${entry.marker}:${entry.value}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function uniqueMarkers(evidence: SourceAuditEvidence[]): MarkerId[] {
	return [...new Set(evidence.map((item) => item.marker))];
}

function classifyConfidence(evidence: SourceAuditEvidence[]): Confidence {
	if (
		evidence.some((entry) =>
			entry.kind === "receipt" || entry.kind === "linked-library" || /dylib|framework/i.test(entry.value),
		)
	) {
		return "high";
	}

	return "medium";
}

void main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
