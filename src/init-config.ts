import { access, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

import { initializeConfigFile } from "./core/auto-config.ts";
import { DEFAULT_CONFIG } from "./core/config.ts";

async function main(): Promise<void> {
	const rootDirectory = cwd();
	const configPath = resolve(rootDirectory, "monitor.config.json");
	const force = process.argv.includes("--force");

	if (force) {
		await rm(configPath, { force: true });
	}

	try {
		await access(configPath, constants.F_OK);
		const raw = await readFile(configPath, "utf8");
		const parsed = JSON.parse(raw) as { trackedApps?: unknown[] };
		const trackedApps = Array.isArray(parsed.trackedApps) ? parsed.trackedApps.length : 0;
		console.log(JSON.stringify({ configPath, existed: true, trackedApps }, null, 2));
		return;
	} catch {
		const config = await initializeConfigFile(rootDirectory, DEFAULT_CONFIG);
		console.log(JSON.stringify({ configPath, existed: false, trackedApps: config.trackedApps.length }, null, 2));
	}
}

void main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
