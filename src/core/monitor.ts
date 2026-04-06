import { buildBundleIndexes, discoverInventory, readAppBundle } from "./discovery.ts";
import { runCommand } from "./command.ts";
import { loadSourceAudit, matchAuditFindingForBundle } from "./source-audit.ts";
import { findBestBundleForName, loadThirdPartyPolicy, matchPolicyForBundle, matchPolicyForName } from "./source-policy.ts";
import { candidateConfigs, loadTrackedAppCandidates } from "./tracked-candidates.ts";
import { fetchLatestVersion } from "../sources/latest.ts";
import type {
	ActivationSource,
	AppBundleRecord,
	AppStatus,
	Inventory,
	MonitorConfig,
	MonitorAppConfig,
	RemoteVersionResult,
	Snapshot,
	SnapshotSummary,
	StatusLevel,
	SourceAuditFinding,
	ThirdPartyPolicyEntry,
	UpgradePolicyLevel,
} from "./types.ts";
import { isRemoteNewer, nowIso } from "./utils.ts";

const BREW_ENV = {
	HOMEBREW_NO_AUTO_UPDATE: "1",
	HOMEBREW_NO_INSTALL_CLEANUP: "1",
	HOMEBREW_CACHE: "/tmp/homebrew-cache",
};

export async function createSnapshot(
	config: MonitorConfig,
	options?: {
		rootDirectory?: string;
	},
): Promise<Snapshot> {
	const [inventory, sourceAudit, sourcePolicy, trackedCandidates] = await Promise.all([
		discoverInventory(config),
		options?.rootDirectory ? loadSourceAudit(options.rootDirectory) : Promise.resolve([]),
		options?.rootDirectory ? loadThirdPartyPolicy(options.rootDirectory) : Promise.resolve([]),
		options?.rootDirectory ? loadTrackedAppCandidates(options.rootDirectory) : Promise.resolve([]),
	]);
	const mergedTrackedApps = mergeTrackedApps(config.trackedApps, candidateConfigs(trackedCandidates));
	const [brewStatuses, masStatuses, configuredStatuses] = await Promise.all([
		checkBrewStatuses(inventory, sourcePolicy),
		checkMasStatuses(inventory, sourcePolicy),
		checkConfiguredStatuses(mergedTrackedApps, inventory, sourceAudit, sourcePolicy),
	]);

	const statuses = dedupeStatuses([...configuredStatuses, ...brewStatuses, ...masStatuses]).sort(compareStatuses);

	return {
		generatedAt: nowIso(),
		statuses,
		inventory,
		summary: summarize(statuses),
	};
}

async function checkBrewStatuses(
	inventory: Inventory,
	sourcePolicy: ThirdPartyPolicyEntry[],
): Promise<AppStatus[]> {
	const outdated = await fetchBrewOutdated();
	const checkedAt = nowIso();
	const summarizedError = truncateMessage(outdated.error);

	return inventory.brewPackages.map((pkg) => {
		const outdatedInfo = outdated.entries.get(pkg.name);
		const matchedBundle = pkg.packageType === "cask" ? findBestBundleForName(pkg.name, inventory.appBundles) : null;
		const matchedPolicy =
			matchPolicyForBundle(matchedBundle, sourcePolicy) ??
			(pkg.packageType === "cask" ? matchPolicyForName(pkg.name, sourcePolicy) : null);
		const latestVersion = outdatedInfo?.latestVersion ?? pkg.installedVersion;
		const status = outdatedInfo ? "update-available" : summarizedError ? "unknown" : "up-to-date";
		const notes = truncateMessage(outdatedInfo?.notes ?? summarizedError ?? undefined);

		const baseStatus = {
			id: `brew:${pkg.packageType}:${pkg.name}`,
			displayName: matchedBundle?.name ?? pkg.name,
			category: "brew",
			channel: `brew ${pkg.packageType}`,
			installedVersion: pkg.installedVersion,
			latestVersion,
			status,
			lastCheckedAt: checkedAt,
			lastActivityAt: matchedBundle?.lastActivityAt ?? null,
			path: matchedBundle?.path,
			bundleId: matchedBundle?.bundleId,
			activationSource: "brew",
			upgradePolicy: "normal",
			notes: notes ?? undefined,
			error: summarizedError ?? undefined,
		} satisfies AppStatus;

		return applyThirdPartyPolicy(baseStatus, matchedPolicy, matchedBundle);
	});
}

