import { annotationTargetFromStatus, findMatchingAnnotation } from "./annotations.ts";
import { runCommand, type CommandResult } from "./command.ts";
import type { AppAnnotation, AppStatus } from "./types.ts";

const BREW_ENV = {
	HOMEBREW_NO_AUTO_UPDATE: "1",
	HOMEBREW_NO_INSTALL_CLEANUP: "1",
	HOMEBREW_CACHE: "/tmp/homebrew-cache",
};

export type StatusActionPlan =
	| {
			kind: "upgrade";
			label: "升级";
			command: "brew" | "mas";
			args: string[];
	  }
	| {
			kind: "link";
			label: "打开来源";
			url: string;
	  }
	| {
			kind: "blocked";
			label: string;
			reason: string;
	  };

export function planStatusAction(status: AppStatus, annotations: AppAnnotation[]): StatusActionPlan {
	const annotation = findMatchingAnnotation(annotationTargetFromStatus(status), annotations);

	if (status.category === "configured") {
		if (status.sourceUrl) {
			return {
				kind: "link",
				label: "打开来源",
				url: status.sourceUrl,
			};
		}

		return {
			kind: "blocked",
			label: "无来源",
			reason: "当前追踪项没有可直接打开的来源地址。",
		};
	}

	if (annotation?.mark === "ignore") {
		return {
			kind: "blocked",
			label: "已忽略",
			reason: "这项软件已被你标记为忽略。",
		};
	}

	if (annotation?.mark === "avoid") {
		return {
			kind: "blocked",
			label: "不要升级",
			reason: "这项软件已被你人工标记为不要升级。",
		};
	}

	if (annotation?.mark === "todo") {
		return {
			kind: "blocked",
			label: "待核验",
			reason: "这项软件还在待核验状态，暂不允许一键升级。",
		};
	}

	if (status.upgradePolicy === "hold" || status.activationSource === "thirdPartyActivated") {
		return {
			kind: "blocked",
			label: "禁止升级",
			reason: "第三方激活或暂缓升级的软件不提供一键升级。",
		};
	}

	if (status.upgradePolicy === "cautious" && annotation?.mark !== "safe") {
		return {
			kind: "blocked",
			label: "需确认",
			reason: "谨慎升级的软件需要先人工标记为“确认可升”。",
		};
	}

	if (status.category === "brew") {
		const match = status.id.match(/^brew:(formula|cask):(.+)$/);
		if (!match) {
			return {
				kind: "blocked",
				label: "不可升级",
				reason: "无法识别 brew 升级目标。",
			};
		}

		return {
			kind: "upgrade",
			label: "升级",
			command: "brew",
			args: ["upgrade", `--${match[1]}`, match[2]],
		};
	}

	if (status.category === "mas") {
		const match = status.id.match(/^mas:(\d+)$/);
		if (!match) {
			return {
				kind: "blocked",
				label: "不可升级",
				reason: "无法识别 Mac App Store 升级目标。",
			};
		}

		return {
			kind: "upgrade",
			label: "升级",
			command: "mas",
			args: ["upgrade", match[1]],
		};
	}

	return {
		kind: "blocked",
		label: "不可升级",
		reason: "当前类型还没有实现一键升级。",
	};
}

export async function executeStatusUpgrade(plan: StatusActionPlan): Promise<CommandResult> {
	if (plan.kind !== "upgrade") {
		throw new Error("Status action is not an upgrade operation");
	}

	return await runCommand(plan.command, plan.args, {
		timeoutMs: 30 * 60 * 1000,
		env: plan.command === "brew" ? BREW_ENV : undefined,
	});
}
