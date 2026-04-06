import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runCommand } from "./command.ts";
import { discoverAppBundles } from "./discovery.ts";
import { loadSourceAudit, matchAuditFindingForBundle } from "./source-audit.ts";
import type { AppBundleRecord, MonitorAppConfig, MonitorConfig, SourceAuditFinding } from "./types.ts";
import { expandHomeDirectory } from "./utils.ts";

export async function initializeConfigFile(
	rootDirectory: string,
	template: MonitorConfig,
): Promise<MonitorConfig> {
	const appLocations = template.appLocations.map(expandHomeDirectory);
	const trackedApps = await buildAutoTrackedApps(rootDirectory, appLocations);
	const configPath = resolve(rootDirectory, "monitor.config.json");
	const fileContent = {
		...template,
		trackedApps,
	};

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(fileContent, null, 2)}\n`, "utf8");

	console.log(
		`Created ${configPath} with ${trackedApps.length} auto-discovered tracked app${trackedApps.length === 1 ? "" : "s"}.`,
	);

	return {
		...fileContent,
		appLocations,
	};
}

export async function buildAutoTrackedApps(
	rootDirectory: string,
	appLocations: string[],
): Promise<MonitorAppConfig[]> {
	const [appBundles, auditFindings] = await Promise.all([
		discoverAppBundles(appLocations),
		loadSourceAudit(rootDirectory),
	]);
	const trackedApps: MonitorAppConfig[] = [];
	const seenKeys = new Set<string>();

	for (const bundle of appBundles) {
		const info = await readInfoPlistJson(bundle.path);
		const feedUrl = stringValue(info?.SUFeedURL);

		if (!feedUrl) {
			continue;
		}

		const auditFinding = matchAuditFindingForBundle(bundle, auditFindings);
		const trackedApp = createTrackedApp(bundle, feedUrl, auditFinding);
		const keys = identityKeys(trackedApp);

		if (keys.some((key) => seenKeys.has(key))) {
			continue;
		}

		trackedApps.push(trackedApp);
		for (const key of keys) {
			seenKeys.add(key);
		}
	}

	return trackedApps.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function createTrackedApp(
	bundle: AppBundleRecord,
	feedUrl: string,
	auditFinding: SourceAuditFinding | null,
): MonitorAppConfig {
	const tags = ["auto-generated", "sparkle"];
	if (auditFinding) {
		tags.push("third-party");
	}

	return {
		id: `auto-appcast-${slugify(bundle.bundleId ?? bundle.name)}`,
		displayName: bundle.name,
		installed: {
			kind: "appBundle",
			path: bundle.path,
			bundleId: bundle.bundleId ?? undefined,
			appName: bundle.name,
		},
		source: {
			kind: "sparkleAppcast",
			url: feedUrl,
		},
		maintenance: auditFinding
			? {
					activationSource: "thirdPartyActivated",
					upgradePolicy: "hold",
					reason: `Detected third-party markers: ${auditFinding.markers.join(", ")}`,
				}
			: undefined,
		tags,
	};
}

async function readInfoPlistJson(appPath: string): Promise<Record<string, unknown> | null> {
	const result = await runCommand("plutil", ["-convert", "json", "-o", "-", `${appPath}/Contents/Info.plist`], {
		timeoutMs: 8_000,
	});

	if (!result.ok) {
		return null;
	}

	try {
		return JSON.parse(result.stdout) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function identityKeys(app: MonitorAppConfig): string[] {
	const keys = [`display:${normalize(app.displayName)}`];

	if (app.installed.kind === "appBundle") {
		if (app.installed.path) {
			keys.push(`path:${app.installed.path}`);
		}
		if (app.installed.bundleId) {
			keys.push(`bundle:${app.installed.bundleId}`);
		}
	}

	if (app.source.kind === "sparkleAppcast") {
		keys.push(`feed:${app.source.url}`);
	}

	return keys;
}

function normalize(input: string): string {
	return input.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.replaceAll(/--+/g, "-");
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}
