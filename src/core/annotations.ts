import { randomUUID } from "node:crypto";

import type {
	AppAnnotation,
	AppAnnotationInput,
	AppAnnotationTarget,
	AppStatus,
	ThirdPartyPolicyEntry,
} from "./types.ts";
import { nowIso } from "./utils.ts";

export function findMatchingAnnotation(
	target: AppAnnotationTarget,
	annotations: AppAnnotation[],
): AppAnnotation | null {
	return annotations.find((annotation) => annotationMatchesTarget(annotation, target)) ?? null;
}

export function upsertAnnotation(
	annotations: AppAnnotation[],
	input: AppAnnotationInput,
): AppAnnotation[] {
	return sortAnnotations(upsertAnnotationOnce(annotations, input));
}

export function upsertAnnotations(
	annotations: AppAnnotation[],
	inputs: AppAnnotationInput[],
): AppAnnotation[] {
	let next = [...annotations];

	for (const input of inputs) {
		next = upsertAnnotationOnce(next, input);
	}

	return sortAnnotations(next);
}

export function removeAnnotations(
	annotations: AppAnnotation[],
	targets: AppAnnotationTarget[],
): AppAnnotation[] {
	let next = [...annotations];

	for (const target of targets) {
		next = next.filter((annotation) => !annotationMatchesTarget(annotation, target));
	}

	return sortAnnotations(next);
}

function upsertAnnotationOnce(
	annotations: AppAnnotation[],
	input: AppAnnotationInput,
): AppAnnotation[] {
	const nextAnnotation: AppAnnotation = {
		recordId: findMatchingAnnotation(input, annotations)?.recordId ?? randomUUID(),
		displayName: input.displayName,
		appId: emptyToUndefined(input.appId),
		bundleId: input.bundleId ?? null,
		path: emptyToUndefined(input.path),
		mark: input.mark,
		note: emptyToUndefined(input.note),
		updatedAt: nowIso(),
	};

	return [...annotations.filter((annotation) => !annotationMatchesTarget(annotation, input)), nextAnnotation];
}

function sortAnnotations(annotations: AppAnnotation[]): AppAnnotation[] {
	return [...annotations].sort(
		(left, right) => left.displayName.localeCompare(right.displayName, "zh-CN", { sensitivity: "base" }),
	);
}

export function removeAnnotation(
	annotations: AppAnnotation[],
	target: AppAnnotationTarget,
): AppAnnotation[] {
	return annotations.filter((annotation) => !annotationMatchesTarget(annotation, target));
}

export function annotationTargetFromStatus(status: AppStatus): AppAnnotationTarget {
	return {
		displayName: status.displayName,
		appId: status.id,
		bundleId: status.bundleId ?? null,
		path: status.path,
	};
}

export function annotationTargetFromPolicy(policy: ThirdPartyPolicyEntry): AppAnnotationTarget {
	return {
		displayName: policy.name,
		bundleId: policy.bundleId ?? null,
		path: policy.path,
	};
}

function annotationMatchesTarget(annotation: AppAnnotation, target: AppAnnotationTarget): boolean {
	if (annotation.bundleId && target.bundleId && annotation.bundleId === target.bundleId) {
		return true;
	}

	if (annotation.path && target.path && annotation.path === target.path) {
		return true;
	}

	if (annotation.appId && target.appId && annotation.appId === target.appId) {
		return true;
	}

	return normalizeName(annotation.displayName) === normalizeName(target.displayName);
}

function normalizeName(value: string | null | undefined): string {
	return (value ?? "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function emptyToUndefined(value: string | null | undefined): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
