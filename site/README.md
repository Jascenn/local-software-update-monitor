# Lingyi App Watch Site

这个目录承载 `Lingyi App Watch` 的对外静态站点。

## 目录用途

- `index.html`：官网首页与使用说明
- `404.html`：Pages 单页兜底
- `_headers`：静态响应头
- `assets/`：截图等静态资源

## 部署约定

- GitHub 仓库：`Jascenn/local-software-update-monitor`
- Cloudflare Pages 项目：`lingyi-app-watch`
- Cloudflare Pages 根目录：`site`
- 线上域名：`https://watch.lingyi.tools`

## 维护方式

1. 从 `main` 拉分支
2. 修改 `site/` 内文件
3. 提交 Pull Request
4. 合并到 `main`
5. Cloudflare Pages 从 GitHub 自动拉取并部署
