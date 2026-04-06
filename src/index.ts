import { createServer } from "node:http";
import { cwd } from "node:process";

import { loadConfig } from "./core/config.ts";
import { createSnapshot } from "./core/monitor.ts";
import { loadSourceAudit } from "./core/source-audit.ts";
import { loadThirdPartyPolicy } from "./core/source-policy.ts";
import { loadTrackedAppCandidates } from "./core/tracked-candidates.ts";
import { executeStatusUpgrade, planStatusAction } from "./core/upgrade.ts";
import type { AppAnnotationInput, AppAnnotationTarget } from "./core/types.ts";
import {
	loadAnnotations,
	removeStoredAnnotation,
	removeStoredAnnotations,
	upsertStoredAnnotation,
	upsertStoredAnnotations,
} from "./storage/annotations.ts";
import { loadState, saveSnapshot } from "./storage/state.ts";
import { renderDashboard } from "./ui/dashboard.ts";

async function main(): Promise<void> {
	const rootDirectory = cwd();
	const config = await loadConfig(rootDirectory);
	const state = await loadState(rootDirectory);

	if (process.argv.includes("--check-once")) {
		const snapshot = await createSnapshot(config, { rootDirectory });
		await saveSnapshot(rootDirectory, snapshot);
		console.log(
			JSON.stringify(
				{
					generatedAt: snapshot.generatedAt,
					summary: snapshot.summary,
				},
				null,
				2,
			),
		);
		return;
	}

	let latestSnapshot = state.latest;
	let history = state.history;
	let runningCheck: Promise<void> | null = null;

	const runCheck = async (): Promise<void> => {
		if (runningCheck) {
			return await runningCheck;
		}

		runningCheck = (async () => {
			const snapshot = await createSnapshot(config, { rootDirectory });
			const stored = await saveSnapshot(rootDirectory, snapshot);
			latestSnapshot = stored.latest;
			history = stored.history;
		})();

		try {
			await runningCheck;
		} finally {
			runningCheck = null;
		}
	};

	if (!latestSnapshot) {
		void runCheck().catch((error: Error) => {
			console.error(error.message);
		});
	}

	setInterval(() => {
		void runCheck().catch((error: Error) => {
			console.error(error.message);
		});
	}, config.pollIntervalMs);

	const server = createServer(async (request, response) => {
		try {
			const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
			const isGetLike = request.method === "GET" || request.method === "HEAD";

			if (isGetLike && requestUrl.pathname === "/") {
				const [sourcePolicy, annotations] = await Promise.all([
					loadThirdPartyPolicy(rootDirectory),
					loadAnnotations(rootDirectory),
				]);
				response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				response.end(
					request.method === "HEAD"
						? undefined
						: renderDashboard(latestSnapshot, config.pollIntervalMs, sourcePolicy, annotations),
				);
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/status") {
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(latestSnapshot, null, 2));
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/history") {
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(history, null, 2));
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/inventory") {
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(
					request.method === "HEAD" ? undefined : JSON.stringify(latestSnapshot?.inventory ?? null, null, 2),
				);
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/source-audit") {
				const sourceAudit = await loadSourceAudit(rootDirectory);
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(sourceAudit, null, 2));
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/source-policy") {
				const sourcePolicy = await loadThirdPartyPolicy(rootDirectory);
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(sourcePolicy, null, 2));
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/tracked-candidates") {
				const candidates = await loadTrackedAppCandidates(rootDirectory);
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(candidates, null, 2));
				return;
			}

			if (isGetLike && requestUrl.pathname === "/api/annotations") {
				const annotations = await loadAnnotations(rootDirectory);
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(annotations, null, 2));
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/annotations") {
				const payload = await readJsonBody(request);
				const action = isAction(payload.action) ? payload.action : "upsert";
				const target = toAnnotationTarget(payload.target);

				if (!target) {
					response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify({ error: "Invalid annotation target" }));
					return;
				}

				const annotations =
					action === "delete"
						? await removeStoredAnnotation(rootDirectory, target)
						: await upsertStoredAnnotation(rootDirectory, toAnnotationInput(payload, target));

				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(JSON.stringify(annotations, null, 2));
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/annotations/batch") {
				const payload = await readJsonBody(request);
				const action = isAction(payload.action) ? payload.action : "upsert";

				if (action === "delete") {
					const targets = toAnnotationTargets(payload.targets);
					if (!targets.length) {
						response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
						response.end(JSON.stringify({ error: "Invalid annotation targets" }));
						return;
					}

					const annotations = await removeStoredAnnotations(rootDirectory, targets);
					response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify(annotations, null, 2));
					return;
				}

				const inputs = toAnnotationInputs(payload.entries);
				if (!inputs.length) {
					response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify({ error: "Invalid annotation entries" }));
					return;
				}

				const annotations = await upsertStoredAnnotations(rootDirectory, inputs);
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(JSON.stringify(annotations, null, 2));
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/upgrade") {
				const payload = await readJsonBody(request);
				const statusId = stringValue(payload.id);
				if (!statusId) {
					response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify({ ok: false, error: "Missing status id" }));
					return;
				}

				if (!latestSnapshot) {
					await runCheck();
				}

				const status = latestSnapshot?.statuses.find((item) => item.id === statusId) ?? null;
				if (!status) {
					response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify({ ok: false, error: "Status not found" }));
					return;
				}

				const annotations = await loadAnnotations(rootDirectory);
				const plan = planStatusAction(status, annotations);
				if (plan.kind !== "upgrade") {
					const message = plan.kind === "blocked" ? plan.reason : "Open the source page instead.";
					response.writeHead(409, { "Content-Type": "application/json; charset=utf-8" });
					response.end(JSON.stringify({ ok: false, action: plan.kind, message }));
					return;
				}

				const result = await executeStatusUpgrade(plan);
				if (!result.ok) {
					response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
					response.end(
						JSON.stringify({
							ok: false,
							action: "upgrade",
							message: truncateMessage(firstNonEmpty(result.stderr, result.stdout) ?? "Upgrade failed"),
						}),
					);
					return;
				}

				await runCheck();
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(
					JSON.stringify({
						ok: true,
						action: "upgrade",
						message: truncateMessage(firstNonEmpty(result.stdout, result.stderr) ?? "Upgrade completed"),
						snapshot: latestSnapshot,
					}),
				);
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/check") {
				await runCheck();
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(JSON.stringify(latestSnapshot, null, 2));
				return;
			}

			response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
			response.end(JSON.stringify({ error: "Not found" }));
		} catch (error) {
			response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
			response.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : "Unknown server error",
				}),
			);
		}
	});

	server.on("error", (error: Error) => {
		console.error(error.message);
		process.exitCode = 1;
	});

	server.listen(config.port, "127.0.0.1", () => {
		console.log(`Software update monitor running at http://127.0.0.1:${config.port}`);
	});
}

