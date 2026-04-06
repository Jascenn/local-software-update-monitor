# UI Simplification Plan

Generated: 2026-04-06

## Goal

The current monitor is accurate but too dense for daily use. The interface should optimize for:

- What needs action today
- What is risky and should be held back
- Full inventory only when explicitly needed

## External References

I looked at a few existing solutions and extracted the parts that are actually useful here:

- [Ninite](https://ninite.com/accessible)
  - Keeps the interaction model brutally simple: pick apps, update, done.
  - The important lesson is that users do not want a dense asset table as the default screen.

- [Patch My PC Home Updater](https://patchmypc.com/product/home-updater/)
  - Treats updates as an action queue, not a database.
  - Good patterns: bulk actions, skip/hold logic, silent updates, and a dedicated app list instead of forcing everything into one overloaded table.

- [Topgrade](https://github.com/topgrade-rs/topgrade/releases)
  - CLI-first approach for batch updating.
  - Good pattern: a compact "what needs work now" summary with one command path for power use.

- [BrewMate](https://github.com/romankurnovskii/BrewMate)
  - Shows that a GUI around package management works best when it focuses on installed items, update actions, and source-specific workflows instead of exposing every raw field.

## Proposed Information Architecture

Use three views instead of one default giant table:

1. Today
   - Show only actionable items
   - Include: update available, error, third-party/risky items, manually annotated items
   - Default order: recent activity first, then risk

2. Risk
   - Separate zone for hold / cautious / third-party activated / pending manual verification
   - Keep third-party audit hits here

3. Inventory
   - Preserve the full searchable table
   - Treat it as a secondary workspace for deep inspection

## Applied In This Iteration

- Default page focus moved to `Today`
- Added view switch: `今天处理 / 风险区 / 全部资产`
- Added approximate recent-activity signal from local app bundle metadata
- Added `最近活动` sort in the full inventory view
- Added CLI view modes:
  - `npm run cli -- --view today`
  - `npm run cli -- --view risk`
  - `npm run cli -- --view inventory`

## Next Refinements

- Add collapsible details on cards instead of inline long notes
- Allow pinning a few apps into a permanent "high attention" lane
- Split `Today` into:
  - `可直接升级`
  - `需要人工判断`
  - `已标记`
- Persist preferred default view per user