async function fetchBrewOutdated(): Promise<{
	entries: Map<string, { latestVersion: string | null; notes?: string }>;
	error: string | null;
}> {
	const jsonResult = await runCommand("brew", ["outdated", "--json=v2", "--greedy"], {
		timeoutMs: 45_000,
		env: BREW_ENV,
	});

	if (jsonResult.ok) {
		try {
			const parsed = JSON.parse(jsonResult.stdout) as Record<string, unknown>;
			const entries = new Map<string, { latestVersion: string | null; notes?: string }>();

			for (const item of extractBrewJsonEntries(parsed.formulae)) {
				entries.set(item.name, { latestVersion: item.currentVersion });
			}

			for (const item of extractBrewJsonEntries(parsed.casks)) {
				entries.set(item.name, { latestVersion: item.currentVersion });
			}

			return { entries, error: null };
		} catch (error) {
			return {
				entries: new Map(),
				error: error instanceof Error ? error.message : "Failed to parse brew outdated JSON",
			};
		}
	}

	const textResult = await runCommand("brew", ["outdated", "--verbose", "--greedy"], {
		timeoutMs: 45_000,
		env: BREW_ENV,
	});

	if (textResult.ok) {
		return {
			entries: parseBrewOutdatedVerbose(textResult.stdout),
			error: null,
		};
	}

	return {
		entries: new Map(),
		error: firstNonEmpty(jsonResult.stderr, textResult.stderr) ?? "brew outdated failed",
	};
}

function extractBrewJsonEntries(value: unknown): Array<{ name: string; currentVersion: string | null }> {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (!item || typeof item !== "object") {
				return null;
			}

			const record = item as Record<string, unknown>;
			const name = typeof record.name === "string" ? record.name : null;
			const currentVersion =
				stringValue(record.current_version) ??
				stringValue(record.currentVersion) ??
				firstString(record.installed_versions) ??
				firstString(record.installedVersions);

			if (!name) {
				return null;
			}

			return { name, currentVersion };
		})
		.filter((item): item is { name: string; currentVersion: string | null } => item !== null);
}

function parseBrewOutdatedVerbose(output: string): Map<string, { latestVersion: string | null }> {
	const result = new Map<string, { latestVersion: string | null }>();
	const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);

	for (const line of lines) {
		const namedMatch =
			line.match(/^([^\s]+)\s+\(([^)]+)\)\s+<\s+(.+)$/) ??
			line.match(/^([^\s]+)\s+([^\s]+)\s+<\s+(.+)$/);

		if (!namedMatch) {
			continue;
		}

		result.set(namedMatch[1], {
			latestVersion: namedMatch[3]?.trim() ?? null,
		});
	}

	return result;
}

async function checkMasStatuses(
	inventory: Inventory,
	sourcePolicy: ThirdPartyPolicyEntry[],
): Promise<AppStatus[]> {
	const outdated = await fetchMasOutdated();
	const checkedAt = nowIso();
	const summarizedError = truncateMessage(outdated.error);

	return inventory.masApps.map((app) => {
		const outdatedEntry = outdated.entries.get(app.appId);
		const matchedBundle = findBestBundleForName(app.name, inventory.appBundles);
		const matchedPolicy = matchPolicyForBundle(matchedBundle, sourcePolicy) ?? matchPolicyForName(app.name, sourcePolicy);
		const latestVersion = outdatedEntry?.latestVersion ?? app.installedVersion;
		const baseStatus = {
			id: `mas:${app.appId}`,
			displayName: matchedBundle?.name ?? app.name,
			category: "mas",
			channel: "Mac App Store",
			installedVersion: app.installedVersion,
			latestVersion,
			status: outdatedEntry ? "update-available" : summarizedError ? "unknown" : "up-to-date",
			lastCheckedAt: checkedAt,
			lastActivityAt: matchedBundle?.lastActivityAt ?? null,
			path: matchedBundle?.path,
			bundleId: matchedBundle?.bundleId,
			activationSource: "appStore",
			upgradePolicy: "normal",
			notes: truncateMessage(outdatedEntry?.notes ?? summarizedError ?? undefined) ?? undefined,
			error: summarizedError ?? undefined,
		} satisfies AppStatus;

		return applyThirdPartyPolicy(baseStatus, matchedPolicy, matchedBundle);
	});
}

