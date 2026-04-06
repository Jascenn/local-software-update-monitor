import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { SourceAuditFinding, SourceAuditMarker, ThirdPartyPolicyEntry } from "./core/types.ts";

async function main(): Promise<void> {
	const rootDirectory = process.cwd();
	const auditPath = resolve(rootDirectory, "data", "source-audit.json");
	const audit = JSON.parse(await readFile(auditPath, "utf8")) as SourceAuditFinding[];
	const policy = buildPolicy(audit);
	const markdown = buildMarkdownReport(audit, policy);

	const policyPath = resolve(rootDirectory, "data", "third-party-policy.json");
	const reportPath = resolve(rootDirectory, "reports", "third-party-audit.md");

	await Promise.all([
		writeJson(policyPath, policy),
		writeText(reportPath, markdown),
	]);

	console.log(`Saved ${policy.length} policy entries to ${policyPath}`);
	console.log(`Saved report to ${reportPath}`);
}

function buildPolicy(audit: SourceAuditFinding[]): ThirdPartyPolicyEntry[] {
	return audit.map((finding) => ({
		name: finding.name,
		path: finding.path,
		bundleId: finding.bundleId,
		version: finding.version,
		confidence: finding.confidence,
		markers: finding.markers,
		activationSource: "thirdPartyActivated",
		upgradePolicy: "hold",
		reason: `Detected third-party markers: ${finding.markers.join(", ")}`,
		recommendation: "Treat as third-party activated software. Do not auto-upgrade; verify activation, patch, and compatibility first.",
	}));
}

function buildMarkdownReport(audit: SourceAuditFinding[], policy: ThirdPartyPolicyEntry[]): string {
	const generatedAt = new Date().toISOString();
	const counts = countMarkers(audit);
	const highConfidence = policy.filter((entry) => entry.confidence === "high");
	const mediumConfidence = policy.filter((entry) => entry.confidence === "medium");
	const markerLines = formatMarkerLines(counts);
	const highRows = formatRows(highConfidence);
	const mediumRows = formatRows(mediumConfidence);

	return `# Third-Party Software Audit

Generated at: ${generatedAt}

## Summary

- Total flagged apps: ${policy.length}
- High confidence: ${highConfidence.length}
- Medium confidence: ${mediumConfidence.length}

## Marker Counts

${markerLines}

## Recommended Default Policy

- Activation source: \`thirdPartyActivated\`
- Upgrade policy: \`hold\`
- Recommendation: do not auto-upgrade these apps; confirm activation, patch compatibility, and rollback options first

## High-Confidence Findings

| App | Version | Marker | Policy | Path |
| --- | --- | --- | --- | --- |
${highRows}

## Medium-Confidence Findings

| App | Version | Marker | Policy | Path |
| --- | --- | --- | --- | --- |
${mediumRows}
`;
}

function countMarkers(audit: SourceAuditFinding[]): Record<SourceAuditMarker, number> {
	const counts = {
		macked: 0,
		tnt: 0,
		macwk: 0,
		appstorrent: 0,
		qiuchenly: 0,
	} satisfies Record<SourceAuditMarker, number>;

	for (const finding of audit) {
		for (const marker of finding.markers) {
			counts[marker] += 1;
		}
	}

	return counts;
}

function formatMarkerLines(counts: Record<SourceAuditMarker, number>): string {
	const entries = Object.entries(counts).filter(([, count]) => count > 0);

	if (!entries.length) {
		return "- No known third-party markers found";
	}

	return entries.map(([marker, count]) => `- ${marker}: ${count}`).join("\n");
}

function formatRows(entries: ThirdPartyPolicyEntry[]): string {
	if (!entries.length) {
		return "| None | - | - | - | - |";
	}

	return entries
		.map(
			(entry) =>
				`| ${escapeCell(entry.name)} | ${escapeCell(entry.version ?? "-")} | ${escapeCell(entry.markers.join(", "))} | ${entry.upgradePolicy} | ${escapeCell(entry.path)} |`,
		)
		.join("\n");
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
