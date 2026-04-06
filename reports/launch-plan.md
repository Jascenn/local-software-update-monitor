# Launch Plan

## Name

推荐把对外产品名切到 `Lingyi App Watch`。

原因：

- `Local Software Update Monitor` 更像内部工程名，不像对外产品名。
- `Lingyi App Watch` 和你的域名 `lingyi.tools` / `lingyi.bio` 一致，记忆点更强。
- 这个名字既能覆盖“更新监控”，也能覆盖“第三方来源风险看板”。

建议保留两层命名：

- 产品名：`Lingyi App Watch`
- 仓库名：`local-software-update-monitor`

先不改仓库名的原因是当前 GitHub 链接已经稳定，改名不影响产品上线价值，反而会增加额外迁移成本。

## Domain

这个项目本体不能直接部署到 Cloudflare 上运行。

原因：

- 监控逻辑依赖本机 `brew`、`mas`
- 需要读取本机 `.app` 和 `Info.plist`
- 升级动作本身也是对本机命令和本机软件做操作

所以域名更适合承载下面这几类内容：

- 官网首页
- 下载页
- Release 页面和变更记录
- 截图和使用说明

## Cloudflare

当前机器已经安装：

- `wrangler`
- `cloudflared`

但 `wrangler whoami` 当前返回 `Not logged in`，所以还不能直接操作 Cloudflare 资源。

推荐的发布路径：

1. 用 Cloudflare Pages 承载一个轻量官网
2. 官网首页链接到 GitHub 仓库和 Release
3. 如需远程查看你自己的本机面板，再额外用 Cloudflare Tunnel + Access 做保护

不建议把当前本地监控面板直接裸露到公网。

## Release Asset

建议每个公开版本至少带一张截图。

最少需要：

- 一张首页截图

更完整的版本可以再加：

- 风险区视图截图
- 第三方来源卡片截图
- CLI 终端截图

## Next

这版先完成三件事：

1. 切换对外产品名
2. 生成 README / CHANGELOG / 发布截图
3. 把版本提升到 `0.3.0`

Cloudflare 登录后，再做官网和域名接入。