async function fetchMasOutdated(): Promise<{
	entries: Map<number, { latestVersion: string | null; notes?: string }>;
	error: string | null;
}> {
	const result = await runCommand("mas", ["outdated", "--inaccurate"], {
		timeoutMs: 25_000,
	});

	if (!result.ok) {
		return {
			entries: new Map(),
			error: firstNonEmpty(result.stderr, result.stdout) ?? "mas outdated failed",
		};
	}

	const entries = new Map<number, { latestVersion: string | null; notes?: string }>();
	const lines = result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);

	for (const line of lines) {
		const match = line.match(/^(\d+)\s+(.+?)\s+\(([^)]+?)\s+->\s+([^)]+)\)$/);
		if (!match) {
			continue;
		}

		entries.set(Number(match[1]), {
			latestVersion: match[4].trim(),
			notes: `${match[3].trim()} -> ${match[4].trim()}`,
		});
	}

	return {
		entries,
		error: null,
	};
}

async function checkConfiguredStatuses(
	trackedApps: MonitorConfig["trackedApps"],
	inventory: Inventory,
	sourceAudit: SourceAuditFinding[],
	sourcePolicy: ThirdPartyPolicyEntry[],
): Promise<AppStatus[]> {
	return await Promise.all(
		trackedApps.map(async (appConfig) => {
			const checkedAt = nowIso();
			const installedBundle =
				appConfig.installed.kind === "appBundle" ? await resolveInstalledBundle(appConfig, inventory) : null;
			const installedVersion =
				appConfig.installed.kind === "manual"
					? appConfig.installed.currentVersion
					: installedBundle?.version ?? null;
			const auditFinding = matchAuditFindingForBundle(installedBundle, sourceAudit);
			const matchedPolicy = matchPolicyForBundle(installedBundle, sourcePolicy);
			const maintenance = resolveMaintenancePolicy(appConfig, auditFinding);
			const installationNote =
				appConfig.installed.kind === "appBundle" && !installedBundle
					? "Local app bundle not found in configured paths."
					: null;

			try {
				const remote = await fetchLatestVersion(appConfig.source);
				const status = deriveStatus(installedVersion, remote);

				const baseStatus = {
					id: appConfig.id,
					displayName: appConfig.displayName,
					category: "configured",
					channel: remote.sourceLabel,
					installedVersion,
					latestVersion: remote.version,
					status,
					lastCheckedAt: checkedAt,
					lastActivityAt: installedBundle?.lastActivityAt ?? null,
					path: installedBundle?.path,
					bundleId: installedBundle?.bundleId,
					sourceUrl: remote.sourceUrl,
					activationSource: maintenance.activationSource,
					upgradePolicy: maintenance.upgradePolicy,
					policyReason: maintenance.reason,
					recommendation: buildRecommendation(status, maintenance.upgradePolicy, maintenance.activationSource),
					notes:
						truncateMessage([installationNote, remote.notes].filter(Boolean).join(" | ") || undefined) ??
						undefined,
				} satisfies AppStatus;

				return applyThirdPartyPolicy(baseStatus, matchedPolicy, installedBundle);
			} catch (error) {
				const baseStatus = {
					id: appConfig.id,
					displayName: appConfig.displayName,
					category: "configured",
					channel: appConfig.source.kind,
					installedVersion,
					latestVersion: null,
					status: "error",
					lastCheckedAt: checkedAt,
					lastActivityAt: installedBundle?.lastActivityAt ?? null,
					path: installedBundle?.path,
					bundleId: installedBundle?.bundleId,
					activationSource: maintenance.activationSource,
					upgradePolicy: maintenance.upgradePolicy,
					policyReason: maintenance.reason,
					recommendation: buildRecommendation("error", maintenance.upgradePolicy, maintenance.activationSource),
					notes: truncateMessage(installationNote ?? undefined) ?? undefined,
					error: truncateMessage(error instanceof Error ? error.message : "Unknown error") ?? undefined,
				} satisfies AppStatus;

				return applyThirdPartyPolicy(baseStatus, matchedPolicy, installedBundle);
			}
		}),
	);
}

