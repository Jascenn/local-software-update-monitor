import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { AppBundleRecord, ThirdPartyPolicyEntry } from "./types.ts";

export async function loadThirdPartyPolicy(rootDirectory: string): Promise<ThirdPartyPolicyEntry[]> {
	const filePath = resolve(rootDirectory, "data", "third-party-policy.json");

	try {
		const raw = await readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as ThirdPartyPolicyEntry[]) : [];
	} catch {
		return [];
	}
}

export function matchPolicyForBundle(
	bundle: AppBundleRecord | null | undefined,
	policies: ThirdPartyPolicyEntry[],
): ThirdPartyPolicyEntry | null {
	if (!bundle) {
		return null;
	}

	return (
		policies.find((policy) => policy.path === bundle.path) ??
		policies.find((policy) => !!bundle.bundleId && policy.bundleId === bundle.bundleId) ??
		policies.find((policy) => normalizeName(policy.name) === normalizeName(bundle.name)) ??
		null
	);
}

export function matchPolicyForName(
	name: string,
	policies: ThirdPartyPolicyEntry[],
): ThirdPartyPolicyEntry | null {
	const normalizedTarget = normalizeName(name);

	if (!normalizedTarget) {
		return null;
	}

	const exact = policies.filter((policy) => normalizeName(policy.name) === normalizedTarget);
	if (exact.length === 1) {
		return exact[0];
	}

	const fuzzy = policies
		.map((policy) => ({
			policy,
			score: fuzzyNameScore(normalizedTarget, normalizeName(policy.name)),
		}))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score);

	if (!fuzzy.length) {
		return null;
	}

	if (fuzzy.length === 1 || fuzzy[0].score > fuzzy[1].score) {
		return fuzzy[0].policy;
	}

	return null;
}

export function findBestBundleForName(name: string, bundles: AppBundleRecord[]): AppBundleRecord | null {
	const normalizedTarget = normalizeName(name);

	if (!normalizedTarget) {
		return null;
	}

	const exact = bundles.filter((bundle) => normalizeName(bundle.name) === normalizedTarget);
	if (exact.length === 1) {
		return exact[0];
	}

	const fuzzy = bundles
		.map((bundle) => ({
			bundle,
			score: fuzzyNameScore(normalizedTarget, normalizeName(bundle.name)),
		}))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score);

	if (!fuzzy.length) {
		return null;
	}

	if (fuzzy.length === 1 || fuzzy[0].score > fuzzy[1].score) {
		return fuzzy[0].bundle;
	}

	return null;
}

function fuzzyNameScore(left: string, right: string): number {
	if (!left || !right) {
		return 0;
	}

	if (left === right) {
		return 100;
	}

	const shorterLength = Math.min(left.length, right.length);
	const longerLength = Math.max(left.length, right.length);
	const contains = left.includes(right) || right.includes(left);

	if (contains && shorterLength >= 6 && longerLength - shorterLength <= 3) {
		return 80 - (longerLength - shorterLength);
	}

	return 0;
}

function normalizeName(value: string | null | undefined): string {
	return (value ?? "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}
