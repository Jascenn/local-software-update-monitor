import type {
	ActivationSource,
	AppStatus,
	SourceAuditMarker,
	StatusLevel,
	ThirdPartyPolicyEntry,
	TrackedAppCandidate,
	UpgradePolicyLevel,
} from "./types.ts";

export type StatusSortKey =
	| "priority"
	| "name"
	| "status"
	| "policy"
	| "channel"
	| "activity"
	| "installedVersion"
	| "latestVersion"
	| "checkedAt";

export interface StatusQuery {
	search?: string;
	status?: StatusLevel | "all";
	policy?: UpgradePolicyLevel | "all";
	category?: AppStatus["category"] | "all";
	activationSource?: ActivationSource | "all";
	updatesOnly?: boolean;
	thirdPartyOnly?: boolean;
	sort?: StatusSortKey;
	descending?: boolean;
	limit?: number;
}

export type PolicySortKey = "priority" | "name" | "confidence" | "marker";

export interface PolicyQuery {
	search?: string;
	marker?: SourceAuditMarker | "all";
	confidence?: "high" | "medium" | "all";
	sort?: PolicySortKey;
	descending?: boolean;
	limit?: number;
}

export type CandidateSortKey = "name" | "confidence" | "version" | "marker";

export interface CandidateQuery {
	search?: string;
	marker?: SourceAuditMarker | "all";
	confidence?: "high" | "medium" | "all";
	sort?: CandidateSortKey;
	descending?: boolean;
	limit?: number;
}

export function applyStatusQuery(statuses: AppStatus[], query: StatusQuery): AppStatus[] {
	const filtered = statuses.filter((status) => matchesStatusQuery(status, query));
	const sorted = [...filtered].sort((left, right) => compareStatusForSort(left, right, query));
	return typeof query.limit === "number" && query.limit > 0 ? sorted.slice(0, query.limit) : sorted;
}

export function applyPolicyQuery(policies: ThirdPartyPolicyEntry[], query: PolicyQuery): ThirdPartyPolicyEntry[] {
	const filtered = policies.filter((policy) => matchesPolicyQuery(policy, query));
	const sorted = [...filtered].sort((left, right) => comparePolicyForSort(left, right, query));
	return typeof query.limit === "number" && query.limit > 0 ? sorted.slice(0, query.limit) : sorted;
}

export function applyCandidateQuery(candidates: TrackedAppCandidate[], query: CandidateQuery): TrackedAppCandidate[] {
	const filtered = candidates.filter((candidate) => matchesCandidateQuery(candidate, query));
	const sorted = [...filtered].sort((left, right) => compareCandidateForSort(left, right, query));
	return typeof query.limit === "number" && query.limit > 0 ? sorted.slice(0, query.limit) : sorted;
}

function matchesStatusQuery(status: AppStatus, query: StatusQuery): boolean {
	if (query.updatesOnly && status.status !== "update-available") {
		return false;
	}

	if (query.thirdPartyOnly && !isThirdPartySource(status.activationSource)) {
		return false;
	}

	if (query.status && query.status !== "all" && status.status !== query.status) {
		return false;
	}

	if (query.policy && query.policy !== "all" && status.upgradePolicy !== query.policy) {
		return false;
	}

	if (query.category && query.category !== "all" && status.category !== query.category) {
		return false;
	}

	if (
		query.activationSource &&
		query.activationSource !== "all" &&
		(status.activationSource ?? "") !== query.activationSource
	) {
		return false;
	}

	if (!query.search?.trim()) {
		return true;
	}

	const haystack = normalizeText(
		[
			status.displayName,
			status.channel,
			status.activationSource,
			status.path,
			status.bundleId,
			status.notes,
			status.policyReason,
			status.error,
		]
			.filter(Boolean)
			.join(" "),
	);

	return haystack.includes(normalizeText(query.search));
}

function matchesPolicyQuery(policy: ThirdPartyPolicyEntry, query: PolicyQuery): boolean {
	if (query.marker && query.marker !== "all" && !policy.markers.includes(query.marker)) {
		return false;
	}

	if (query.confidence && query.confidence !== "all" && policy.confidence !== query.confidence) {
		return false;
	}

	if (!query.search?.trim()) {
		return true;
	}

	const haystack = normalizeText([policy.name, policy.reason, policy.recommendation, policy.path].join(" "));
	return haystack.includes(normalizeText(query.search));
}

