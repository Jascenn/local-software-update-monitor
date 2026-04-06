import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { initializeConfigFile } from "./auto-config.ts";
import type { MonitorConfig, MonitorAppConfig } from "./types.ts";
import { expandHomeDirectory } from "./utils.ts";

export const DEFAULT_CONFIG: MonitorConfig = {
	port: 4123,
	pollIntervalMs: 30 * 60 * 1000,
	appLocations: ["/Applications", "~/Applications"],
	trackedApps: [],
};

export async function loadConfig(rootDirectory: string): Promise<MonitorConfig> {
	const configPath = resolve(rootDirectory, "monitor.config.json");

	try {
		await access(configPath, constants.F_OK);
	} catch {
		return await initializeConfigFile(rootDirectory, DEFAULT_CONFIG);
	}

	const raw = await readFile(configPath, "utf8");
	const parsed = JSON.parse(raw) as Partial<MonitorConfig>;
	const trackedApps = Array.isArray(parsed.trackedApps) ? parsed.trackedApps : DEFAULT_CONFIG.trackedApps;

	return {
		port: parsed.port ?? DEFAULT_CONFIG.port,
		pollIntervalMs: parsed.pollIntervalMs ?? DEFAULT_CONFIG.pollIntervalMs,
		appLocations: (parsed.appLocations ?? DEFAULT_CONFIG.appLocations).map(expandHomeDirectory),
		trackedApps: validateTrackedApps(trackedApps),
	};
}

function validateTrackedApps(trackedApps: unknown[]): MonitorAppConfig[] {
	return trackedApps.filter(isTrackedApp);
}

function isTrackedApp(value: unknown): value is MonitorAppConfig {
	if (!value || typeof value !== "object") {
		return false;
	}

	const entry = value as Record<string, unknown>;
	return typeof entry.id === "string" && typeof entry.displayName === "string";
}
