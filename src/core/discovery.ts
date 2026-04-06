import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type {
	AppBundleRecord,
	BrewPackageRecord,
	BrewPackageType,
	Inventory,
	MasAppRecord,
	MonitorConfig,
} from "./types.ts";
import { runCommand } from "./command.ts";

const BREW_ENV = {
	HOMEBREW_NO_AUTO_UPDATE: "1",
	HOMEBREW_NO_INSTALL_CLEANUP: "1",
	HOMEBREW_CACHE: "/tmp/homebrew-cache",
};

export async function discoverInventory(config: MonitorConfig): Promise<Inventory> {
	const [brewPackages, masApps, appBundles] = await Promise.all([
		discoverBrewPackages(),
		discoverMasApps(),
		discoverAppBundles(config.appLocations),
	]);

	return {
		brewPackages,
		masApps,
		appBundles,
	};
}

export async function discoverBrewPackages(): Promise<BrewPackageRecord[]> {
	const [formulaeResult, casksResult] = await Promise.all([
		runCommand("brew", ["list", "--formula", "--versions"], {
			timeoutMs: 15_000,
			env: BREW_ENV,
		}),
		runCommand("brew", ["list", "--cask", "--versions"], {
			timeoutMs: 15_000,
			env: BREW_ENV,
		}),
	]);

	return [
		...parseBrewList(formulaeResult.stdout, "formula"),
		...parseBrewList(casksResult.stdout, "cask"),
	].sort((left, right) => left.name.localeCompare(right.name));
}

function parseBrewList(output: string, packageType: BrewPackageType): BrewPackageRecord[] {
	return output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [name, ...versions] = line.split(/\s+/);
			return {
				name,
				packageType,
				installedVersion: versions.join(" ") || null,
			};
		});
}

export async function discoverMasApps(): Promise<MasAppRecord[]> {
	const result = await runCommand("mas", ["list"], {
		timeoutMs: 20_000,
	});

	if (!result.ok) {
		return [];
	}

	return result.stdout
		.split("\n")
		.map(parseMasListLine)
		.filter((entry): entry is MasAppRecord => entry !== null)
		.sort((left, right) => left.name.localeCompare(right.name));
}

function parseMasListLine(line: string): MasAppRecord | null {
	const match = line.trim().match(/^(\d+)\s+(.+?)\s+\(([^)]+)\)$/);

	if (!match) {
		return null;
	}

	return {
		appId: Number(match[1]),
		name: match[2],
		installedVersion: match[3] || null,
	};
}

export async function discoverAppBundles(appLocations: string[]): Promise<AppBundleRecord[]> {
	const seenPaths = new Set<string>();
	const bundles: AppBundleRecord[] = [];

	for (const location of appLocations) {
		const discovered = await walkApplicationBundles(location, 2);
		for (const bundle of discovered) {
			if (seenPaths.has(bundle.path)) {
				continue;
			}
			seenPaths.add(bundle.path);
			bundles.push(bundle);
		}
	}

	return bundles.sort((left, right) => left.name.localeCompare(right.name));
}

async function walkApplicationBundles(rootPath: string, maxDepth: number): Promise<AppBundleRecord[]> {
	if (maxDepth < 0) {
		return [];
	}

	let entries;
	try {
		entries = await readdir(rootPath, { withFileTypes: true });
	} catch {
		return [];
	}

	const bundles: AppBundleRecord[] = [];

	for (const entry of entries) {
		if (entry.name.startsWith(".")) {
			continue;
		}

		const fullPath = join(rootPath, entry.name);

		if (entry.isDirectory() && entry.name.endsWith(".app")) {
			const bundle = await readAppBundle(fullPath);
			if (bundle) {
				bundles.push(bundle);
			}
			continue;
		}

		if (entry.isDirectory() && maxDepth > 0) {
			bundles.push(...(await walkApplicationBundles(fullPath, maxDepth - 1)));
		}
	}

	return bundles;
}

export async function readAppBundle(appPath: string): Promise<AppBundleRecord | null> {
	const infoPath = join(appPath, "Contents", "Info.plist");
	const [result, bundleStat] = await Promise.all([
		runCommand("plutil", ["-convert", "json", "-o", "-", infoPath], {
			timeoutMs: 10_000,
		}),
		stat(appPath).catch(() => null),
	]);

	if (!result.ok) {
		return null;
	}

	try {
		const info = JSON.parse(result.stdout) as Record<string, unknown>;
		const name =
			stringValue(info.CFBundleDisplayName) ??
			stringValue(info.CFBundleName) ??
			appPath.split("/").pop()?.replace(/\.app$/, "") ??
			appPath;

		return {
			name,
			path: appPath,
			bundleId: stringValue(info.CFBundleIdentifier),
			version: stringValue(info.CFBundleShortVersionString) ?? stringValue(info.CFBundleVersion),
			lastActivityAt: normalizeActivityDate(bundleStat),
		};
	} catch {
		return null;
	}
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeActivityDate(bundleStat: Awaited<ReturnType<typeof stat>> | null): string | null {
	if (!bundleStat) {
		return null;
	}

	const activityAt = bundleStat.atime instanceof Date && Number.isFinite(bundleStat.atime.getTime())
		? bundleStat.atime
		: bundleStat.mtime instanceof Date && Number.isFinite(bundleStat.mtime.getTime())
			? bundleStat.mtime
			: null;

	return activityAt ? activityAt.toISOString() : null;
}

export function buildBundleIndexes(appBundles: AppBundleRecord[]): {
	byBundleId: Map<string, AppBundleRecord>;
	byName: Map<string, AppBundleRecord>;
} {
	const byBundleId = new Map<string, AppBundleRecord>();
	const byName = new Map<string, AppBundleRecord>();

	for (const bundle of appBundles) {
		if (bundle.bundleId) {
			byBundleId.set(bundle.bundleId, bundle);
		}
		byName.set(bundle.name.toLowerCase(), bundle);
	}

	return { byBundleId, byName };
}
