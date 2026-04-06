import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { removeAnnotation, removeAnnotations, upsertAnnotation, upsertAnnotations } from "../core/annotations.ts";
import type { AppAnnotation, AppAnnotationInput, AppAnnotationTarget } from "../core/types.ts";

export function getAnnotationsPath(rootDirectory: string): string {
	return resolve(rootDirectory, "data", "annotations.json");
}

export async function loadAnnotations(rootDirectory: string): Promise<AppAnnotation[]> {
	const filePath = getAnnotationsPath(rootDirectory);

	try {
		const raw = await readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as AppAnnotation[]) : [];
	} catch {
		return [];
	}
}

export async function saveAnnotations(rootDirectory: string, annotations: AppAnnotation[]): Promise<AppAnnotation[]> {
	const filePath = getAnnotationsPath(rootDirectory);
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(annotations, null, 2)}\n`, "utf8");
	return annotations;
}

export async function upsertStoredAnnotation(
	rootDirectory: string,
	input: AppAnnotationInput,
): Promise<AppAnnotation[]> {
	const current = await loadAnnotations(rootDirectory);
	const next = upsertAnnotation(current, input);
	return await saveAnnotations(rootDirectory, next);
}

export async function removeStoredAnnotation(
	rootDirectory: string,
	target: AppAnnotationTarget,
): Promise<AppAnnotation[]> {
	const current = await loadAnnotations(rootDirectory);
	const next = removeAnnotation(current, target);
	return await saveAnnotations(rootDirectory, next);
}

export async function upsertStoredAnnotations(
	rootDirectory: string,
	inputs: AppAnnotationInput[],
): Promise<AppAnnotation[]> {
	const current = await loadAnnotations(rootDirectory);
	const next = upsertAnnotations(current, inputs);
	return await saveAnnotations(rootDirectory, next);
}

export async function removeStoredAnnotations(
	rootDirectory: string,
	targets: AppAnnotationTarget[],
): Promise<AppAnnotation[]> {
	const current = await loadAnnotations(rootDirectory);
	const next = removeAnnotations(current, targets);
	return await saveAnnotations(rootDirectory, next);
}