async function resolveInstalledBundle(
	appConfig: MonitorAppConfig,
	inventory: Inventory,
): Promise<AppBundleRecord | null> {
	if (appConfig.installed.kind !== "appBundle") {
		return null;
	}

	if (appConfig.installed.path) {
		return await readAppBundle(appConfig.installed.path);
	}

	const indexes = buildBundleIndexes(inventory.appBundles);

	if (appConfig.installed.bundleId) {
		return indexes.byBundleId.get(appConfig.installed.bundleId) ?? null;
	}

	if (appConfig.installed.appName) {
		return indexes.byName.get(appConfig.installed.appName.toLowerCase()) ?? null;
	}

	return null;
}

function deriveStatus(installedVersion: string | null, remote: RemoteVersionResult): StatusLevel {
	const hasNewerRemote = isRemoteNewer(installedVersion, remote.version);

	if (hasNewerRemote === true) {
		return "update-available";
	}

	if (hasNewerRemote === false) {
		return "up-to-date";
	}

	return remote.version ? "unknown" : "error";
}

function summarize(statuses: AppStatus[]): SnapshotSummary {
	return statuses.reduce<SnapshotSummary>(
		(summary, status) => {
			summary.total += 1;
			if (status.status === "update-available") {
				summary.updateAvailable += 1;
			} else if (status.status === "up-to-date") {
				summary.upToDate += 1;
			} else if (status.status === "error") {
				summary.errors += 1;
			} else {
				summary.unknown += 1;
			}

			if (status.upgradePolicy === "cautious") {
				summary.cautious += 1;
			} else if (status.upgradePolicy === "hold") {
				summary.hold += 1;
			}
			return summary;
		},
		{
			total: 0,
			updateAvailable: 0,
			upToDate: 0,
			unknown: 0,
			errors: 0,
			cautious: 0,
			hold: 0,
		},
	);
}

function resolveMaintenancePolicy(
	appConfig: MonitorAppConfig,
	auditFinding: SourceAuditFinding | null,
): {
	activationSource?: ActivationSource;
	upgradePolicy: UpgradePolicyLevel;
	reason?: string;
} {
	const activationSource =
		appConfig.maintenance?.activationSource ?? (auditFinding ? "thirdPartyActivated" : undefined);
	const explicitPolicy = appConfig.maintenance?.upgradePolicy ?? (auditFinding ? "hold" : undefined);
	const auditReason =
		auditFinding && auditFinding.markers.length
			? `Detected third-party markers: ${auditFinding.markers.join(", ")}`
			: undefined;
	const fallbackPolicy =
		activationSource === "thirdPartyActivated" || activationSource === "thirdPartyStore" ? "cautious" : "normal";

	return {
		activationSource,
		upgradePolicy: explicitPolicy ?? fallbackPolicy,
		reason: truncateMessage(appConfig.maintenance?.reason ?? auditReason ?? undefined) ?? undefined,
	};
}

function buildRecommendation(
	status: StatusLevel,
	upgradePolicy: UpgradePolicyLevel,
	activationSource?: ActivationSource,
): string | undefined {
	if (upgradePolicy === "hold") {
		if (status === "update-available") {
			return "发现新版本，但当前策略是暂缓升级。先确认激活、插件和数据兼容性。";
		}
		return "当前软件被标记为暂缓升级。除非必要，不要立即跟随新版本。";
	}

	if (upgradePolicy === "cautious") {
		if (status === "update-available") {
			return "发现新版本，建议谨慎升级。先备份并确认激活方式、补丁或授权兼容性。";
		}

		if (activationSource === "thirdPartyActivated") {
			return "这是第三方激活版本，后续遇到新版本时请先确认激活兼容性。";
		}

		return "该软件被标记为谨慎升级，后续版本更新建议先做兼容性确认。";
	}

	return undefined;
}

function compareStatuses(left: AppStatus, right: AppStatus): number {
	const policyPriority = policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy);
	if (policyPriority !== 0) {
		return policyPriority;
	}

	const statusPriority = statusRank(left.status) - statusRank(right.status);
	if (statusPriority !== 0) {
		return statusPriority;
	}

	return left.displayName.localeCompare(right.displayName);
}