void main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];

	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	const raw = Buffer.concat(chunks).toString("utf8").trim();
	if (!raw) {
		return {};
	}

	const parsed = JSON.parse(raw) as unknown;
	return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

function isAction(value: unknown): value is "upsert" | "delete" {
	return value === "upsert" || value === "delete";
}

function toAnnotationTarget(value: unknown): AppAnnotationTarget | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const target = value as Record<string, unknown>;
	const displayName = stringValue(target.displayName);
	if (!displayName) {
		return null;
	}

	return {
		displayName,
		appId: stringValue(target.appId) ?? undefined,
		bundleId: stringValue(target.bundleId) ?? null,
		path: stringValue(target.path) ?? undefined,
	};
}

function toAnnotationInput(
	payload: Record<string, unknown>,
	target: AppAnnotationTarget,
): AppAnnotationInput {
	const mark = stringValue(payload.mark);
	if (!isAnnotationMark(mark)) {
		throw new Error("Invalid annotation mark");
	}

	return {
		...target,
		mark,
		note: stringValue(payload.note) ?? undefined,
	};
}

function toAnnotationTargets(value: unknown): AppAnnotationTarget[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map(toAnnotationTarget).filter((target): target is AppAnnotationTarget => target !== null);
}

function toAnnotationInputs(value: unknown): AppAnnotationInput[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const inputs: AppAnnotationInput[] = [];

	for (const item of value) {
		if (!item || typeof item !== "object") {
			continue;
		}

		const payload = item as Record<string, unknown>;
		const target = toAnnotationTarget(payload.target);
		if (!target) {
			continue;
		}

		try {
			inputs.push(toAnnotationInput(payload, target));
		} catch {
			continue;
		}
	}

	return inputs;
}

function isAnnotationMark(value: string | null): value is AppAnnotationInput["mark"] {
	return value === "watch" || value === "avoid" || value === "safe" || value === "ignore" || value === "todo";
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
	for (const value of values) {
		if (value && value.trim()) {
			return value.trim();
		}
	}

	return null;
}

function truncateMessage(value: string | null | undefined, maxLength = 240): string | null {
	if (!value) {
		return null;
	}

	const normalized = value.replaceAll(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
