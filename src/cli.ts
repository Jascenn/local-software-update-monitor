import { cwd } from "node:process";

import { annotationTargetFromStatus, findMatchingAnnotation } from "./core/annotations.ts";
import { loadConfig } from "./core/config.ts";
import { createSnapshot } from "./core/monitor.ts";
import {
	applyCandidateQuery,
	applyPolicyQuery,
	applyStatusQuery,
	type CandidateSortKey,
	type PolicySortKey,
	type StatusSortKey,
} from "./core/query.ts";
import { loadThirdPartyPolicy } from "./core/source-policy.ts";
import { loadTrackedAppCandidates } from "./core/tracked-candidates.ts";
import type { AppAnnotation, AppStatus, Snapshot, ThirdPartyPolicyEntry, TrackedAppCandidate } from "./core/types.ts";
import { loadAnnotations } from "./storage/annotations.ts";
import { loadState, saveSnapshot } from "./storage/state.ts";

type CommandName = "status" | "policy" | "candidates";

interface ParsedArgs {
	command: CommandName;
	flags: Map<string, string | boolean>;
	help: boolean;
}

async function main(): Promise<void> {
	const rootDirectory = cwd();
	const parsed = parseArgs(process.argv.slice(2));

	if (parsed.help) {
		printHelp(parsed.command);
		return;
	}

	switch (parsed.command) {
		case "policy":
			await runPolicyCommand(rootDirectory, parsed.flags);
			return;
		case "candidates":
			await runCandidatesCommand(rootDirectory, parsed.flags);
			return;
		case "status":
		default:
			await runStatusCommand(rootDirectory, parsed.flags);
			return;
	}
}

