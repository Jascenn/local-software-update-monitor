import { homedir } from "node:os";

export function nowIso(): string {
	return new Date().toISOString();
}

export function expandHomeDirectory(inputPath: string): string {
	if (inputPath === "~") {
		return homedir();
	}

	if (inputPath.startsWith("~/")) {
		return `${homedir()}${inputPath.slice(1)}`;
	}

	return inputPath;
}

export function normalizeVersion(version: string | null | undefined): string | null {
	if (!version) {
		return null;
	}

	const trimmed = version.trim();

	if (!trimmed) {
		return null;
	}

	return trimmed.replace(/^v(?=\d)/i, "");
}

export function compareVersions(
	leftVersion: string | null | undefined,
	rightVersion: string | null | undefined,
): number | null {
	const left = normalizeVersion(leftVersion);
	const right = normalizeVersion(rightVersion);

	if (!left || !right) {
		return null;
	}

	if (left === right) {
		return 0;
	}

	const leftParts = left.split(/[^a-zA-Z0-9]+/).filter(Boolean);
	const rightParts = right.split(/[^a-zA-Z0-9]+/).filter(Boolean);
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index += 1) {
		const leftPart = leftParts[index] ?? "0";
		const rightPart = rightParts[index] ?? "0";
		const leftNumeric = /^\d+$/.test(leftPart);
		const rightNumeric = /^\d+$/.test(rightPart);

		if (leftNumeric && rightNumeric) {
			const delta = Number(leftPart) - Number(rightPart);
			if (delta !== 0) {
				return delta > 0 ? 1 : -1;
			}
			continue;
		}

		const delta = leftPart.localeCompare(rightPart, undefined, {
			numeric: true,
			sensitivity: "base",
		});
		if (delta !== 0) {
			return delta > 0 ? 1 : -1;
		}
	}

	return left.localeCompare(right, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export function isRemoteNewer(
	currentVersion: string | null | undefined,
	latestVersion: string | null | undefined,
): boolean | null {
	const comparison = compareVersions(currentVersion, latestVersion);

	if (comparison === null) {
		return null;
	}

	return comparison < 0;
}

export function resolveJsonPath(value: unknown, path: string): unknown {
	return path
		.split(".")
		.filter(Boolean)
		.reduce<unknown>((current, segment) => {
			if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
				return (current as Record<string, unknown>)[segment];
			}
			return undefined;
		}, value);
}

export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
	if (value === null || value === undefined) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}