function matchesCandidateQuery(candidate: TrackedAppCandidate, query: CandidateQuery): boolean {
	if (query.marker && query.marker !== "all" && !candidate.markers.includes(query.marker)) {
		return false;
	}

	if (query.confidence && query.confidence !== "all" && candidate.confidence !== query.confidence) {
		return false;
	}

	if (!query.search?.trim()) {
		return true;
	}

	const haystack = normalizeText(
		[
			candidate.config.displayName,
			candidate.path,
			candidate.bundleId,
			candidate.version,
			candidate.config.source.kind === "sparkleAppcast" ? candidate.config.source.url : "",
		]
			.filter(Boolean)
			.join(" "),
	);

	return haystack.includes(normalizeText(query.search));
}

function compareStatusForSort(left: AppStatus, right: AppStatus, query: StatusQuery): number {
	const sort = query.sort ?? "priority";
	const direction = query.descending ? -1 : 1;
	let comparison = 0;

	switch (sort) {
		case "name":
			comparison = compareText(left.displayName, right.displayName);
			break;
		case "status":
			comparison = statusRank(left.status) - statusRank(right.status);
			break;
		case "policy":
			comparison = policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy);
			break;
		case "channel":
			comparison = compareText(left.channel, right.channel);
			break;
		case "activity":
			comparison = compareNullableText(left.lastActivityAt, right.lastActivityAt);
			break;
		case "installedVersion":
			comparison = compareNullableText(left.installedVersion, right.installedVersion);
			break;
		case "latestVersion":
			comparison = compareNullableText(left.latestVersion, right.latestVersion);
			break;
		case "checkedAt":
			comparison = compareNullableText(left.lastCheckedAt, right.lastCheckedAt);
			break;
		case "priority":
		default:
			comparison = compareStatusPriority(left, right);
			break;
	}

	if (comparison === 0 && sort !== "priority") {
		comparison = compareStatusPriority(left, right);
	}

	return comparison * direction;
}

function comparePolicyForSort(left: ThirdPartyPolicyEntry, right: ThirdPartyPolicyEntry, query: PolicyQuery): number {
	const sort = query.sort ?? "priority";
	const direction = query.descending ? -1 : 1;
	let comparison = 0;

	switch (sort) {
		case "name":
			comparison = compareText(left.name, right.name);
			break;
		case "confidence":
			comparison = confidenceRank(left.confidence) - confidenceRank(right.confidence);
			break;
		case "marker":
			comparison = compareText(left.markers.join(","), right.markers.join(","));
			break;
		case "priority":
		default:
			comparison =
				policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy) ||
				confidenceRank(left.confidence) - confidenceRank(right.confidence) ||
				compareText(left.name, right.name);
			break;
	}

	if (comparison === 0 && sort !== "priority") {
		comparison = compareText(left.name, right.name);
	}

	return comparison * direction;
}

function compareCandidateForSort(left: TrackedAppCandidate, right: TrackedAppCandidate, query: CandidateQuery): number {
	const sort = query.sort ?? "name";
	const direction = query.descending ? -1 : 1;
	let comparison = 0;

	switch (sort) {
		case "confidence":
			comparison = confidenceRank(left.confidence) - confidenceRank(right.confidence);
			break;
		case "version":
			comparison = compareNullableText(left.version, right.version);
			break;
		case "marker":
			comparison = compareText(left.markers.join(","), right.markers.join(","));
			break;
		case "name":
		default:
			comparison = compareText(left.config.displayName, right.config.displayName);
			break;
	}

	if (comparison === 0 && sort !== "name") {
		comparison = compareText(left.config.displayName, right.config.displayName);
	}

	return comparison * direction;
}

function compareStatusPriority(left: AppStatus, right: AppStatus): number {
	return (
		policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy) ||
		statusRank(left.status) - statusRank(right.status) ||
		compareText(left.displayName, right.displayName)
	);
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

function confidenceRank(confidence: "high" | "medium"): number {
	switch (confidence) {
		case "high":
			return 0;
		case "medium":
			return 1;
	}
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right, "zh-CN", { sensitivity: "base" });
}

function compareNullableText(left: string | null | undefined, right: string | null | undefined): number {
	return compareText(left ?? "", right ?? "");
}

function normalizeText(value: string): string {
	return value.trim().toLowerCase();
}

function isThirdPartySource(source: ActivationSource | undefined): boolean {
	return source === "thirdPartyActivated" || source === "thirdPartyStore";
}