function statusRank(status: StatusLevel): number {
	switch (status) {
		case "update-available":
			return 0;
		case "error":
			return 1;
		case "unknown":
			return 2;
		case "up-to-date":
			return 3;
	}
}

function policyRank(policy: UpgradePolicyLevel): number {
	switch (policy) {
		case "hold":
			return 0;
		case "cautious":
			return 1;
		case "normal":
			return 2;
		}
}

function applyThirdPartyPolicy(
	status: AppStatus,
	policy: ThirdPartyPolicyEntry | null,
	bundle: AppBundleRecord | null,
): AppStatus {
	if (!policy) {
		return status;
	}

	const recommendation =
		buildRecommendation(status.status, policy.upgradePolicy, policy.activationSource) ?? policy.recommendation;
	const notes = truncateMessage(
		[`Third-party audit match: ${policy.markers.join(", ")}`, status.notes].filter(Boolean).join(" | ") || undefined,
	);

	return {
		...status,
		displayName: bundle?.name ?? status.displayName,
		path: status.path ?? bundle?.path ?? policy.path,
		bundleId: status.bundleId ?? bundle?.bundleId ?? policy.bundleId,
		activationSource: policy.activationSource,
		upgradePolicy: policy.upgradePolicy,
		policyReason: policy.reason,
		recommendation,
		notes: notes ?? undefined,
	};
}

function mergeTrackedApps(
	explicitApps: MonitorConfig["trackedApps"],
	candidateApps: MonitorConfig["trackedApps"],
): MonitorConfig["trackedApps"] {
	const merged = [...explicitApps];
	const existingKeys = new Set<string>();

	for (const app of explicitApps) {
		for (const key of trackingKeys(app)) {
			existingKeys.add(key);
		}
	}

	for (const candidate of candidateApps) {
		const keys = trackingKeys(candidate);
		if (keys.some((key) => existingKeys.has(key))) {
			continue;
		}

		merged.push(candidate);
		for (const key of keys) {
			existingKeys.add(key);
		}
	}

	return merged;
}

function trackingKeys(app: MonitorConfig["trackedApps"][number]): string[] {
	const keys = [`id:${app.id}`];

	if (app.installed.kind === "appBundle") {
		if (app.installed.path) {
			keys.push(`path:${app.installed.path}`);
		}
		if (app.installed.bundleId) {
			keys.push(`bundle:${app.installed.bundleId}`);
		}
		if (app.installed.appName) {
			keys.push(`name:${normalizeDisplayName(app.installed.appName)}`);
		}
	}

	keys.push(`display:${normalizeDisplayName(app.displayName)}`);
	return keys;
}

function dedupeStatuses(statuses: AppStatus[]): AppStatus[] {
	const seen = new Set<string>();
	const result: AppStatus[] = [];

	for (const status of statuses) {
		const keys = statusIdentityKeys(status);
		if (keys.some((key) => seen.has(key))) {
			continue;
		}

		result.push(status);
		for (const key of keys) {
			seen.add(key);
		}
	}

	return result;
}

function statusIdentityKeys(status: AppStatus): string[] {
	const keys = [`id:${status.id}`];

	if (status.bundleId) {
		keys.push(`bundle:${status.bundleId}`);
	}
	if (status.path) {
		keys.push(`path:${status.path}`);
	}

	keys.push(`display:${normalizeDisplayName(status.displayName)}`);
	return keys;
}

function normalizeDisplayName(value: string): string {
	return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
	for (const value of values) {
		if (value && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(value: unknown): string | null {
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}

	if (Array.isArray(value)) {
		const first = value.find((item) => typeof item === "string" && item.trim());
		return typeof first === "string" ? first.trim() : null;
	}

	return null;
}

function truncateMessage(value: string | null | undefined, maxLength = 280): string | null {
	if (!value) {
		return null;
	}

	const compact = value.replaceAll(/\s+/g, " ").trim();
	if (compact.length <= maxLength) {
		return compact;
	}

	return `${compact.slice(0, maxLength - 1)}…`;
}
