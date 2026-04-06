import type {
	GithubReleaseSource,
	HtmlRegexSource,
	JsonEndpointSource,
	RemoteVersionResult,
	SparkleAppcastSource,
	VersionSource,
} from "../core/types.ts";
import { nowIso, resolveJsonPath } from "../core/utils.ts";

const DEFAULT_HEADERS = {
	"User-Agent": "lingyi-app-watch",
	Accept: "application/json, text/plain, */*",
};

export async function fetchLatestVersion(source: VersionSource): Promise<RemoteVersionResult> {
	switch (source.kind) {
		case "githubRelease":
			return await fetchGithubRelease(source);
		case "sparkleAppcast":
			return await fetchSparkleAppcast(source);
		case "jsonEndpoint":
			return await fetchJsonEndpoint(source);
		case "htmlRegex":
			return await fetchHtmlRegex(source);
	}
}

async function fetchGithubRelease(source: GithubReleaseSource): Promise<RemoteVersionResult> {
	if (source.includePrerelease) {
		const response = await fetch(`https://api.github.com/repos/${source.repo}/releases?per_page=10`, {
			headers: DEFAULT_HEADERS,
		});
		await assertOk(response, `GitHub releases ${source.repo}`);
		const releases = (await response.json()) as Array<Record<string, unknown>>;
		const release = releases.find((item) => item && typeof item === "object");
		const tagName = stringValue(release?.tag_name);
		return {
			version: tagName ? stripPrefix(tagName, source.versionPrefix) : null,
			sourceLabel: "GitHub Releases",
			sourceUrl: stringValue(release?.html_url) ?? `https://github.com/${source.repo}/releases`,
			releasedAt: stringValue(release?.published_at) ?? nowIso(),
			notes: stringValue(release?.name) ?? undefined,
		};
	}

	const response = await fetch(`https://api.github.com/repos/${source.repo}/releases/latest`, {
		headers: DEFAULT_HEADERS,
	});
	await assertOk(response, `GitHub latest release ${source.repo}`);
	const release = (await response.json()) as Record<string, unknown>;

	return {
		version: stripPrefix(stringValue(release.tag_name), source.versionPrefix),
		sourceLabel: "GitHub Releases",
		sourceUrl: stringValue(release.html_url) ?? `https://github.com/${source.repo}/releases`,
		releasedAt: stringValue(release.published_at) ?? nowIso(),
		notes: stringValue(release.name) ?? undefined,
	};
}

async function fetchSparkleAppcast(source: SparkleAppcastSource): Promise<RemoteVersionResult> {
	const response = await fetch(source.url, {
		headers: {
			"User-Agent": DEFAULT_HEADERS["User-Agent"],
			Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
		},
	});
	await assertOk(response, `Sparkle appcast ${source.url}`);
	const xml = await response.text();

	const shortVersion =
		matchFirst(xml, /sparkle:shortVersionString="([^"]+)"/i) ??
		matchFirst(xml, /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i);
	const buildVersion =
		matchFirst(xml, /sparkle:version="([^"]+)"/i) ??
		matchFirst(xml, /<sparkle:version>([^<]+)<\/sparkle:version>/i);

	return {
		version: shortVersion ?? buildVersion,
		sourceLabel: "Sparkle Appcast",
		sourceUrl: source.url,
		releasedAt: null,
	};
}

async function fetchJsonEndpoint(source: JsonEndpointSource): Promise<RemoteVersionResult> {
	const response = await fetch(source.url, {
		headers: {
			...DEFAULT_HEADERS,
			...(source.headers ?? {}),
		},
	});
	await assertOk(response, `JSON endpoint ${source.url}`);
	const payload = (await response.json()) as unknown;
	const version = resolveJsonPath(payload, source.versionPath);

	return {
		version: typeof version === "string" || typeof version === "number" ? String(version) : null,
		sourceLabel: "JSON Endpoint",
		sourceUrl: source.url,
		releasedAt: null,
	};
}

async function fetchHtmlRegex(source: HtmlRegexSource): Promise<RemoteVersionResult> {
	const response = await fetch(source.url, {
		headers: DEFAULT_HEADERS,
	});
	await assertOk(response, `HTML page ${source.url}`);
	const html = await response.text();
	const matcher = new RegExp(source.pattern, source.flags);
	const match = matcher.exec(html);
	const groupIndex = source.matchGroup ?? 1;

	return {
		version: match?.[groupIndex] ?? null,
		sourceLabel: "HTML Regex",
		sourceUrl: source.url,
		releasedAt: null,
	};
}

async function assertOk(response: Response, label: string): Promise<void> {
	if (!response.ok) {
		throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
	}
}

function stripPrefix(value: string | null, prefix?: string): string | null {
	if (!value) {
		return null;
	}

	if (!prefix) {
		return value.replace(/^v(?=\d)/i, "");
	}

	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function matchFirst(input: string, pattern: RegExp): string | null {
	const match = pattern.exec(input);
	return match?.[1]?.trim() ?? null;
}
