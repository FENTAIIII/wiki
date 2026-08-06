# 酚酞的桌游宇宙

这是 [酚酞的桌游宇宙](https://fentaiiii.github.io/wiki/) 的站点源码。

当前收录：

- Sanguo 三国杀插件 Wiki；
- doudizhu 斗地主插件 Wiki。

站点使用 Docusaurus，正文位于 `site/docs/`，推送到 `main` 后由 GitHub Actions
构建并发布到 GitHub Pages。

## 本地检查

```bash
cd site
npm ci
npm run typecheck
npm run build
```
