import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { SourceAuditFinding, TrackedAppCandidate } from "./core/types.ts";

async function main(): Promise<void> {
	const rootDirectory = process.cwd();
	const auditPath = resolve(rootDirectory, "data", "source-audit.json");
	const audit = JSON.parse(await readFile(auditPath, "utf8")) as SourceAuditFinding[];
	const candidates = await buildCandidates(audit);

	const dataPath = resolve(rootDirectory, "data", "tracked-app-candidates.json");
	const reportPath = resolve(rootDirectory, "reports", "tracked-app-candidates.md");

	await Promise.all([
		writeJson(dataPath, candidates),
		writeText(reportPath, buildMarkdown(candidates)),
	]);

	console.log(`Saved ${candidates.length} tracked candidates to ${dataPath}`);
	console.log(`Saved report to ${reportPath}`);
}

async function buildCandidates(audit: SourceAuditFinding[]): Promise<TrackedAppCandidate[]> {
	const candidates: TrackedAppCandidate[] = [];

	for (const finding of audit) {
		const info = await readInfoPlistJson(finding.path);
		const feedUrl = typeof info?.SUFeedURL === "string" ? info.SUFeedURL.trim() : "";

		if (!feedUrl) {
			continue;
		}

		candidates.push({
			config: {
				id: `auto-thirdparty-${slugify(finding.name)}`,
				displayName: finding.name,
				installed: {
					kind: "appBundle",
					path: finding.path,
				},
				source: {
					kind: "sparkleAppcast",
					url: feedUrl,
				},
				maintenance: {
					activationSource: "thirdPartyActivated",
					upgradePolicy: "hold",
					reason: `Detected third-party markers: ${finding.markers.join(", ")}`,
				},
				tags: ["auto-candidate", "third-party", "sparkle"],
			},
			confidence: finding.confidence,
			detectedFrom: "SUFeedURL",
			path: finding.path,
			bundleId: finding.bundleId,
			version: finding.version,
			markers: finding.markers,
		});
	}

	return candidates.sort((left, right) => left.config.displayName.localeCompare(right.config.displayName));
}

async function readInfoPlistJson(appPath: string): Promise<Record<string, unknown> | null> {
	try {
		const { execFileSync } = await import("node:child_process");
		const output = execFileSync("plutil", ["-convert", "json", "-o", "-", `${appPath}/Contents/Info.plist`], {
			encoding: "utf8",
		});
		return JSON.parse(output) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function buildMarkdown(candidates: TrackedAppCandidate[]): string {
	const generatedAt = new Date().toISOString();
	const rows = candidates.length
		? candidates
				.map(
					(candidate) =>
						`| ${escapeCell(candidate.config.displayName)} | ${escapeCell(candidate.version ?? "-")} | ${escapeCell(candidate.markers.join(", "))} | sparkleAppcast | ${escapeCell(candidate.config.source.kind === "sparkleAppcast" ? candidate.config.source.url : "-")} |`,
				)
				.join("\n")
		: "| None | - | - | - | - |";

	return `# Tracked App Candidates

Generated at: ${generatedAt}

这些候选项来自本机第三方软件审计结果，并且能从 App 包内部直接提取出更新源，因此可以优先接入主监控表。

- Total candidates: ${candidates.length}
- Detection rule: embedded \`SUFeedURL\` in local app bundle
- Default maintenance policy: \`thirdPartyActivated + hold\`

| App | Local Version | Marker | Source Type | Feed URL |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.replaceAll(/--+/g, "-");
}

function escapeCell(value: string): string {
	return value.replaceAll("|", "\\|");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${value}\n`, "utf8");
}

void main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
