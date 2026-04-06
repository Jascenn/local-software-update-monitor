export type StatusLevel = "up-to-date" | "update-available" | "unknown" | "error";
export type UpgradePolicyLevel = "normal" | "cautious" | "hold";
export type ActivationSource =
	| "official"
	| "appStore"
	| "brew"
	| "github"
	| "thirdPartyStore"
	| "thirdPartyActivated"
	| "manual";
export type SourceAuditMarker = "macked" | "tnt" | "macwk" | "appstorrent" | "qiuchenly";
export type AnnotationMark = "watch" | "avoid" | "safe" | "ignore" | "todo";

export interface AppBundleTarget {
	kind: "appBundle";
	path?: string;
	bundleId?: string;
	appName?: string;
}

export interface ManualTarget {
	kind: "manual";
	currentVersion: string;
}

export type InstalledTarget = AppBundleTarget | ManualTarget;

export interface GithubReleaseSource {
	kind: "githubRelease";
	repo: string;
	includePrerelease?: boolean;
	versionPrefix?: string;
}

export interface SparkleAppcastSource {
	kind: "sparkleAppcast";
	url: string;
}

export interface JsonEndpointSource {
	kind: "jsonEndpoint";
	url: string;
	versionPath: string;
	headers?: Record<string, string>;
}

export interface HtmlRegexSource {
	kind: "htmlRegex";
	url: string;
	pattern: string;
	flags?: string;
	matchGroup?: number;
}

export type VersionSource =
	| GithubReleaseSource
	| SparkleAppcastSource
	| JsonEndpointSource
	| HtmlRegexSource;

export interface MaintenancePolicy {
	activationSource?: ActivationSource;
	upgradePolicy?: UpgradePolicyLevel;
	reason?: string;
}

export interface MonitorAppConfig {
	id: string;
	displayName: string;
	installed: InstalledTarget;
	source: VersionSource;
	maintenance?: MaintenancePolicy;
	tags?: string[];
}

export interface MonitorConfig {
	port: number;
	pollIntervalMs: number;
	appLocations: string[];
	trackedApps: MonitorAppConfig[];
}

export type BrewPackageType = "formula" | "cask";

export interface BrewPackageRecord {
	name: string;
	packageType: BrewPackageType;
	installedVersion: string | null;
}

export interface MasAppRecord {
	appId: number;
	name: string;
	installedVersion: string | null;
}

export interface AppBundleRecord {
	name: string;
	path: string;
	bundleId: string | null;
	version: string | null;
}

export interface Inventory {
	brewPackages: BrewPackageRecord[];
	masApps: MasAppRecord[];
	appBundles: AppBundleRecord[];
}

export interface RemoteVersionResult {
	version: string | null;
	sourceLabel: string;
	sourceUrl?: string;
	releasedAt?: string | null;
	notes?: string;
}

export interface AppStatus {
	id: string;
	displayName: string;
	category: "brew" | "mas" | "configured";
	channel: string;
	installedVersion: string | null;
	latestVersion: string | null;
	status: StatusLevel;
	lastCheckedAt: string;
	path?: string;
	bundleId?: string | null;
	sourceUrl?: string;
	activationSource?: ActivationSource;
	upgradePolicy: UpgradePolicyLevel;
	policyReason?: string;
	recommendation?: string;
	notes?: string;
	error?: string;
}

export interface SnapshotSummary {
	total: number;
	updateAvailable: number;
	upToDate: number;
	unknown: number;
	errors: number;
	cautious: number;
	hold: number;
}

export interface Snapshot {
	generatedAt: string;
	statuses: AppStatus[];
	inventory: Inventory;
	summary: SnapshotSummary;
}

export interface StoredHistory {
	latest: Snapshot | null;
	history: Snapshot[];
}

export interface SourceAuditEvidence {
	kind: "bundle-path" | "receipt" | "linked-library" | "download-source";
	marker: SourceAuditMarker;
	value: string;
}

export interface SourceAuditFinding {
	name: string;
	path: string;
	bundleId: string | null;
	version: string | null;
	confidence: "high" | "medium";
	markers: SourceAuditMarker[];
	evidence: SourceAuditEvidence[];
}

export interface ThirdPartyPolicyEntry {
	name: string;
	path: string;
	bundleId: string | null;
	version: string | null;
	confidence: "high" | "medium";
	markers: SourceAuditMarker[];
	activationSource: "thirdPartyActivated";
	upgradePolicy: "hold";
	reason: string;
	recommendation: string;
}

export interface TrackedAppCandidate {
	config: MonitorAppConfig;
	confidence: "high" | "medium";
	detectedFrom: "SUFeedURL";
	path: string;
	bundleId: string | null;
	version: string | null;
	markers: SourceAuditMarker[];
}

export interface AppAnnotationTarget {
	displayName: string;
	appId?: string;
	bundleId?: string | null;
	path?: string;
}

export interface AppAnnotationInput extends AppAnnotationTarget {
	mark: AnnotationMark;
	note?: string;
}

export interface AppAnnotation extends AppAnnotationInput {
	recordId: string;
	updatedAt: string;
}
