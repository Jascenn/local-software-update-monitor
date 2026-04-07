import type { AppAnnotation, Snapshot, ThirdPartyPolicyEntry } from "../core/types.ts";

export function renderDashboard(
	snapshot: Snapshot | null,
	pollIntervalMs: number,
	thirdPartyPolicy: ThirdPartyPolicyEntry[],
	annotations: AppAnnotation[],
): string {
	const title = "Lingyi App Watch";
	const serialized = JSON.stringify(snapshot).replace(/</g, "\\u003c");
	const serializedPolicy = JSON.stringify(thirdPartyPolicy).replace(/</g, "\\u003c");
	const serializedAnnotations = JSON.stringify(annotations).replace(/</g, "\\u003c");

	return `<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="本地优先的 macOS 软件更新与第三方来源风险看板。" />
	<title>${title}</title>
	<style>
		:root {
			--bg: #fbfbfa;
			--card: #ffffff;
			--card-strong: #fcfcfb;
			--line: #ebebea;
			--line-strong: #d9d9d6;
			--text: #37352f;
			--muted: #787774;
			--ok: #2f7d4b;
			--warn: #b36b2b;
			--error: #b24c45;
			--unknown: #8b8f97;
			--accent: #2f3437;
			--accent-soft: #f6f5f4;
			--font-body: "LXGW WenKai", "LXGWWenKai", "霞鹜文楷", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", serif;
			--font-ui: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
			--font-heading: "LXGW WenKai", "LXGWWenKai", "霞鹜文楷", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", serif;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			font-family: var(--font-body);
			background: var(--bg);
			color: var(--text);
			-webkit-font-smoothing: antialiased;
			text-rendering: optimizeLegibility;
		}

		main {
			max-width: 1240px;
			margin: 0 auto;
			padding: 28px 24px 64px;
		}

		header {
			display: grid;
			gap: 10px;
			margin-bottom: 18px;
		}

		h1 {
			margin: 0;
			font-family: var(--font-heading);
			font-size: clamp(2rem, 3.2vw, 2.8rem);
			line-height: 1.08;
			letter-spacing: -0.03em;
			font-weight: 680;
		}

		.subhead {
			color: var(--muted);
			max-width: 720px;
			font-size: 0.94rem;
			line-height: 1.55;
		}

		.summary {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 8px;
			margin: 18px 0 20px;
		}

		.card {
			background: var(--card);
			border: 1px solid var(--line);
			border-radius: 10px;
			padding: 13px 14px;
			box-shadow: none;
		}

		.card strong {
			display: block;
			font-size: 1.36rem;
			line-height: 1.1;
			margin-bottom: 5px;
		}

		.summary .card span {
			color: var(--muted);
			font-size: 0.77rem;
			font-family: var(--font-ui);
		}

		.summary-card {
			width: 100%;
			text-align: left;
			cursor: pointer;
			background: var(--card);
			color: var(--text);
		}

		.summary-card:hover {
			border-color: var(--line-strong);
			background: var(--card-strong);
		}

		.summary-card.active {
			border-color: var(--accent);
			background: #f4f5f5;
		}

		.summary-card strong {
			color: var(--text);
			font-family: var(--font-ui);
			font-weight: 700;
			letter-spacing: -0.02em;
		}

		.controls {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			align-items: center;
			margin-bottom: 16px;
		}

		.review-panel {
			display: grid;
			gap: 12px;
			margin: 0 0 16px;
			padding: 16px;
			background: linear-gradient(180deg, #ffffff 0%, #fcfcfb 100%);
		}

		.review-head {
			display: flex;
			align-items: end;
			justify-content: space-between;
			gap: 14px;
		}

		.review-title {
			margin: 0;
			font-family: var(--font-heading);
			font-size: 1.12rem;
			font-weight: 650;
			letter-spacing: -0.03em;
		}

		.review-copy {
			color: var(--muted);
			max-width: 760px;
			font-size: 0.87rem;
			line-height: 1.55;
		}

		.review-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 10px;
		}

		.review-card {
			display: grid;
			gap: 10px;
			padding: 14px;
			border: 1px solid var(--line);
			border-radius: 10px;
			background: #ffffff;
		}

		.review-card.risk {
			border-color: rgba(178, 76, 69, 0.18);
			background: #fffdfd;
		}

		.review-card strong {
			display: block;
			font-size: 1.35rem;
			line-height: 1.1;
			margin-bottom: 4px;
			font-family: var(--font-ui);
		}

		.review-card-title {
			font-size: 0.92rem;
			font-weight: 650;
			line-height: 1.4;
		}

		.review-card-copy {
			color: var(--muted);
			font-size: 0.83rem;
			line-height: 1.5;
			font-family: var(--font-ui);
		}

		.review-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-top: 2px;
		}

		.review-button {
			background: #ffffff;
			color: var(--text);
			border-color: var(--line-strong);
			font-size: 0.8rem;
			padding: 7px 11px;
		}

		.review-button:hover {
			background: var(--accent-soft);
		}

		.view-switch {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin: 0 0 14px;
		}

		.view-tab {
			background: var(--accent-soft);
			color: var(--text);
			border: 1px solid transparent;
		}

		.view-tab.active {
			background: var(--accent);
			border-color: var(--accent);
			color: #ffffff;
		}

		.section-head {
			display: flex;
			align-items: end;
			justify-content: space-between;
			gap: 16px;
			margin: 18px 0 8px;
		}

		.section-head.compact {
			margin: 0 0 12px;
			align-items: start;
		}

		.section-title {
			margin: 0;
			font-family: var(--font-heading);
			font-size: 1.18rem;
			letter-spacing: -0.03em;
			font-weight: 650;
		}

		.section-copy {
			color: var(--muted);
			max-width: 760px;
			font-size: 0.88rem;
			line-height: 1.5;
		}

		button,
		input,
		select,
		textarea,
		option {
			font-family: var(--font-ui);
			font-size: inherit;
			line-height: inherit;
		}

		button {
			border: 1px solid var(--line-strong);
			border-radius: 8px;
			padding: 9px 12px;
			background: var(--accent);
			color: #ffffff;
			cursor: pointer;
			transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
			font-weight: 600;
		}

		button:hover {
			transform: none;
		}

		button:disabled {
			opacity: 0.5;
			cursor: wait;
			transform: none;
		}

		button.secondary {
			background: #ffffff;
			color: var(--text);
			border-color: var(--line-strong);
		}

		button.ghost {
			background: var(--accent-soft);
			color: var(--text);
			border: 1px solid transparent;
		}

		.filter-panel {
			padding: 14px 16px;
			margin-bottom: 12px;
			background: var(--card);
		}

		.toolbar-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
			gap: 10px;
			align-items: end;
		}

		.field {
			display: grid;
			gap: 8px;
		}

		.field.wide {
			grid-column: span 2;
		}

		.field span {
			font-size: 0.72rem;
			color: var(--muted);
			font-weight: 600;
			letter-spacing: 0.04em;
			font-family: var(--font-ui);
		}

		input,
		select,
		textarea {
			width: 100%;
			border: 1px solid var(--line);
			border-radius: 8px;
			padding: 9px 11px;
			background: #ffffff;
			color: var(--text);
			line-height: 1.45;
		}

		select {
			appearance: none;
			background-image:
				linear-gradient(45deg, transparent 50%, rgba(55, 53, 47, 0.55) 50%),
				linear-gradient(135deg, rgba(55, 53, 47, 0.55) 50%, transparent 50%);
			background-position:
				calc(100% - 16px) calc(50% - 2px),
				calc(100% - 10px) calc(50% - 2px);
			background-size: 6px 6px, 6px 6px;
			background-repeat: no-repeat;
			padding-right: 34px;
		}

		option {
			font-weight: 500;
		}

		textarea {
			min-height: 112px;
			resize: vertical;
		}

		.button-stack {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}

		.chip-row {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-top: 10px;
		}

		.chip {
			border-radius: 999px;
			border: 1px solid transparent;
			background: var(--accent-soft);
			color: var(--text);
			padding: 7px 11px;
			font-weight: 600;
		}

		.chip.active {
			background: var(--accent);
			border-color: var(--accent);
			color: #ffffff;
		}

		.result-meta {
			margin-top: 12px;
			color: var(--muted);
			font-size: 0.84rem;
			line-height: 1.5;
			font-family: var(--font-ui);
		}

		.bulk-meta {
			font-size: 1rem;
			font-weight: 650;
			font-family: var(--font-ui);
		}

		.select-toggle {
			width: 18px;
			height: 18px;
			accent-color: var(--accent);
			cursor: pointer;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			background: transparent;
			table-layout: fixed;
		}

		th, td {
			padding: 13px 12px;
			text-align: left;
			border-bottom: 1px solid var(--line);
			vertical-align: top;
		}

		th {
			font-size: 0.76rem;
			font-weight: 600;
			color: var(--muted);
			background: var(--card-strong);
			position: sticky;
			top: 0;
			z-index: 1;
		}

		th:nth-child(1), td:nth-child(1) { width: 48px; }
		th:nth-child(2), td:nth-child(2) { width: 24%; }
		th:nth-child(3), td:nth-child(3) { width: 17%; }
		th:nth-child(4), td:nth-child(4) { width: 18%; }
		th:nth-child(5), td:nth-child(5) { width: 18%; }
		th:nth-child(6), td:nth-child(6) { width: 23%; }

		.table-sort {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			color: inherit;
			font-weight: 600;
			font-size: 0.76rem;
			font-family: var(--font-ui);
		}

		.table-sort:hover {
			transform: none;
			color: var(--text);
		}

		.table-sort.active {
			color: var(--text);
		}

		.sort-indicator {
			font-size: 0.68rem;
			color: var(--muted);
		}

		tbody tr:hover {
			background: #fafaf9;
		}

		.badge {
			display: inline-flex;
			align-items: center;
			padding: 4px 8px;
			border-radius: 999px;
			font-size: 0.74rem;
			font-weight: 600;
			font-family: var(--font-ui);
		}

		.badge.up-to-date { background: rgba(47, 123, 65, 0.12); color: var(--ok); }
		.badge.update-available { background: rgba(184, 92, 38, 0.14); color: var(--warn); }
		.badge.error { background: rgba(161, 52, 52, 0.14); color: var(--error); }
		.badge.unknown { background: rgba(111, 107, 93, 0.14); color: var(--unknown); }
		.badge.normal { background: rgba(32, 75, 87, 0.1); color: var(--accent); }
		.badge.cautious { background: rgba(184, 92, 38, 0.16); color: var(--warn); }
		.badge.hold { background: rgba(161, 52, 52, 0.16); color: var(--error); }
		.badge.mark-watch { background: rgba(32, 75, 87, 0.16); color: var(--accent); }
		.badge.mark-avoid { background: rgba(161, 52, 52, 0.16); color: var(--error); }
		.badge.mark-safe { background: rgba(47, 123, 65, 0.14); color: var(--ok); }
		.badge.mark-ignore { background: rgba(111, 107, 93, 0.14); color: var(--unknown); }
		.badge.mark-todo { background: rgba(184, 92, 38, 0.16); color: var(--warn); }

		.row-hold {
			background: rgba(178, 76, 69, 0.03);
		}

		.row-cautious {
			background: rgba(179, 107, 43, 0.03);
		}

		.muted {
			color: var(--muted);
			font-size: 0.86rem;
			line-height: 1.5;
			font-family: var(--font-ui);
		}

		.empty {
			padding: 24px;
			background: var(--card);
			border: 1px solid var(--line);
			border-radius: 10px;
		}

		.row-action {
			margin-top: 0;
			padding: 6px 10px;
			font-size: 0.78rem;
		}

		a.row-action {
			display: inline-flex;
			align-items: center;
			border-radius: 999px;
			border: 1px solid var(--line);
			color: var(--text);
			text-decoration: none;
			background: #ffffff;
		}

		.row-action-upgrade {
			background: var(--accent);
			color: #ffffff;
			border-color: var(--accent);
		}

		.action-stack {
			display: grid;
			gap: 8px;
			align-content: start;
		}

		.action-hint {
			padding: 9px 10px;
			border-radius: 8px;
			border: 1px solid var(--line);
			background: #fafaf9;
		}

		.action-hint strong {
			display: block;
			font-size: 0.84rem;
			margin-bottom: 4px;
		}

		.action-hint.blocked {
			background: rgba(161, 52, 52, 0.08);
			border-color: rgba(161, 52, 52, 0.18);
		}

		.action-hint.link {
			background: rgba(32, 75, 87, 0.08);
			border-color: rgba(32, 75, 87, 0.18);
		}

		.policy-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 12px;
		}

		.policy-toolbar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 12px;
			margin-bottom: 10px;
		}

		.policy-card {
			background: #ffffff;
			border: 1px solid var(--line);
			border-radius: 10px;
			padding: 14px;
			box-shadow: none;
		}

		.policy-card.hold {
			background: #ffffff;
			border-color: rgba(178, 76, 69, 0.18);
		}

		.policy-card strong {
			display: block;
			margin-bottom: 8px;
			font-size: 1.02rem;
		}

		.policy-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 10px;
		}

		.policy-path {
			color: var(--muted);
			font-size: 0.86rem;
			word-break: break-all;
			margin-top: 10px;
		}

		.table-shell {
			border: 1px solid var(--line);
			border-radius: 10px;
			background: var(--card);
			overflow: hidden;
		}

		.focus-board {
			display: grid;
			gap: 14px;
			margin-bottom: 14px;
		}

		.focus-section {
			background: var(--card);
			border: 1px solid var(--line);
			border-radius: 10px;
			padding: 16px;
		}

		.focus-section-head {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 12px;
		}

		.focus-section-title {
			font-size: 1rem;
			font-weight: 650;
			letter-spacing: -0.02em;
		}

		.focus-section-note {
			color: var(--muted);
			font-size: 0.82rem;
			font-family: var(--font-ui);
		}

		.focus-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
			gap: 10px;
		}

		.focus-card {
			display: grid;
			gap: 10px;
			padding: 14px;
			border: 1px solid var(--line);
			border-radius: 10px;
			background: #ffffff;
		}

		.focus-card.risk {
			border-color: rgba(178, 76, 69, 0.18);
			background: #fffdfd;
		}

		.focus-card-header {
			display: flex;
			align-items: start;
			justify-content: space-between;
			gap: 12px;
		}

		.focus-card-title {
			font-size: 0.96rem;
			font-weight: 650;
			line-height: 1.35;
		}

		.focus-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}

		.focus-versions {
			font-size: 0.86rem;
			color: var(--muted);
			font-family: var(--font-ui);
		}

		.focus-note {
			font-size: 0.84rem;
			line-height: 1.55;
			color: var(--text);
		}

		.focus-footer {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: center;
		}

		.focus-footer .muted {
			font-size: 0.8rem;
		}

		.head-stack {
			display: grid;
			gap: 6px;
		}

		.head-label {
			font-size: 0.72rem;
			font-weight: 600;
			letter-spacing: 0.04em;
		}

		.column-buttons {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}

		.app-cell {
			display: grid;
			gap: 7px;
		}

		.app-title {
			font-size: 0.95rem;
			font-weight: 600;
			line-height: 1.35;
		}

		.property-row {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}

		.property-pill {
			display: inline-flex;
			align-items: center;
			padding: 4px 8px;
			border-radius: 999px;
			background: var(--accent-soft);
			color: var(--muted);
			font-size: 0.73rem;
			font-weight: 600;
			text-decoration: none;
			font-family: var(--font-ui);
		}

		.version-cell {
			display: grid;
			gap: 5px;
		}

		.version-line {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
		}

		.version-arrow {
			color: var(--muted);
			font-size: 0.84rem;
		}

		.signal-cell {
			display: grid;
			gap: 6px;
		}

		.badge-stack {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}

		.note-cell {
			display: grid;
			gap: 6px;
		}

		.note-block {
			color: var(--text);
			font-size: 0.84rem;
			line-height: 1.55;
		}

		.note-block.secondary {
			color: var(--muted);
		}

		.note-block.clamp {
			display: -webkit-box;
			-webkit-line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}

		.annotation-overlay {
			position: fixed;
			inset: 0;
			padding: 20px;
			background: rgba(15, 15, 15, 0.22);
			backdrop-filter: blur(2px);
			display: none;
			align-items: center;
			justify-content: center;
			z-index: 1000;
		}

		.annotation-overlay.open {
			display: flex;
		}

		.annotation-dialog {
			width: min(760px, 100%);
			background: var(--card);
		}

		.annotation-target {
			font-size: 1.15rem;
			font-weight: 700;
		}

		@media (max-width: 960px) {
			.field.wide {
				grid-column: span 1;
			}
		}

		@media (max-width: 800px) {
			table, thead, tbody, tr, th, td {
				display: block;
			}

			thead {
				display: none;
			}

			tr {
				border-bottom: 1px solid var(--line);
				padding: 6px 0;
			}

			td {
				padding: 10px 14px;
			}

			td::before {
				content: attr(data-label);
				display: block;
				font-size: 0.76rem;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				color: var(--muted);
				margin-bottom: 4px;
			}
		}
	</style>
</head>
<body>
	<main>
		<header>
			<h1>${title}</h1>
			<div class="subhead">本地优先的 macOS 软件更新与来源风险看板。自动监控 Homebrew 和 Mac App Store，并用 GitHub Release、官网 Appcast、JSON 接口和第三方下载页补齐版本来源。</div>
			<div class="muted" id="meta"></div>
		</header>
		<section class="summary" id="summary"></section>
		<div class="controls">
			<button id="refreshButton">立即检查</button>
			<span class="muted">自动轮询间隔：${Math.round(pollIntervalMs / 60_000)} 分钟</span>
		</div>
		<div class="view-switch" id="viewTabs"></div>
		<section class="card review-panel" id="reviewPanel" hidden></section>
		<section id="focusView"></section>

		<section class="card filter-panel" id="batchPanel">
			<div class="section-head compact">
				<div>
					<h2 class="section-title">批量标记</h2>
					<div class="section-copy">先在主表或第三方卡片里多选，再一次性写入同一个安全标记。适合整批标成“不要升级”或“待核验”。</div>
				</div>
			</div>
			<div class="toolbar-grid">
				<div class="field wide">
					<span>当前选择</span>
					<div class="bulk-meta" id="bulkMeta"></div>
					<div class="muted">批量操作会写入本地记忆库 data/annotations.json，并参与后续排序和筛选。</div>
				</div>
				<label class="field">
					<span>批量标记</span>
					<select id="bulkMark">
						<option value="watch">重点关注</option>
						<option value="avoid">不要升级</option>
						<option value="safe">确认可升</option>
						<option value="todo">待核验</option>
						<option value="ignore">忽略</option>
					</select>
				</label>
				<label class="field wide">
					<span>批量备注</span>
					<input id="bulkNote" type="text" placeholder="可留空；留空时保留原备注，只更新标记。" />
				</label>
				<div class="field">
					<span>操作</span>
					<div class="button-stack">
						<button id="bulkApplyButton" type="button">保存到所选</button>
						<button class="secondary" id="bulkDeleteButton" type="button">清除所选标记</button>
						<button class="ghost" id="bulkClearSelectionButton" type="button">清空选择</button>
					</div>
				</div>
				<div class="field">
					<span>快速选择</span>
					<div class="button-stack">
						<button class="ghost" id="bulkSelectStatusesButton" type="button">全选当前主表</button>
						<button class="ghost" id="bulkSelectPoliciesButton" type="button">全选当前第三方</button>
					</div>
				</div>
			</div>
		</section>

		<section class="card filter-panel" id="statusPanel">
			<div class="section-head compact">
				<div>
					<h2 class="section-title">主监控表</h2>
					<div class="section-copy">支持按名称、状态、升级策略、来源、类别和你手工写入的标记筛选，也支持按表头或下拉排序。</div>
				</div>
			</div>
			<div class="toolbar-grid">
				<label class="field wide">
					<span>搜索</span>
					<input id="statusSearch" type="search" placeholder="比如 CleanShot / brew / hold / thirdParty" />
				</label>
				<label class="field">
					<span>状态</span>
					<select id="statusFilter">
						<option value="all">全部状态</option>
						<option value="update-available">可更新</option>
						<option value="up-to-date">已最新</option>
						<option value="unknown">未知</option>
						<option value="error">错误</option>
					</select>
				</label>
				<label class="field">
					<span>策略</span>
					<select id="policyFilter">
						<option value="all">全部策略</option>
						<option value="hold">暂缓升级</option>
						<option value="cautious">谨慎升级</option>
						<option value="normal">常规</option>
					</select>
				</label>
				<label class="field">
					<span>类别</span>
					<select id="categoryFilter">
						<option value="all">全部类别</option>
						<option value="configured">配置追踪</option>
						<option value="brew">Homebrew</option>
						<option value="mas">Mac App Store</option>
					</select>
				</label>
				<label class="field">
					<span>来源</span>
					<select id="activationFilter">
						<option value="all">全部来源</option>
						<option value="thirdPartyActivated">第三方激活</option>
						<option value="thirdPartyStore">第三方商店</option>
						<option value="brew">brew</option>
						<option value="appStore">Mac App Store</option>
						<option value="github">GitHub</option>
						<option value="official">官方</option>
						<option value="manual">手工</option>
					</select>
				</label>
				<label class="field">
					<span>手工标记</span>
					<select id="markFilter">
						<option value="all">全部标记</option>
						<option value="watch">重点关注</option>
						<option value="avoid">不要升级</option>
						<option value="safe">确认可升</option>
						<option value="todo">待核验</option>
						<option value="ignore">忽略</option>
						<option value="annotated">已标记</option>
						<option value="unmarked">未标记</option>
					</select>
				</label>
				<label class="field">
					<span>排序</span>
					<select id="statusSort">
						<option value="priority">风险优先</option>
						<option value="activity">最近活动</option>
						<option value="name">名称</option>
						<option value="status">状态</option>
						<option value="policy">策略</option>
						<option value="channel">渠道</option>
						<option value="installedVersion">当前版本</option>
						<option value="latestVersion">最新版本</option>
						<option value="checkedAt">检查时间</option>
					</select>
				</label>
				<div class="field">
					<span>操作</span>
					<div class="button-stack">
						<button class="secondary" id="statusDirectionButton" type="button">正序</button>
						<button class="ghost" id="statusResetButton" type="button">重置</button>
					</div>
				</div>
			</div>
			<div class="chip-row" id="statusQuickFilters"></div>
			<div class="result-meta" id="statusMeta"></div>
		</section>
		<section id="content"></section>

		<section class="card filter-panel" id="thirdPartyPanel">
			<div class="section-head compact">
				<div>
					<h2 class="section-title">第三方来源 / 暂缓升级</h2>
					<div class="section-copy">这组审计结果同样支持搜索、按标记筛选和排序，并且你可以直接在这里写自己的判断和备注。</div>
				</div>
			</div>
			<div class="toolbar-grid">
				<label class="field wide">
					<span>搜索</span>
					<input id="policySearch" type="search" placeholder="比如 macked / CleanShot / QiuChenly" />
				</label>
				<label class="field">
					<span>标记</span>
					<select id="policyMarker">
						<option value="all">全部标记</option>
						<option value="macked">macked</option>
						<option value="tnt">TNT</option>
						<option value="macwk">MacWK</option>
						<option value="appstorrent">appstorrent</option>
						<option value="qiuchenly">QiuChenly</option>
					</select>
				</label>
				<label class="field">
					<span>置信度</span>
					<select id="policyConfidence">
						<option value="all">全部置信度</option>
						<option value="high">高</option>
						<option value="medium">中</option>
					</select>
				</label>
				<label class="field">
					<span>记忆</span>
					<select id="policyAnnotation">
						<option value="all">全部记忆</option>
						<option value="annotated">已标记</option>
						<option value="unannotated">未标记</option>
					</select>
				</label>
				<label class="field">
					<span>排序</span>
					<select id="policySort">
						<option value="priority">风险优先</option>
						<option value="name">名称</option>
						<option value="confidence">置信度</option>
						<option value="marker">标记</option>
					</select>
				</label>
				<div class="field">
					<span>操作</span>
					<div class="button-stack">
						<button class="secondary" id="policyDirectionButton" type="button">正序</button>
						<button class="ghost" id="policyResetButton" type="button">重置</button>
					</div>
				</div>
			</div>
			<div class="result-meta" id="policyMeta"></div>
		</section>
		<section id="thirdPartySection"></section>
	</main>

	<div class="annotation-overlay" id="annotationOverlay">
		<div class="card annotation-dialog">
			<div class="section-head compact">
				<div>
					<h2 class="section-title">写入记忆</h2>
					<div class="section-copy">这里保存的是项目本地记忆，写入后会落到 data/annotations.json，后续筛选和 CLI 都会带出来。</div>
				</div>
			</div>
			<div class="toolbar-grid">
				<div class="field wide">
					<span>软件</span>
					<div class="annotation-target" id="annotationTargetName"></div>
					<div class="muted" id="annotationTargetMeta"></div>
				</div>
				<label class="field">
					<span>标记</span>
					<select id="annotationMark">
						<option value="watch">重点关注</option>
						<option value="avoid">不要升级</option>
						<option value="safe">确认可升</option>
						<option value="todo">待核验</option>
						<option value="ignore">忽略</option>
					</select>
				</label>
				<label class="field wide">
					<span>备注</span>
					<textarea id="annotationNote" placeholder="比如：这是 macked 版本，不要自动升级；等官网修好后再切。"></textarea>
				</label>
			</div>
			<div class="button-stack" style="margin-top: 16px;">
				<button id="annotationSaveButton" type="button">保存标记</button>
				<button class="secondary" id="annotationDeleteButton" type="button">清除标记</button>
				<button class="ghost" id="annotationCancelButton" type="button">取消</button>
			</div>
		</div>
	</div>

	<script>
		const pollIntervalMs = ${pollIntervalMs};
		let snapshot = ${serialized};
		let thirdPartyPolicy = ${serializedPolicy};
		let annotations = ${serializedAnnotations};
		let visibleStatuses = [];
		let visiblePolicies = [];
		let visibleFocusStatuses = [];
		let visibleFocusPolicies = [];
		let activeAnnotationTarget = null;
		let selectedTargets = {};
		let selectionAnchors = {
			status: null,
			policy: null
		};
		let pendingUpgradeIds = {};
		let activeSummaryShortcut = "";

		const viewState = {
			mode: "today"
		};

		const statusState = {
			quick: "all",
			search: "",
			status: "all",
			policy: "all",
			category: "all",
			activationSource: "all",
			mark: "all",
			sort: "priority",
			descending: false
		};

		const policyState = {
			search: "",
			marker: "all",
			confidence: "all",
			annotation: "all",
			sort: "priority",
			descending: false
		};

		function escapeHtml(value) {
			return String(value ?? "")
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;");
		}

		function normalizeText(value) {
			return String(value ?? "").trim().toLowerCase();
		}

		function normalizeName(value) {
			return String(value ?? "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
		}

		function compareText(left, right) {
			return String(left ?? "").localeCompare(String(right ?? ""), "zh-CN", { sensitivity: "base" });
		}

		function compareNullableText(left, right) {
			return compareText(left ?? "", right ?? "");
		}

		function statusRank(status) {
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

		function policyRank(policy) {
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

		function confidenceRank(confidence) {
			return confidence === "high" ? 0 : 1;
		}

		function isThirdPartySource(source) {
			return source === "thirdPartyActivated" || source === "thirdPartyStore";
		}

		function buildStatusTarget(item) {
			return {
				displayName: item.displayName,
				appId: item.id,
				bundleId: item.bundleId ?? null,
				path: item.path
			};
		}

		function buildPolicyTarget(item) {
			return {
				displayName: item.name,
				bundleId: item.bundleId ?? null,
				path: item.path
			};
		}

		function targetKey(target) {
			if (target.bundleId) {
				return "bundle:" + target.bundleId;
			}
			if (target.path) {
				return "path:" + target.path;
			}
			if (target.appId) {
				return "id:" + target.appId;
			}
			return "name:" + normalizeName(target.displayName);
		}

		function selectedTargetValues() {
			return Object.values(selectedTargets);
		}

		function isSelectedTarget(target) {
			return Boolean(selectedTargets[targetKey(target)]);
		}

		function setSelectedTarget(target, selected) {
			const key = targetKey(target);
			if (selected) {
				selectedTargets[key] = target;
			} else {
				delete selectedTargets[key];
			}
		}

		function addTargetsToSelection(targets) {
			for (const target of targets) {
				setSelectedTarget(target, true);
			}
		}

		function annotationMatchesTarget(annotation, target) {
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

		function findAnnotation(target) {
			return annotations.find((annotation) => annotationMatchesTarget(annotation, target)) ?? null;
		}

		function findAnnotationForStatus(item) {
			return findAnnotation(buildStatusTarget(item));
		}

		function findAnnotationForPolicy(item) {
			return findAnnotation(buildPolicyTarget(item));
		}

		function markLabel(mark) {
			switch (mark) {
				case "watch":
					return "重点关注";
				case "avoid":
					return "不要升级";
				case "safe":
					return "确认可升";
				case "ignore":
					return "忽略";
				case "todo":
				default:
					return "待核验";
			}
		}

		function statusLabel(status) {
			switch (status) {
				case "update-available":
					return "可更新";
				case "up-to-date":
					return "已最新";
				case "error":
					return "错误";
				case "unknown":
				default:
					return "未知";
			}
		}

		function policyLabel(policy) {
			switch (policy) {
				case "hold":
					return "暂缓升级";
				case "cautious":
					return "谨慎升级";
				case "normal":
				default:
					return "常规";
			}
		}

		function activationSourceLabel(source) {
			switch (source) {
				case "thirdPartyActivated":
					return "第三方激活";
				case "thirdPartyStore":
					return "第三方商店";
				case "appStore":
					return "Mac App Store";
				case "official":
					return "官网";
				case "github":
					return "GitHub";
				case "brew":
					return "brew";
				case "manual":
					return "手工";
				default:
					return source || "未注明来源";
			}
		}

		function channelLabel(channel) {
			switch (channel) {
				case "brew cask":
					return "brew cask";
				case "brew formula":
					return "brew formula";
				case "mas":
					return "Mac App Store";
				case "configured":
					return "配置追踪";
				default:
					return channel || "未分类";
			}
		}

		function formatDateTime(value) {
			if (!value) {
				return "";
			}

			try {
				return new Date(value).toLocaleString();
			} catch {
				return String(value);
			}
		}

		function formatRelativeDate(value) {
			if (!value) {
				return "未记录";
			}

			try {
				const target = new Date(value);
				const diffMs = Date.now() - target.getTime();
				const diffHours = Math.max(0, Math.round(diffMs / 3_600_000));
				if (diffHours < 24) {
					return diffHours <= 1 ? "1 小时内" : diffHours + " 小时前";
				}

				const diffDays = Math.round(diffHours / 24);
				if (diffDays < 30) {
					return diffDays + " 天前";
				}

				return target.toLocaleDateString();
			} catch {
				return String(value);
			}
		}

		function dateScore(value) {
			if (!value) {
				return 0;
			}

			const score = new Date(value).getTime();
			return Number.isFinite(score) ? score : 0;
		}

		function annotationBadge(annotation) {
			return annotation
				? '<span class="badge mark-' + escapeHtml(annotation.mark) + '">' + escapeHtml(markLabel(annotation.mark)) + '</span>'
				: '<span class="muted">未标记</span>';
		}

		function annotationPriority(annotation) {
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

		function actionStateForStatus(item) {
			const annotation = findAnnotationForStatus(item);

			if (item.category === "configured") {
				if (item.sourceUrl) {
					return {
						kind: "link",
						label: "打开来源",
						reason: "这类项目没有统一安装器，先打开来源页处理。"
					};
				}

				return {
					kind: "blocked",
					label: "无来源",
					reason: "当前追踪项没有可直接打开的来源地址。"
				};
			}

			if (annotation?.mark === "ignore") {
				return { kind: "blocked", label: "已忽略", reason: "这项软件已被你标记为忽略。" };
			}
			if (annotation?.mark === "avoid") {
				return { kind: "blocked", label: "不要升级", reason: "这项软件已被你人工标记为不要升级。" };
			}
			if (annotation?.mark === "todo") {
				return { kind: "blocked", label: "待核验", reason: "先做人工核验，再决定是否升级。" };
			}
			if (item.upgradePolicy === "hold" || item.activationSource === "thirdPartyActivated") {
				return { kind: "blocked", label: "禁止升级", reason: "第三方激活或暂缓升级的软件不提供一键升级。" };
			}
			if (item.upgradePolicy === "cautious" && annotation?.mark !== "safe") {
				return { kind: "blocked", label: "需确认", reason: "先把它标成“确认可升”，再开放一键升级。" };
			}
			if (item.category === "brew" || item.category === "mas") {
				return { kind: "upgrade", label: "升级", reason: item.category === "brew" ? "调用 brew upgrade" : "调用 mas upgrade" };
			}

			return { kind: "blocked", label: "不可升级", reason: "当前类型还没有实现一键升级。" };
		}

		function actionCellHtml(item) {
			const action = actionStateForStatus(item);
			const pending = Boolean(pendingUpgradeIds[item.id]);

			if (action.kind === "upgrade") {
				return '<div class="action-stack"><button class="row-action row-action-upgrade" type="button" data-upgrade-id="' + escapeHtml(item.id) + '"' + (pending ? ' disabled' : '') + '>' + (pending ? '升级中' : '升级') + '</button>'
					+ '<div class="muted">' + escapeHtml(action.reason) + '</div></div>';
			}

			if (action.kind === "link") {
				return '<div class="action-stack"><a class="row-action" href="' + escapeHtml(item.sourceUrl ?? "") + '" target="_blank" rel="noreferrer">打开来源</a>'
					+ '<div class="action-hint link"><strong>需要手动处理</strong><div class="muted">' + escapeHtml(action.reason) + '</div></div></div>';
			}

			return '<div class="action-stack"><button class="ghost row-action" type="button" disabled>' + escapeHtml(action.label) + '</button>'
				+ '<div class="action-hint blocked"><strong>不能一键升级</strong><div class="muted">' + escapeHtml(action.reason) + '</div></div></div>';
		}

		function compareStatusPriority(left, right) {
			return annotationPriority(findAnnotationForStatus(left)) - annotationPriority(findAnnotationForStatus(right))
				|| policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy)
				|| statusRank(left.status) - statusRank(right.status)
				|| compareText(left.displayName, right.displayName);
		}

		function hasAttentionAnnotation(annotation) {
			return Boolean(annotation && annotation.mark !== "ignore");
		}

		function isRiskStatus(item, annotation) {
			return item.status === "error"
				|| item.upgradePolicy !== "normal"
				|| item.activationSource === "thirdPartyActivated"
				|| annotation?.mark === "avoid"
				|| annotation?.mark === "todo"
				|| annotation?.mark === "watch";
		}

		function isTodayStatus(item, annotation) {
			return item.status === "update-available"
				|| item.status === "error"
				|| isRiskStatus(item, annotation)
				|| hasAttentionAnnotation(annotation);
		}

		function compareByRecentActivity(left, right) {
			return dateScore(right.lastActivityAt) - dateScore(left.lastActivityAt)
				|| compareText(left.displayName, right.displayName);
		}

		function compareTodayPriority(left, right) {
			return compareByRecentActivity(left, right)
				|| annotationPriority(findAnnotationForStatus(left)) - annotationPriority(findAnnotationForStatus(right))
				|| policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy)
				|| statusRank(left.status) - statusRank(right.status)
				|| compareText(left.displayName, right.displayName);
		}

		function autoConfiguredStatuses() {
			return (snapshot?.statuses ?? []).filter((item) => item.id.startsWith("auto-appcast-"));
		}

		function needsReviewStatuses(items) {
			return items.filter((item) => {
				const annotation = findAnnotationForStatus(item);
				return !annotation && (item.status !== "up-to-date" || item.upgradePolicy !== "normal");
			});
		}

		function highRiskAutoStatuses(items) {
			return items.filter((item) =>
				item.upgradePolicy === "hold"
				|| item.activationSource === "thirdPartyActivated"
				|| item.status === "error"
				|| item.status === "unknown",
			);
		}

		function compareRiskPriority(left, right) {
			return annotationPriority(findAnnotationForStatus(left)) - annotationPriority(findAnnotationForStatus(right))
				|| policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy)
				|| statusRank(left.status) - statusRank(right.status)
				|| compareByRecentActivity(left, right)
				|| compareText(left.displayName, right.displayName);
		}

		function applyStatusState(items) {
			const filtered = items.filter((item) => {
				const annotation = findAnnotationForStatus(item);

				if (statusState.quick === "updates" && item.status !== "update-available") {
					return false;
				}
				if (statusState.quick === "hold" && item.upgradePolicy !== "hold") {
					return false;
				}
				if (statusState.quick === "third-party" && !isThirdPartySource(item.activationSource)) {
					return false;
				}
				if (statusState.quick === "errors" && item.status !== "error") {
					return false;
				}
				if (statusState.status !== "all" && item.status !== statusState.status) {
					return false;
				}
				if (statusState.policy !== "all" && item.upgradePolicy !== statusState.policy) {
					return false;
				}
				if (statusState.category !== "all" && item.category !== statusState.category) {
					return false;
				}
				if (statusState.activationSource !== "all" && (item.activationSource ?? "") !== statusState.activationSource) {
					return false;
				}
				if (statusState.mark === "unmarked" && annotation) {
					return false;
				}
				if (statusState.mark === "annotated" && !annotation) {
					return false;
				}
				if (statusState.mark !== "all" && statusState.mark !== "unmarked" && statusState.mark !== "annotated" && annotation?.mark !== statusState.mark) {
					return false;
				}
				if (!statusState.search.trim()) {
					return true;
				}

				const haystack = normalizeText([
					item.displayName,
					item.channel,
					item.activationSource,
					item.path,
					item.bundleId,
					item.notes,
					item.policyReason,
					item.error,
					annotation?.mark,
					annotation?.note
				].filter(Boolean).join(" "));
				return haystack.includes(normalizeText(statusState.search));
			});

			return filtered.sort((left, right) => {
				let comparison = 0;
				switch (statusState.sort) {
					case "name":
						comparison = compareText(left.displayName, right.displayName);
						break;
					case "activity":
						comparison = compareByRecentActivity(left, right);
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

				if (comparison === 0 && statusState.sort !== "priority") {
					comparison = compareStatusPriority(left, right);
				}

				return statusState.descending ? comparison * -1 : comparison;
			});
		}

		function applyPolicyState(items) {
			const filtered = items.filter((item) => {
				const annotation = findAnnotationForPolicy(item);

				if (policyState.marker !== "all" && !item.markers.includes(policyState.marker)) {
					return false;
				}
				if (policyState.confidence !== "all" && item.confidence !== policyState.confidence) {
					return false;
				}
				if (policyState.annotation === "annotated" && !annotation) {
					return false;
				}
				if (policyState.annotation === "unannotated" && annotation) {
					return false;
				}
				if (!policyState.search.trim()) {
					return true;
				}

				const haystack = normalizeText([
					item.name,
					item.reason,
					item.recommendation,
					item.path,
					item.markers.join(" "),
					annotation?.mark,
					annotation?.note
				].filter(Boolean).join(" "));
				return haystack.includes(normalizeText(policyState.search));
			});

			return filtered.sort((left, right) => {
				let comparison = 0;
				switch (policyState.sort) {
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
						comparison = policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy)
							|| confidenceRank(left.confidence) - confidenceRank(right.confidence)
							|| compareText(left.name, right.name);
						break;
				}

				if (comparison === 0 && policyState.sort !== "priority") {
					comparison = compareText(left.name, right.name);
				}

				return policyState.descending ? comparison * -1 : comparison;
			});
		}

		function renderQuickFilters() {
			const node = document.getElementById("statusQuickFilters");
			const statuses = snapshot?.statuses ?? [];
			const quickFilters = [
				{ key: "all", label: "全部", count: statuses.length },
				{ key: "updates", label: "可更新", count: statuses.filter((item) => item.status === "update-available").length },
				{ key: "hold", label: "暂缓升级", count: statuses.filter((item) => item.upgradePolicy === "hold").length },
				{ key: "third-party", label: "第三方", count: statuses.filter((item) => isThirdPartySource(item.activationSource)).length },
				{ key: "errors", label: "错误", count: statuses.filter((item) => item.status === "error").length }
			];

			node.innerHTML = quickFilters.map((item) =>
				'<button class="chip' + (statusState.quick === item.key ? ' active' : '') + '" type="button" data-quick-filter="' + escapeHtml(item.key) + '">'
				+ escapeHtml(item.label) + ' (' + item.count + ')'
				+ '</button>'
			).join("");
		}

		function renderBulkMeta() {
			const selectedCount = selectedTargetValues().length;
			const bulkMetaNode = document.getElementById("bulkMeta");
			bulkMetaNode.textContent = selectedCount ? "已选择 " + selectedCount + " 项" : "还没有选择任何项目";

			const disabled = selectedCount === 0;
			document.getElementById("bulkApplyButton").disabled = disabled;
			document.getElementById("bulkDeleteButton").disabled = disabled;
			document.getElementById("bulkClearSelectionButton").disabled = disabled;
		}

		function summaryEntriesData() {
			if (!snapshot) {
				return [];
			}

			return [
				{ key: "total", label: "总项目", value: snapshot.summary.total },
				{ key: "update-available", label: "可更新", value: snapshot.summary.updateAvailable },
				{ key: "up-to-date", label: "最新", value: snapshot.summary.upToDate },
				{ key: "cautious", label: "监控谨慎", value: snapshot.summary.cautious },
				{ key: "hold", label: "监控暂缓", value: snapshot.summary.hold },
				{ key: "third-party-audit", label: "审计第三方", value: thirdPartyPolicy.length },
				{ key: "annotations", label: "记忆条目", value: annotations.length },
				{ key: "error", label: "错误", value: snapshot.summary.errors }
			];
		}

		function renderSummaryCards() {
			const summaryNode = document.getElementById("summary");
			const entries = summaryEntriesData();
			summaryNode.innerHTML = entries.map((item) =>
				'<button class="card summary-card' + (activeSummaryShortcut === item.key ? ' active' : '') + '" type="button" data-summary-filter="' + escapeHtml(item.key) + '"><strong>'
				+ escapeHtml(item.value)
				+ '</strong><span>'
				+ escapeHtml(item.label)
				+ '</span></button>'
			).join("");
		}

		function renderReviewPanel() {
			const node = document.getElementById("reviewPanel");

			if (!snapshot) {
				node.hidden = true;
				node.innerHTML = "";
				return;
			}

			const autoStatuses = autoConfiguredStatuses();
			if (!autoStatuses.length) {
				node.hidden = true;
				node.innerHTML = "";
				return;
			}

			const reviewStatuses = needsReviewStatuses(autoStatuses);
			const riskStatuses = highRiskAutoStatuses(autoStatuses);
			const reviewPolicies = thirdPartyPolicy.filter((item) => !findAnnotationForPolicy(item));
			const cards = [
				{
					key: "auto-configured",
					title: "已自动接入",
					value: autoStatuses.length,
					copy: "第一次启动已经把本机能直接提取更新源的软件先接进来了，不用你手写配置。",
					button: "查看自动接入"
				},
				{
					key: "needs-review",
					title: "待你确认",
					value: reviewStatuses.length,
					copy: "这些项目还没有人工标记，或者本身就有更新、异常和策略提示，应该优先过一遍。",
					button: "只看待确认"
				},
				{
					key: "high-risk",
					title: "高风险项",
					value: riskStatuses.length,
					copy: "第三方激活、暂缓升级、异常状态会集中压到这里，先判断这些，再处理普通更新。",
					button: "打开风险区",
					risk: true
				},
				{
					key: "third-party-review",
					title: "第三方待复核",
					value: reviewPolicies.length,
					copy: "第三方审计结果已经出来了，但还没写入你的判断，适合逐步补“不要升级”或“待核验”。",
					button: "查看第三方审计",
					risk: true
				}
			];

			node.hidden = false;
			node.innerHTML = '<div class="review-head"><div><h2 class="review-title">首次整理建议</h2><div class="review-copy">现在不用先写配置了。系统已经自动生成本地配置，并把能直接识别更新源的软件先接进来。你接下来只需要先确认高风险项，再给敏感软件补几个标记。</div></div></div>'
				+ '<div class="review-grid">'
				+ cards.map((item) =>
					'<article class="review-card' + (item.risk ? ' risk' : '') + '"><div><strong>' + escapeHtml(item.value) + '</strong><div class="review-card-title">' + escapeHtml(item.title) + '</div></div><div class="review-card-copy">' + escapeHtml(item.copy) + '</div><div class="review-actions"><button class="review-button" type="button" data-review-shortcut="' + escapeHtml(item.key) + '">' + escapeHtml(item.button) + '</button></div></article>'
				).join("")
				+ '</div>';
		}

		function renderViewTabs() {
			const node = document.getElementById("viewTabs");
			const entries = [
				{ key: "today", label: "今天处理" },
				{ key: "risk", label: "风险区" },
				{ key: "inventory", label: "全部资产" }
			];
			node.innerHTML = entries.map((item) =>
				'<button class="view-tab' + (viewState.mode === item.key ? ' active' : '') + '" type="button" data-view-mode="' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + '</button>'
			).join("");
		}

		function focusActionHtml(item) {
			const action = actionStateForStatus(item);
			const pending = Boolean(pendingUpgradeIds[item.id]);

			if (action.kind === "upgrade") {
				return '<button class="row-action row-action-upgrade" type="button" data-upgrade-id="' + escapeHtml(item.id) + '"' + (pending ? ' disabled' : '') + '>' + (pending ? '升级中' : '升级') + '</button>';
			}

			if (action.kind === "link") {
				return '<a class="row-action" href="' + escapeHtml(item.sourceUrl ?? "") + '" target="_blank" rel="noreferrer">打开来源</a>';
			}

			return '<button class="ghost row-action" type="button" disabled>' + escapeHtml(action.label) + '</button>';
		}

		function renderFocusView(node) {
			if (!snapshot || viewState.mode === "inventory") {
				visibleFocusStatuses = [];
				visibleFocusPolicies = [];
				node.innerHTML = "";
				node.hidden = true;
				return;
			}

			node.hidden = false;

			if (viewState.mode === "today") {
				const items = snapshot.statuses
					.filter((item) => isTodayStatus(item, findAnnotationForStatus(item)))
					.sort(compareTodayPriority)
					.slice(0, 24);
				visibleFocusStatuses = items;
				visibleFocusPolicies = [];

				const cards = items.map((item, index) => {
					const annotation = findAnnotationForStatus(item);
					const signals = [
						'<span class="badge ' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) + '</span>',
						'<span class="badge ' + escapeHtml(item.upgradePolicy) + '">' + escapeHtml(policyLabel(item.upgradePolicy)) + '</span>',
						annotation ? annotationBadge(annotation) : "",
						item.activationSource ? '<span class="property-pill">' + escapeHtml(activationSourceLabel(item.activationSource)) + '</span>' : ""
					].filter(Boolean).join("");
					return '<article class="focus-card' + (isRiskStatus(item, annotation) ? ' risk' : '') + '">'
						+ '<div class="focus-card-header"><div><div class="focus-card-title">' + escapeHtml(item.displayName) + '</div><div class="focus-versions">' + escapeHtml(item.installedVersion ?? "未知") + ' → ' + escapeHtml(item.latestVersion ?? "未知") + '</div></div>' + focusActionHtml(item) + '</div>'
						+ '<div class="focus-meta">' + signals + '</div>'
						+ '<div class="focus-note">' + escapeHtml(annotation?.note || item.recommendation || item.policyReason || item.notes || item.error || "暂无额外说明") + '</div>'
						+ '<div class="focus-footer"><button class="ghost row-action" type="button" data-focus-annotate-index="' + index + '">标记</button><span class="muted">最近活动 ' + escapeHtml(formatRelativeDate(item.lastActivityAt)) + '</span></div>'
						+ '</article>';
				}).join("");

				node.innerHTML = '<div class="focus-board"><section class="focus-section"><div class="focus-section-head"><div class="focus-section-title">今天处理</div><div class="focus-section-note">只保留你今天更可能要处理的项目：更新、错误、第三方和手工标记。</div></div><div class="focus-grid">' + (cards || '<div class="empty">当前没有需要处理的项目。</div>') + '</div></section></div>';
				return;
			}

			const riskStatuses = snapshot.statuses
				.filter((item) => isRiskStatus(item, findAnnotationForStatus(item)))
				.sort(compareRiskPriority)
				.slice(0, 24);
			const riskPolicies = [...thirdPartyPolicy]
				.sort((left, right) => {
					const leftAnnotation = findAnnotationForPolicy(left);
					const rightAnnotation = findAnnotationForPolicy(right);
					return annotationPriority(leftAnnotation) - annotationPriority(rightAnnotation)
						|| policyRank(left.upgradePolicy) - policyRank(right.upgradePolicy)
						|| confidenceRank(left.confidence) - confidenceRank(right.confidence)
						|| compareText(left.name, right.name);
				})
				.slice(0, 18);
			visibleFocusStatuses = riskStatuses;
			visibleFocusPolicies = riskPolicies;

			const statusCards = riskStatuses.map((item, index) => {
				const annotation = findAnnotationForStatus(item);
				return '<article class="focus-card risk">'
					+ '<div class="focus-card-header"><div><div class="focus-card-title">' + escapeHtml(item.displayName) + '</div><div class="focus-versions">' + escapeHtml(item.installedVersion ?? "未知") + ' → ' + escapeHtml(item.latestVersion ?? "未知") + '</div></div>' + focusActionHtml(item) + '</div>'
					+ '<div class="focus-meta"><span class="badge ' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) + '</span><span class="badge ' + escapeHtml(item.upgradePolicy) + '">' + escapeHtml(policyLabel(item.upgradePolicy)) + '</span>' + (annotation ? annotationBadge(annotation) : "") + '</div>'
					+ '<div class="focus-note">' + escapeHtml(annotation?.note || item.policyReason || item.recommendation || item.notes || item.error || "需要人工判断。") + '</div>'
					+ '<div class="focus-footer"><button class="ghost row-action" type="button" data-focus-annotate-index="' + index + '">标记</button><span class="muted">最近活动 ' + escapeHtml(formatRelativeDate(item.lastActivityAt)) + '</span></div>'
					+ '</article>';
			}).join("");

			const policyCards = riskPolicies.map((item, index) => {
				const annotation = findAnnotationForPolicy(item);
				return '<article class="focus-card risk">'
					+ '<div class="focus-card-header"><div><div class="focus-card-title">' + escapeHtml(item.name) + '</div><div class="focus-versions">' + escapeHtml(item.version ?? "未知版本") + '</div></div><button class="ghost row-action" type="button" data-focus-policy-annotate-index="' + index + '">标记</button></div>'
					+ '<div class="focus-meta"><span class="badge ' + escapeHtml(item.upgradePolicy) + '">' + escapeHtml(policyLabel(item.upgradePolicy)) + '</span><span class="badge unknown">' + escapeHtml(item.confidence === "high" ? "高置信度" : "中置信度") + '</span><span class="badge normal">' + escapeHtml(item.markers.join(", ")) + '</span>' + (annotation ? annotationBadge(annotation) : "") + '</div>'
					+ '<div class="focus-note">' + escapeHtml(annotation?.note || item.recommendation || item.reason) + '</div>'
					+ '</article>';
			}).join("");

			node.innerHTML = '<div class="focus-board">'
				+ '<section class="focus-section"><div class="focus-section-head"><div class="focus-section-title">高风险与暂缓项</div><div class="focus-section-note">这里集中放第三方激活、暂缓升级、待核验和报错项。</div></div><div class="focus-grid">' + (statusCards || '<div class="empty">当前没有高风险状态项。</div>') + '</div></section>'
				+ '<section class="focus-section"><div class="focus-section-head"><div class="focus-section-title">第三方审计命中</div><div class="focus-section-note">保留第三方来源卡片，方便你单独处理。</div></div><div class="focus-grid">' + (policyCards || '<div class="empty">当前没有第三方审计结果。</div>') + '</div></section>'
				+ '</div>';
		}

		function renderSnapshot() {
			const summaryNode = document.getElementById("summary");
			const batchPanelNode = document.getElementById("batchPanel");
			const focusNode = document.getElementById("focusView");
			const contentNode = document.getElementById("content");
			const metaNode = document.getElementById("meta");
			const reviewNode = document.getElementById("reviewPanel");
			const statusMetaNode = document.getElementById("statusMeta");
			const statusPanelNode = document.getElementById("statusPanel");
			const thirdPartyNode = document.getElementById("thirdPartySection");
			const policyMetaNode = document.getElementById("policyMeta");
			const thirdPartyPanelNode = document.getElementById("thirdPartyPanel");
			const inventoryView = viewState.mode === "inventory";

			renderQuickFilters();
			renderBulkMeta();
			syncControlValues();
			renderViewTabs();
			renderReviewPanel();
			batchPanelNode.hidden = !inventoryView;
			statusPanelNode.hidden = !inventoryView;
			contentNode.hidden = !inventoryView;
			thirdPartyPanelNode.hidden = !inventoryView;
			thirdPartyNode.hidden = !inventoryView;

			if (!snapshot) {
				summaryNode.innerHTML = "";
				metaNode.textContent = "还没有执行过检查。";
				reviewNode.hidden = true;
				statusMetaNode.textContent = "等待第一次扫描。";
				contentNode.innerHTML = '<div class="empty">点击“立即检查”开始第一次扫描。</div>';
				renderFocusView(focusNode);
				renderThirdPartySection(thirdPartyNode, policyMetaNode);
				return;
			}

			metaNode.textContent = "上次检查：" + new Date(snapshot.generatedAt).toLocaleString();
			renderSummaryCards();
			renderFocusView(focusNode);

			const filteredStatuses = applyStatusState(snapshot.statuses);
			visibleStatuses = filteredStatuses;
			const actionCounts = filteredStatuses.reduce((acc, item) => {
				const kind = actionStateForStatus(item).kind;
				acc[kind] = (acc[kind] ?? 0) + 1;
				return acc;
			}, { upgrade: 0, link: 0, blocked: 0 });
			statusMetaNode.textContent = "显示 " + filteredStatuses.length + " / " + snapshot.statuses.length + " · 排序 " + readableStatusSort(statusState.sort) + " · " + (statusState.descending ? "倒序" : "正序") + " · 可升级 " + actionCounts.upgrade + " · 手动处理 " + actionCounts.link + " · 已拦截 " + actionCounts.blocked;

			if (!filteredStatuses.length) {
				contentNode.innerHTML = '<div class="empty">当前筛选条件下没有结果。</div>';
				if (inventoryView) {
					renderThirdPartySection(thirdPartyNode, policyMetaNode);
				}
				return;
			}

			const rows = filteredStatuses.map((item, index) => {
				const annotation = findAnnotationForStatus(item);
				const target = buildStatusTarget(item);
				const selected = isSelectedTarget(target);
				const detailText = [item.recommendation, item.policyReason, item.notes, item.error].filter(Boolean).join(" · ");
				const rowClass = item.upgradePolicy === "hold" ? "row-hold" : item.upgradePolicy === "cautious" ? "row-cautious" : "";
				const sourceMeta = item.sourceUrl
					? '<a class="property-pill" href="' + escapeHtml(item.sourceUrl) + '" target="_blank" rel="noreferrer">来源</a>'
					: '<span class="property-pill">命令</span>';
				const annotationBlock = annotation?.note ? '<div class="note-block">' + escapeHtml(annotation.note) + '</div>' : "";
				const checkedMeta = item.lastCheckedAt ? '<div class="note-block secondary">最近检查 ' + escapeHtml(formatDateTime(item.lastCheckedAt)) + '</div>' : "";
				const signals = [
					'<span class="badge ' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) + '</span>',
					'<span class="badge ' + escapeHtml(item.upgradePolicy) + '">' + escapeHtml(policyLabel(item.upgradePolicy)) + '</span>',
					annotation ? annotationBadge(annotation) : '<span class="property-pill">未标记</span>'
				].join("");
				return '<tr class="' + rowClass + '">'
					+ '<td data-label="选择"><input class="select-toggle" type="checkbox" data-select-status-index="' + index + '"' + (selected ? ' checked' : '') + ' /></td>'
					+ '<td data-label="应用"><div class="app-cell"><div class="app-title">' + escapeHtml(item.displayName) + '</div><div class="property-row"><span class="property-pill">' + escapeHtml(channelLabel(item.channel)) + '</span>' + (item.activationSource ? '<span class="property-pill">' + escapeHtml(activationSourceLabel(item.activationSource)) + '</span>' : '') + sourceMeta + '</div></div></td>'
					+ '<td data-label="版本"><div class="version-cell"><div class="version-line"><span>' + escapeHtml(item.installedVersion ?? "未知") + '</span><span class="version-arrow">→</span><span>' + escapeHtml(item.latestVersion ?? "未知") + '</span></div><div class="muted">当前版本 → 最新版本</div></div></td>'
					+ '<td data-label="信号"><div class="signal-cell"><div class="badge-stack">' + signals + '</div></div></td>'
					+ '<td data-label="操作">' + actionCellHtml(item) + '<div><button class="ghost row-action" type="button" data-annotate-index="' + index + '">编辑标记</button></div></td>'
					+ '<td data-label="说明"><div class="note-cell">' + annotationBlock + '<div class="note-block secondary clamp">' + escapeHtml(detailText || "暂无额外说明") + '</div>' + checkedMeta + '</div></td>'
					+ '</tr>';
			}).join("");

			contentNode.innerHTML = '<div class="table-shell"><table>'
				+ '<thead><tr>'
				+ '<th><input class="select-toggle" type="checkbox" data-toggle-all-statuses="true"' + (allVisibleStatusesSelected() ? ' checked' : '') + ' /></th>'
				+ renderHeaderGroup("应用", [{ key: "name", label: "按名称" }])
				+ renderHeaderGroup("版本", [{ key: "installedVersion", label: "当前" }, { key: "latestVersion", label: "最新" }])
				+ renderHeaderGroup("信号", [{ key: "status", label: "状态" }, { key: "policy", label: "策略" }])
				+ '<th>操作</th>'
				+ renderHeaderGroup("说明", [{ key: "checkedAt", label: "最近检查" }])
				+ '</tr></thead>'
				+ '<tbody>' + rows + '</tbody>'
				+ '</table></div>';

			if (inventoryView) {
				renderThirdPartySection(thirdPartyNode, policyMetaNode);
			}
		}

		function renderThirdPartySection(node, metaNode) {
			const filteredPolicies = applyPolicyState(thirdPartyPolicy);
			visiblePolicies = filteredPolicies;
			metaNode.textContent = "当前显示 " + filteredPolicies.length + " / " + thirdPartyPolicy.length + " 项，排序：" + readablePolicySort(policyState.sort) + "，方向：" + (policyState.descending ? "倒序" : "正序");

			if (!thirdPartyPolicy.length) {
				node.innerHTML = '<div class="empty">当前还没有审计到明确的第三方来源软件。</div>';
				return;
			}

			if (!filteredPolicies.length) {
				node.innerHTML = '<div class="empty">当前筛选条件下没有第三方来源结果。</div>';
				return;
			}

			const rows = filteredPolicies.map((item, index) => {
				const confidenceLabel = item.confidence === "high" ? "高置信度" : "中置信度";
				const annotation = findAnnotationForPolicy(item);
				const target = buildPolicyTarget(item);
				const selected = isSelectedTarget(target);
				const annotationText = annotation?.note ? '<div class="muted">' + escapeHtml(annotation.note) + '</div>' : '<div class="muted">还没有写入记忆。</div>';
				return '<article class="policy-card ' + escapeHtml(item.upgradePolicy) + '">'
					+ '<strong>' + escapeHtml(item.name) + '</strong>'
					+ '<div class="policy-meta">'
						+ '<span class="badge ' + escapeHtml(item.upgradePolicy) + '">' + escapeHtml(item.upgradePolicy === "hold" ? "暂缓升级" : "谨慎升级") + '</span>'
						+ '<span class="badge unknown">' + escapeHtml(confidenceLabel) + '</span>'
						+ '<span class="badge normal">' + escapeHtml(item.markers.join(", ")) + '</span>'
						+ (annotation ? annotationBadge(annotation) : '')
					+ '</div>'
					+ '<div class="muted"><label><input class="select-toggle" type="checkbox" data-select-policy-index="' + index + '"' + (selected ? ' checked' : '') + ' /> 选择到批量操作</label></div>'
					+ '<div>' + escapeHtml(item.recommendation) + '</div>'
					+ '<div class="muted">' + escapeHtml(item.reason) + '</div>'
					+ annotationText
					+ '<div class="policy-path">' + escapeHtml(item.path) + '</div>'
					+ '<div><button class="ghost row-action" type="button" data-policy-annotate-index="' + index + '">标记</button></div>'
				+ '</article>';
			}).join("");

			node.innerHTML = '<div class="policy-toolbar"><label class="muted"><input class="select-toggle" type="checkbox" data-toggle-all-policies="true"' + (allVisiblePoliciesSelected() ? ' checked' : '') + ' /> 全选当前第三方</label></div><div class="policy-grid">' + rows + '</div>';
		}

		function renderSortButton(sortKey, label) {
			const active = statusState.sort === sortKey;
			const direction = active ? (statusState.descending ? "↓" : "↑") : "·";
			return '<button class="table-sort' + (active ? ' active' : '') + '" type="button" data-sort-key="' + escapeHtml(sortKey) + '">' + escapeHtml(label) + '<span class="sort-indicator">' + direction + '</span></button>';
		}

		function renderHeaderGroup(label, buttons) {
			return '<th><div class="head-stack"><div class="head-label">' + escapeHtml(label) + '</div><div class="column-buttons">'
				+ buttons.map((item) => renderSortButton(item.key, item.label)).join("")
				+ '</div></div></th>';
		}

		function readableStatusSort(sortKey) {
			switch (sortKey) {
				case "name":
					return "名称";
				case "activity":
					return "最近活动";
				case "status":
					return "状态";
				case "policy":
					return "策略";
				case "channel":
					return "渠道";
				case "installedVersion":
					return "当前版本";
				case "latestVersion":
					return "最新版本";
				case "checkedAt":
					return "检查时间";
				case "priority":
				default:
					return "风险优先";
			}
		}

		function readablePolicySort(sortKey) {
			switch (sortKey) {
				case "name":
					return "名称";
				case "confidence":
					return "置信度";
				case "marker":
					return "标记";
				case "priority":
				default:
					return "风险优先";
			}
		}

		function syncControlValues() {
			document.getElementById("statusSearch").value = statusState.search;
			document.getElementById("statusFilter").value = statusState.status;
			document.getElementById("policyFilter").value = statusState.policy;
			document.getElementById("categoryFilter").value = statusState.category;
			document.getElementById("activationFilter").value = statusState.activationSource;
			document.getElementById("markFilter").value = statusState.mark;
			document.getElementById("statusSort").value = statusState.sort;
			document.getElementById("statusDirectionButton").textContent = statusState.descending ? "倒序" : "正序";

			document.getElementById("policySearch").value = policyState.search;
			document.getElementById("policyMarker").value = policyState.marker;
			document.getElementById("policyConfidence").value = policyState.confidence;
			document.getElementById("policyAnnotation").value = policyState.annotation;
			document.getElementById("policySort").value = policyState.sort;
			document.getElementById("policyDirectionButton").textContent = policyState.descending ? "倒序" : "正序";
		}

		function resetStatusFilters() {
			statusState.quick = "all";
			statusState.search = "";
			statusState.status = "all";
			statusState.policy = "all";
			statusState.category = "all";
			statusState.activationSource = "all";
			statusState.mark = "all";
			statusState.sort = "priority";
			statusState.descending = false;
		}

		function resetPolicyFilters() {
			policyState.search = "";
			policyState.marker = "all";
			policyState.confidence = "all";
			policyState.annotation = "all";
			policyState.sort = "priority";
			policyState.descending = false;
		}

		function clearSummaryShortcut() {
			activeSummaryShortcut = "";
		}

		function scrollToSection(sectionId) {
			document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
		}

		function applySummaryShortcut(shortcutKey) {
			if (!snapshot) {
				return;
			}

			activeSummaryShortcut = shortcutKey;

			switch (shortcutKey) {
				case "total":
					viewState.mode = "inventory";
					resetStatusFilters();
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "update-available":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.quick = "updates";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "up-to-date":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.status = "up-to-date";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "cautious":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.policy = "cautious";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "hold":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.quick = "hold";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "third-party-audit":
					viewState.mode = "inventory";
					resetStatusFilters();
					resetPolicyFilters();
					renderSnapshot();
					scrollToSection("thirdPartyPanel");
					return;
				case "annotations":
					viewState.mode = "inventory";
					resetStatusFilters();
					resetPolicyFilters();
					statusState.mark = "annotated";
					policyState.annotation = "annotated";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "error":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.quick = "errors";
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				default:
					renderSnapshot();
					return;
			}
		}

		function applyReviewShortcut(shortcutKey) {
			if (!snapshot) {
				return;
			}

			clearSummaryShortcut();

			switch (shortcutKey) {
				case "auto-configured":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.category = "configured";
					statusState.sort = "activity";
					statusState.descending = false;
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "needs-review":
					viewState.mode = "inventory";
					resetStatusFilters();
					statusState.category = "configured";
					statusState.mark = "unmarked";
					statusState.sort = "priority";
					statusState.descending = false;
					renderSnapshot();
					scrollToSection("statusPanel");
					return;
				case "high-risk":
					viewState.mode = "risk";
					renderSnapshot();
					scrollToSection("focusView");
					return;
				case "third-party-review":
					viewState.mode = "inventory";
					resetStatusFilters();
					resetPolicyFilters();
					policyState.annotation = "unannotated";
					renderSnapshot();
					scrollToSection("thirdPartyPanel");
					return;
				default:
					renderSnapshot();
					return;
			}
		}

		function renderAndClearSummaryShortcut() {
			clearSummaryShortcut();
			renderSnapshot();
		}

		function openAnnotationDialog(target) {
			activeAnnotationTarget = target;
			const annotation = findAnnotation(target);
			document.getElementById("annotationTargetName").textContent = target.displayName;
			document.getElementById("annotationTargetMeta").textContent = [target.bundleId ?? "", target.path ?? "", target.appId ?? ""].filter(Boolean).join(" | ");
			document.getElementById("annotationMark").value = annotation?.mark ?? "watch";
			document.getElementById("annotationNote").value = annotation?.note ?? "";
			document.getElementById("annotationOverlay").classList.add("open");
		}

		function closeAnnotationDialog() {
			activeAnnotationTarget = null;
			document.getElementById("annotationOverlay").classList.remove("open");
		}

		async function saveAnnotation() {
			if (!activeAnnotationTarget) {
				return;
			}

			const response = await fetch("/api/annotations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "upsert",
					target: activeAnnotationTarget,
					mark: document.getElementById("annotationMark").value,
					note: document.getElementById("annotationNote").value
				})
			});

			annotations = await response.json();
			closeAnnotationDialog();
			renderSnapshot();
		}

		async function deleteAnnotation() {
			if (!activeAnnotationTarget) {
				return;
			}

			const response = await fetch("/api/annotations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "delete",
					target: activeAnnotationTarget
				})
			});

			annotations = await response.json();
			closeAnnotationDialog();
			renderSnapshot();
		}

		async function applyBulkAnnotation() {
			const targets = selectedTargetValues();
			if (!targets.length) {
				return;
			}

			const nextMark = document.getElementById("bulkMark").value;
			const rawNote = document.getElementById("bulkNote").value.trim();
			const entries = targets.map((target) => {
				const existing = findAnnotation(target);
				return {
					target,
					mark: nextMark,
					note: rawNote || existing?.note || ""
				};
			});

			const response = await fetch("/api/annotations/batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "upsert",
					entries
				})
			});

			annotations = await response.json();
			renderSnapshot();
		}

		async function deleteBulkAnnotations() {
			const targets = selectedTargetValues();
			if (!targets.length) {
				return;
			}

			const response = await fetch("/api/annotations/batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "delete",
					targets
				})
			});

			annotations = await response.json();
			renderSnapshot();
		}

		async function runUpgradeForStatus(statusId) {
			pendingUpgradeIds[statusId] = true;
			renderSnapshot();

			try {
				const response = await fetch("/api/upgrade", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: statusId })
				});
				const payload = await response.json();

				if (!response.ok || !payload.ok) {
					window.alert(payload.message ?? payload.error ?? "升级失败");
					return;
				}

				if (payload.snapshot) {
					snapshot = payload.snapshot;
				}
				window.alert(payload.message ?? "升级完成");
			} finally {
				delete pendingUpgradeIds[statusId];
				renderSnapshot();
			}
		}

		function selectVisibleStatuses() {
			addTargetsToSelection(visibleStatuses.map((item) => buildStatusTarget(item)));
			renderSnapshot();
		}

		function selectVisiblePolicies() {
			addTargetsToSelection(visiblePolicies.map((item) => buildPolicyTarget(item)));
			renderSnapshot();
		}

		function clearSelectedTargets() {
			selectedTargets = {};
			selectionAnchors.status = null;
			selectionAnchors.policy = null;
			renderSnapshot();
		}

		function applyStatusSelection(index, checked, withRange) {
			if (withRange && selectionAnchors.status !== null) {
				const start = Math.min(selectionAnchors.status, index);
				const end = Math.max(selectionAnchors.status, index);
				for (let current = start; current <= end; current += 1) {
					const item = visibleStatuses[current];
					if (!item) {
						continue;
					}
					setSelectedTarget(buildStatusTarget(item), checked);
				}
			} else {
				const item = visibleStatuses[index];
				if (!item) {
					return;
				}
				setSelectedTarget(buildStatusTarget(item), checked);
			}

			selectionAnchors.status = index;
			renderSnapshot();
		}

		function applyPolicySelection(index, checked, withRange) {
			if (withRange && selectionAnchors.policy !== null) {
				const start = Math.min(selectionAnchors.policy, index);
				const end = Math.max(selectionAnchors.policy, index);
				for (let current = start; current <= end; current += 1) {
					const item = visiblePolicies[current];
					if (!item) {
						continue;
					}
					setSelectedTarget(buildPolicyTarget(item), checked);
				}
			} else {
				const item = visiblePolicies[index];
				if (!item) {
					return;
				}
				setSelectedTarget(buildPolicyTarget(item), checked);
			}

			selectionAnchors.policy = index;
			renderSnapshot();
		}

		function allVisibleStatusesSelected() {
			return visibleStatuses.length > 0 && visibleStatuses.every((item) => isSelectedTarget(buildStatusTarget(item)));
		}

		function allVisiblePoliciesSelected() {
			return visiblePolicies.length > 0 && visiblePolicies.every((item) => isSelectedTarget(buildPolicyTarget(item)));
		}

		function toggleAllVisibleStatuses(selected) {
			for (const item of visibleStatuses) {
				setSelectedTarget(buildStatusTarget(item), selected);
			}
			selectionAnchors.status = null;
			renderSnapshot();
		}

		function toggleAllVisiblePolicies(selected) {
			for (const item of visiblePolicies) {
				setSelectedTarget(buildPolicyTarget(item), selected);
			}
			selectionAnchors.policy = null;
			renderSnapshot();
		}

		async function refreshSnapshot() {
			const [statusResponse, policyResponse, annotationResponse] = await Promise.all([
				fetch("/api/status"),
				fetch("/api/source-policy"),
				fetch("/api/annotations")
			]);
			snapshot = await statusResponse.json();
			thirdPartyPolicy = await policyResponse.json();
			annotations = await annotationResponse.json();
			renderSnapshot();
		}

		async function runCheck() {
			const button = document.getElementById("refreshButton");
			button.disabled = true;
			try {
				const [checkResponse, policyResponse, annotationResponse] = await Promise.all([
					fetch("/api/check", { method: "POST" }),
					fetch("/api/source-policy"),
					fetch("/api/annotations")
				]);
				snapshot = await checkResponse.json();
				thirdPartyPolicy = await policyResponse.json();
				annotations = await annotationResponse.json();
				renderSnapshot();
			} finally {
				button.disabled = false;
			}
		}

		function bindControls() {
			document.getElementById("refreshButton").addEventListener("click", runCheck);
			document.getElementById("bulkApplyButton").addEventListener("click", applyBulkAnnotation);
			document.getElementById("bulkDeleteButton").addEventListener("click", deleteBulkAnnotations);
			document.getElementById("bulkClearSelectionButton").addEventListener("click", clearSelectedTargets);
			document.getElementById("bulkSelectStatusesButton").addEventListener("click", selectVisibleStatuses);
			document.getElementById("bulkSelectPoliciesButton").addEventListener("click", selectVisiblePolicies);
			document.getElementById("viewTabs").addEventListener("click", (event) => {
				const button = event.target.closest("[data-view-mode]");
				if (!button) {
					return;
				}
				clearSummaryShortcut();
				viewState.mode = button.getAttribute("data-view-mode");
				renderSnapshot();
			});
			document.getElementById("summary").addEventListener("click", (event) => {
				const button = event.target.closest("[data-summary-filter]");
				if (!button) {
					return;
				}
				applySummaryShortcut(button.getAttribute("data-summary-filter"));
			});
			document.getElementById("reviewPanel").addEventListener("click", (event) => {
				const button = event.target.closest("[data-review-shortcut]");
				if (!button) {
					return;
				}
				applyReviewShortcut(button.getAttribute("data-review-shortcut"));
			});
			document.getElementById("focusView").addEventListener("click", (event) => {
				const upgradeButton = event.target.closest("[data-upgrade-id]");
				if (upgradeButton) {
					void runUpgradeForStatus(upgradeButton.getAttribute("data-upgrade-id"));
					return;
				}

				const annotateButton = event.target.closest("[data-focus-annotate-index]");
				if (annotateButton) {
					const item = visibleFocusStatuses[Number(annotateButton.getAttribute("data-focus-annotate-index"))];
					if (item) {
						openAnnotationDialog(buildStatusTarget(item));
					}
					return;
				}

				const policyAnnotateButton = event.target.closest("[data-focus-policy-annotate-index]");
				if (policyAnnotateButton) {
					const item = visibleFocusPolicies[Number(policyAnnotateButton.getAttribute("data-focus-policy-annotate-index"))];
					if (item) {
						openAnnotationDialog(buildPolicyTarget(item));
					}
				}
			});

			document.getElementById("statusSearch").addEventListener("input", (event) => {
				statusState.search = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("statusFilter").addEventListener("change", (event) => {
				statusState.status = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyFilter").addEventListener("change", (event) => {
				statusState.policy = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("categoryFilter").addEventListener("change", (event) => {
				statusState.category = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("activationFilter").addEventListener("change", (event) => {
				statusState.activationSource = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("markFilter").addEventListener("change", (event) => {
				statusState.mark = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("statusSort").addEventListener("change", (event) => {
				statusState.sort = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("statusDirectionButton").addEventListener("click", () => {
				statusState.descending = !statusState.descending;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("statusResetButton").addEventListener("click", () => {
				clearSummaryShortcut();
				resetStatusFilters();
				renderSnapshot();
			});
			document.getElementById("statusQuickFilters").addEventListener("click", (event) => {
				const button = event.target.closest("[data-quick-filter]");
				if (!button) {
					return;
				}
				const nextQuick = button.getAttribute("data-quick-filter");
				statusState.quick = statusState.quick === nextQuick ? "all" : nextQuick;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("content").addEventListener("click", (event) => {
				const toggleAllStatuses = event.target.closest("[data-toggle-all-statuses]");
				if (toggleAllStatuses) {
					toggleAllVisibleStatuses(toggleAllStatuses.checked);
					return;
				}

				const toggle = event.target.closest("[data-select-status-index]");
				if (toggle) {
					const index = Number(toggle.getAttribute("data-select-status-index"));
					if (Number.isFinite(index)) {
						applyStatusSelection(index, toggle.checked, Boolean(event.shiftKey));
					}
					return;
				}

				const upgradeButton = event.target.closest("[data-upgrade-id]");
				if (upgradeButton) {
					void runUpgradeForStatus(upgradeButton.getAttribute("data-upgrade-id"));
					return;
				}

				const annotateButton = event.target.closest("[data-annotate-index]");
				if (annotateButton) {
					const item = visibleStatuses[Number(annotateButton.getAttribute("data-annotate-index"))];
					if (item) {
						openAnnotationDialog(buildStatusTarget(item));
					}
					return;
				}

				const sortButton = event.target.closest("[data-sort-key]");
				if (!sortButton) {
					return;
				}

				const nextSort = sortButton.getAttribute("data-sort-key");
				if (statusState.sort === nextSort) {
					statusState.descending = !statusState.descending;
				} else {
					statusState.sort = nextSort;
					statusState.descending = false;
				}
				renderAndClearSummaryShortcut();
			});

			document.getElementById("policySearch").addEventListener("input", (event) => {
				policyState.search = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyMarker").addEventListener("change", (event) => {
				policyState.marker = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyConfidence").addEventListener("change", (event) => {
				policyState.confidence = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyAnnotation").addEventListener("change", (event) => {
				policyState.annotation = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policySort").addEventListener("change", (event) => {
				policyState.sort = event.target.value;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyDirectionButton").addEventListener("click", () => {
				policyState.descending = !policyState.descending;
				renderAndClearSummaryShortcut();
			});
			document.getElementById("policyResetButton").addEventListener("click", () => {
				clearSummaryShortcut();
				resetPolicyFilters();
				renderSnapshot();
			});
			document.getElementById("thirdPartySection").addEventListener("click", (event) => {
				const toggleAllPolicies = event.target.closest("[data-toggle-all-policies]");
				if (toggleAllPolicies) {
					toggleAllVisiblePolicies(toggleAllPolicies.checked);
					return;
				}

				const toggle = event.target.closest("[data-select-policy-index]");
				if (toggle) {
					const index = Number(toggle.getAttribute("data-select-policy-index"));
					if (Number.isFinite(index)) {
						applyPolicySelection(index, toggle.checked, Boolean(event.shiftKey));
					}
					return;
				}

				const annotateButton = event.target.closest("[data-policy-annotate-index]");
				if (!annotateButton) {
					return;
				}
				const item = visiblePolicies[Number(annotateButton.getAttribute("data-policy-annotate-index"))];
				if (item) {
					openAnnotationDialog(buildPolicyTarget(item));
				}
			});

			document.getElementById("annotationSaveButton").addEventListener("click", saveAnnotation);
			document.getElementById("annotationDeleteButton").addEventListener("click", deleteAnnotation);
			document.getElementById("annotationCancelButton").addEventListener("click", closeAnnotationDialog);
			document.getElementById("annotationOverlay").addEventListener("click", (event) => {
				if (event.target.id === "annotationOverlay") {
					closeAnnotationDialog();
				}
			});
		}

		bindControls();
		renderSnapshot();
		setInterval(refreshSnapshot, Math.max(pollIntervalMs, 60_000));
	</script>
</body>
</html>`;
}
