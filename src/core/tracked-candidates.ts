import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { MonitorAppConfig, TrackedAppCandidate } from "./types.ts";

export async function loadTrackedAppCandidates(rootDirectory: string): Promise<TrackedAppCandidate[]> {
	const filePath = resolve(rootDirectory, "data", "tracked-app-candidates.json");

	try {
		const raw = await readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as TrackedAppCandidate[]) : [];
	} catch {
		return [];
	}
}

export function candidateConfigs(candidates: TrackedAppCandidate[]): MonitorAppConfig[] {
	return candidates.map((candidate) => candidate.config);
}
