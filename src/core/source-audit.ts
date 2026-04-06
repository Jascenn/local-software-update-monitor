import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { AppBundleRecord, SourceAuditFinding } from "./types.ts";

export async function loadSourceAudit(rootDirectory: string): Promise<SourceAuditFinding[]> {
	const filePath = resolve(rootDirectory, "data", "source-audit.json");

	try {
		const raw = await readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as SourceAuditFinding[]) : [];
	} catch {
		return [];
	}
}

export function matchAuditFindingForBundle(
	bundle: AppBundleRecord | null | undefined,
	findings: SourceAuditFinding[],
): SourceAuditFinding | null {
	if (!bundle) {
		return null;
	}

	return (
		findings.find((finding) => finding.path === bundle.path) ??
		findings.find((finding) => !!bundle.bundleId && finding.bundleId === bundle.bundleId) ??
		null
	);
}