async function runStatusCommand(rootDirectory: string, flags: Map<string, string | boolean>): Promise<void> {
	const snapshot = await loadSnapshotForCli(rootDirectory, readBooleanFlag(flags, "live"));
	const annotations = await loadAnnotations(rootDirectory);
	const sort = (readStringFlag(flags, "sort") as StatusSortKey | undefined) ?? "priority";
	const descending = readBooleanFlag(flags, "desc");
	const mark = readStringFlag(flags, "mark");
	let statuses = applyStatusQuery(snapshot.statuses, {
		search: readStringFlag(flags, "search"),
		status: readStringFlag(flags, "status") as AppStatus["status"] | "all" | undefined,
		policy: readStringFlag(flags, "policy") as AppStatus["upgradePolicy"] | "all" | undefined,
		category: readStringFlag(flags, "category") as AppStatus["category"] | "all" | undefined,
		activationSource: readStringFlag(flags, "source") as AppStatus["activationSource"] | "all" | undefined,
		updatesOnly: readBooleanFlag(flags, "updates-only"),
		thirdPartyOnly: readBooleanFlag(flags, "third-party-only"),
		sort,
		descending: sort === "priority" ? false : descending,
	});
	if (mark) {
		statuses = statuses.filter((status) => matchesMarkFilter(annotationForStatus(status, annotations), mark));
	}
	if (sort === "priority") {
		statuses = [...statuses].sort((left, right) => compareAnnotatedPriority(left, right, annotations) * (descending ? -1 : 1));
	}
	const limit = readNumberFlag(flags, "limit");
	if (typeof limit === "number") {
		statuses = statuses.slice(0, limit);
	}
	const annotatedStatuses = statuses.map((status) => ({
		...status,
		annotation: annotationForStatus(status, annotations),
	}));

	if (readBooleanFlag(flags, "json")) {
		console.log(
			JSON.stringify(
				{
					generatedAt: snapshot.generatedAt,
					showing: annotatedStatuses.length,
					total: snapshot.statuses.length,
					statuses: annotatedStatuses,
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(`Snapshot: ${snapshot.generatedAt}`);
	console.log(`Showing ${annotatedStatuses.length} of ${snapshot.statuses.length} statuses`);
	console.log(
		`Summary: updates=${snapshot.summary.updateAvailable} hold=${snapshot.summary.hold} cautious=${snapshot.summary.cautious} errors=${snapshot.summary.errors}`,
	);
	console.log(
		renderTable(annotatedStatuses, [
			{ header: "NAME", width: 24, value: (item) => item.displayName },
			{ header: "STATUS", width: 16, value: (item) => item.status },
			{ header: "POLICY", width: 12, value: (item) => item.upgradePolicy },
			{ header: "MARK", width: 12, value: (item) => markLabel(item.annotation?.mark) },
			{ header: "CHANNEL", width: 18, value: (item) => item.channel },
			{ header: "INSTALLED", width: 14, value: (item) => item.installedVersion ?? "-" },
			{ header: "LATEST", width: 14, value: (item) => item.latestVersion ?? "-" },
		]),
	);
}

async function runPolicyCommand(rootDirectory: string, flags: Map<string, string | boolean>): Promise<void> {
	const policies = await loadThirdPartyPolicy(rootDirectory);
	const filtered = applyPolicyQuery(policies, {
		search: readStringFlag(flags, "search"),
		marker: readStringFlag(flags, "marker") as ThirdPartyPolicyEntry["markers"][number] | "all" | undefined,
		confidence: readStringFlag(flags, "confidence") as ThirdPartyPolicyEntry["confidence"] | "all" | undefined,
		sort: (readStringFlag(flags, "sort") as PolicySortKey | undefined) ?? "priority",
		descending: readBooleanFlag(flags, "desc"),
		limit: readNumberFlag(flags, "limit"),
	});

	if (readBooleanFlag(flags, "json")) {
		console.log(
			JSON.stringify(
				{
					showing: filtered.length,
					total: policies.length,
					policies: filtered,
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(`Showing ${filtered.length} of ${policies.length} third-party policies`);
	console.log(
		renderTable(filtered, [
			{ header: "NAME", width: 24, value: (item) => item.name },
			{ header: "MARKER", width: 16, value: (item) => item.markers.join(",") },
			{ header: "CONF", width: 8, value: (item) => item.confidence },
			{ header: "POLICY", width: 12, value: (item) => item.upgradePolicy },
			{ header: "REASON", width: 56, value: (item) => item.reason },
		]),
	);
}

async function runCandidatesCommand(rootDirectory: string, flags: Map<string, string | boolean>): Promise<void> {
	const candidates = await loadTrackedAppCandidates(rootDirectory);
	const filtered = applyCandidateQuery(candidates, {
		search: readStringFlag(flags, "search"),
		marker: readStringFlag(flags, "marker") as TrackedAppCandidate["markers"][number] | "all" | undefined,
		confidence: readStringFlag(flags, "confidence") as TrackedAppCandidate["confidence"] | "all" | undefined,
		sort: (readStringFlag(flags, "sort") as CandidateSortKey | undefined) ?? "name",
		descending: readBooleanFlag(flags, "desc"),
		limit: readNumberFlag(flags, "limit"),
	});

	if (readBooleanFlag(flags, "json")) {
		console.log(
			JSON.stringify(
				{
					showing: filtered.length,
					total: candidates.length,
					candidates: filtered,
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(`Showing ${filtered.length} of ${candidates.length} tracked candidates`);
	console.log(
		renderTable(filtered, [
			{ header: "NAME", width: 24, value: (item) => item.config.displayName },
			{ header: "VERSION", width: 12, value: (item) => item.version ?? "-" },
			{ header: "CONF", width: 8, value: (item) => item.confidence },
			{ header: "MARKER", width: 16, value: (item) => item.markers.join(",") },
			{
				header: "FEED",
				width: 64,
				value: (item) => (item.config.source.kind === "sparkleAppcast" ? item.config.source.url : "-"),
			},
		]),
	);
}

function parseArgs(argv: string[]): ParsedArgs {
	let command: CommandName = "status";
	let help = false;
	const flags = new Map<string, string | boolean>();

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];

		if (token === "--help" || token === "-h") {
			help = true;
			continue;
		}

		if (!token.startsWith("-") && isCommandName(token) && command === "status" && index === 0) {
			command = token;
			continue;
		}

		if (!token.startsWith("--")) {
			continue;
		}

		const key = token.slice(2);
		const nextToken = argv[index + 1];
		if (!nextToken || nextToken.startsWith("--")) {
			flags.set(key, true);
			continue;
		}

		flags.set(key, nextToken);
		index += 1;
	}

	return { command, flags, help };
}

function isCommandName(value: string): value is CommandName {
	return value === "status" || value === "policy" || value === "candidates";
}

async function loadSnapshotForCli(rootDirectory: string, live: boolean): Promise<Snapshot> {
	if (live) {
		return await createAndStoreSnapshot(rootDirectory);
	}

	const state = await loadState(rootDirectory);
	if (state.latest) {
		return state.latest;
	}

	return await createAndStoreSnapshot(rootDirectory);
}

async function createAndStoreSnapshot(rootDirectory: string): Promise<Snapshot> {
	const config = await loadConfig(rootDirectory);
	const snapshot = await createSnapshot(config, { rootDirectory });
	await saveSnapshot(rootDirectory, snapshot);
	return snapshot;
}

function renderTable<T>(
	rows: T[],
	columns: Array<{ header: string; width: number; value: (row: T) => string }>,
): string {
	if (!rows.length) {
		return "(no rows)";
	}

	const widths = columns.map((column) => {
		const values = rows.map((row) => truncateCell(column.value(row), column.width).length);
		return Math.min(column.width, Math.max(column.header.length, ...values));
	});

	const header = columns.map((column, index) => padCell(column.header, widths[index])).join(" | ");
	const divider = widths.map((width) => "-".repeat(width)).join("-+-");
	const body = rows.map((row) =>
		columns
			.map((column, index) => padCell(truncateCell(column.value(row), widths[index]), widths[index]))
			.join(" | "),
	);

	return [header, divider, ...body].join("\n");
}

function truncateCell(value: string, width: number): string {
	if (value.length <= width) {
		return value;
	}

	if (width <= 3) {
		return value.slice(0, width);
	}

	return `${value.slice(0, Math.max(0, width - 3))}...`;
}

function padCell(value: string, width: number): string {
	return value.padEnd(width, " ");
}

function readStringFlag(flags: Map<string, string | boolean>, key: string): string | undefined {
	const value = flags.get(key);
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBooleanFlag(flags: Map<string, string | boolean>, key: string): boolean {
	return flags.get(key) === true;
}

function readNumberFlag(flags: Map<string, string | boolean>, key: string): number | undefined {
	const raw = readStringFlag(flags, key);
	if (!raw) {
		return undefined;
	}

	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function printHelp(command: CommandName): void {
	if (command === "policy") {
		console.log(`Usage: npm run cli -- policy [options]

Options:
  --search <text>         Filter by app name or reason
  --marker <marker>       macked | tnt | macwk | appstorrent | qiuchenly
  --confidence <level>    high | medium
  --sort <key>            priority | name | confidence | marker
  --desc                  Sort descending
  --limit <n>             Limit rows
  --json                  Print JSON
`);
		return;
	}

	if (command === "candidates") {
		console.log(`Usage: npm run cli -- candidates [options]

Options:
  --search <text>         Filter by app name or feed URL
  --marker <marker>       macked | tnt | macwk | appstorrent | qiuchenly
  --confidence <level>    high | medium
  --sort <key>            name | confidence | version | marker
  --desc                  Sort descending
  --limit <n>             Limit rows
  --json                  Print JSON
`);
		return;
	}

	console.log(`Usage: npm run cli -- [status] [options]

Commands:
  status                  Query monitored status rows (default)
  policy                  Query third-party policy rows
  candidates              Query auto-generated tracked candidates

Status options:
  --live                  Run a fresh snapshot instead of cached latest.json
  --search <text>         Filter by name, note, path, or channel
  --status <level>        update-available | up-to-date | unknown | error
  --policy <level>        normal | cautious | hold
  --category <kind>       brew | mas | configured
  --source <kind>         official | appStore | brew | github | thirdPartyStore | thirdPartyActivated | manual
  --mark <kind>           watch | avoid | safe | todo | ignore | unmarked
  --updates-only          Show only update-available rows
  --third-party-only      Show only third-party rows
  --sort <key>            priority | name | status | policy | channel | installedVersion | latestVersion | checkedAt
  --desc                  Sort descending
  --limit <n>             Limit rows
  --json                  Print JSON

Examples:
  npm run cli -- --updates-only --policy hold
  npm run cli -- status --search CleanShot --third-party-only
  npm run cli -- policy --marker macked --limit 10
  npm run cli -- candidates --confidence high
`);
}

void main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});

function annotationForStatus(status: AppStatus, annotations: AppAnnotation[]): AppAnnotation | null {
	return findMatchingAnnotation(annotationTargetFromStatus(status), annotations);
}

function matchesMarkFilter(annotation: AppAnnotation | null, mark: string): boolean {
	if (mark === "unmarked") {
		return annotation === null;
	}

	return annotation?.mark === mark;
}

function compareAnnotatedPriority(left: AppStatus, right: AppStatus, annotations: AppAnnotation[]): number {
	return (
		annotationPriority(annotationForStatus(left, annotations)) - annotationPriority(annotationForStatus(right, annotations)) ||
		priorityStatusRank(left) - priorityStatusRank(right) ||
		left.displayName.localeCompare(right.displayName, "zh-CN", { sensitivity: "base" })
	);
}

function annotationPriority(annotation: AppAnnotation | null): number {
	switch (annotation?.mark) {
		case "avoid":
			return 0;
		case "todo":
			return 1;
		case "watch":
			return 2;
		case "safe":
			return 3;
		case "ignore":
			return 4;
		default:
			return 5;
	}
}

function priorityStatusRank(status: AppStatus): number {
	return policyPriority(status.upgradePolicy) * 10 + statusSeverity(status.status);
}

function policyPriority(policy: AppStatus["upgradePolicy"]): number {
	switch (policy) {
		case "hold":
			return 0;
		case "cautious":
			return 1;
		case "normal":
		default:
			return 2;
	}
}

function statusSeverity(status: AppStatus["status"]): number {
	switch (status) {
		case "update-available":
			return 0;
		case "error":
			return 1;
		case "unknown":
			return 2;
		case "up-to-date":
		default:
			return 3;
	}
}

function markLabel(mark: AppAnnotation["mark"] | undefined): string {
	switch (mark) {
		case "watch":
			return "watch";
		case "avoid":
			return "avoid";
		case "safe":
			return "safe";
		case "ignore":
			return "ignore";
		case "todo":
			return "todo";
		default:
			return "-";
	}
}
