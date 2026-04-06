import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { Snapshot, StoredHistory } from "../core/types.ts";

const HISTORY_LIMIT = 50;

export function getDataPaths(rootDirectory: string): {
	latestPath: string;
	historyPath: string;
} {
	return {
		latestPath: resolve(rootDirectory, "data", "latest.json"),
		historyPath: resolve(rootDirectory, "data", "history.json"),
	};
}

export async function loadState(rootDirectory: string): Promise<StoredHistory> {
	const { latestPath, historyPath } = getDataPaths(rootDirectory);

	const [latest, history] = await Promise.all([
		readJsonFile<Snapshot | null>(latestPath, null),
		readJsonFile<Snapshot[]>(historyPath, []),
	]);

	return {
		latest,
		history,
	};
}

export async function saveSnapshot(rootDirectory: string, snapshot: Snapshot): Promise<StoredHistory> {
	const { latestPath, historyPath } = getDataPaths(rootDirectory);
	const currentHistory = await readJsonFile<Snapshot[]>(historyPath, []);
	const nextHistory = [snapshot, ...currentHistory].slice(0, HISTORY_LIMIT);

	await Promise.all([
		writeJsonFile(latestPath, snapshot),
		writeJsonFile(historyPath, nextHistory),
	]);

	return {
		latest: snapshot,
		history: nextHistory,
	};
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
