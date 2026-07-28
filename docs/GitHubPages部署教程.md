# 《第二绿洲》GitHub Pages 部署超详细教程

目标：把项目部署到 `https://msmapwr.github.io/the-second-oasis/`

---

## 一、前置条件

确保本机已安装：

- **Git**：`git --version`
- **Node.js 22+**：`node --version`
- **GitHub CLI (gh)**：`gh --version`（可选，但下面脚本用它创建仓库最方便）

如果没有 `gh`，去这里下载：
https://cli.github.com/

或者用 GitHub 网页手动创建仓库。

---

## 二、GitHub Pages 是什么

GitHub Pages 是一个**免费的静态网站托管服务**。

它能托管的文件类型：
- HTML
- CSS
- JavaScript
- 图片、字体、音频、视频

它**不能**运行：
- Node.js 后端
- 数据库
- WebSocket 服务器（所以联机功能在 Pages 上跑不了，只能玩单机）

我们的《第二绿洲》用 Vite 构建后，会生成一个 `dist/` 文件夹，里面全是静态文件。GitHub Pages 要的就是这个 `dist/`。

---

## 三、当前项目已经配置好的东西

你不需要从零写配置，项目里已经准备好了：

### 1. `package.json` 里的脚本

```json
{
  "scripts": {
    "build:gh": "tsc --noEmit && vite build --base=/the-second-oasis/",
    "preview:gh": "vite preview --base=/the-second-oasis/"
  }
}
```

- `build:gh`：编译项目，所有资源路径以 `/the-second-oasis/` 为根。
- `preview:gh`：本地模拟 GitHub Pages 的访问路径。

### 2. `vite.config.ts`

```ts
base: process.env.GH_PAGES_BASE ?? '/',
```

默认本地开发用 `/`，部署时通过命令行 `--base=/the-second-oasis/` 覆盖。

### 3. `.github/workflows/deploy.yml`

自动部署工作流，push 到 `main` 分支时触发：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build:gh
      - run: cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

---

## 四、完整部署步骤（一步一步跟着做）

### 步骤 1：打开项目目录

```bash
cd "D:\Project Regolith\Code"
```

### 步骤 2：确认构建能通过

```bash
npm run build:gh
```

正常输出应该类似：

```
> the-second-oasis@0.1.0 build:gh
> tsc --noEmit && vite build --base=/the-second-oasis/

vite v5.4.21 building for production...
transforming...
✓ 78 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.33 kB │ gzip:  0.28 kB
dist/assets/index-Dt4sjEWi.js  143.78 kB │ gzip: 43.53 kB │ map: 500.41 kB
✓ built in 1.90s
```

如果这里报错，先解决错误再往下走。常见错误：
- TypeScript 类型错误 → 运行 `npm run typecheck` 看详细错误
- 依赖没装 → 运行 `npm install`

### 步骤 3：本地预览（可选但推荐）

```bash
npm run preview:gh
```

然后浏览器打开：

```
http://localhost:4173/the-second-oasis/
```

注意路径里有 `/the-second-oasis/`，和线上保持一致。

### 步骤 4：初始化 Git 仓库（如果还没初始化）

```bash
git init
git branch -M main
```

如果已经是 git 仓库，跳过这步。

### 步骤 5：提交所有文件

```bash
git add .
git commit -m "build: 准备 GitHub Pages 部署"
```

### 步骤 6：在 GitHub 上创建仓库

#### 方式 A：用 GitHub CLI（推荐）

```bash
gh repo create the-second-oasis --public --source=. --push
```

这会自动：
- 在你的 GitHub 账号下创建 `the-second-oasis` 仓库
- 把本地代码推上去

#### 方式 B：手动在网页创建

1. 打开 https://github.com/new
2. Repository name 填 `the-second-oasis`
3. 选 Public
4. 不要勾选 README、.gitignore、license
5. 点 Create repository
6. 复制页面上的 push 命令，通常是：

```bash
git remote add origin https://github.com/msmapwr/the-second-oasis.git
git branch -M main
git push -u origin main
```

### 步骤 7：开启 GitHub Pages

打开：

```
https://github.com/msmapwr/the-second-oasis/settings/pages
```

在 **Build and deployment** 部分：

1. **Source** 选择 **GitHub Actions**
2. 不用选分支，直接关闭页面

> 注意：不要选 "Deploy from a branch"，因为我们要用自动构建的 `dist/` 文件夹。

### 步骤 8：触发第一次部署

确保 `main` 分支有最新代码：

```bash
git push origin main
```

然后打开 GitHub 仓库的 Actions 页面：

```
https://github.com/msmapwr/the-second-oasis/actions
```

你会看到一个正在运行的 workflow，叫 "Deploy to GitHub Pages"。

等它变绿（大概 1~2 分钟）。

### 步骤 9：访问网站

```
https://msmapwr.github.io/the-second-oasis/
```

第一次访问可能需要等 2~3 分钟才能刷出来，GitHub Pages 有缓存。

---

## 五、以后更新代码怎么部署

非常简单，只需要 3 条命令：

```bash
git add .
git commit -m "更新内容"
git push origin main
```

push 后 GitHub Actions 会自动重新构建并部署。

---

## 六、常见问题排查

### 问题 1：页面空白，控制台报 404

**原因**：资源路径不对。

**检查**：打开 `dist/index.html`，看 script 标签的 src 是不是：

```html
<script type="module" crossorigin src="/the-second-oasis/assets/index-xxx.js"></script>
```

如果不是，说明 base 没设对。重新运行：

```bash
npm run build:gh
```

### 问题 2：直接刷新页面报 404

**原因**：GitHub Pages 不知道前端路由。

**解决**：`deploy.yml` 里已经做了：

```yaml
- run: cp dist/index.html dist/404.html
```

这会让 GitHub Pages 把所有不存在的路径都返回 `index.html`，让前端路由自己处理。

### 问题 3：GitHub Actions 构建失败

打开 Actions 页面看日志：

```
https://github.com/msmapwr/the-second-oasis/actions
```

常见原因：

#### 原因 A：`npm ci` 失败

错误信息类似：

```
npm ci can only install packages when your package.json and package-lock.json are in sync
```

**解决**：

```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: 更新 lock 文件"
git push origin main
```

#### 原因 B：TypeScript 类型检查失败

**解决**：

```bash
npm run typecheck
```

按报错修复类型错误。

### 问题 4：本地 `npm run build:gh` 成功，但线上样式/图片缺失

**原因**：代码里写了绝对路径 `/assets/xxx.png`。

**解决**：所有资源都要用相对路径或 `import`：

```ts
// ❌ 不要用
const img = '/assets/dice.png';

// ✅ 用 import
import diceUrl from '../assets/dice.png';
const img = diceUrl;
```

这样 Vite 会自动处理路径。

### 问题 5：访问的是 `404 There isn't a GitHub Pages site here`

**原因**：
1. 仓库名不对（必须是 `the-second-oasis`）
2. Pages 还没开启
3. Actions 还没运行完

**解决**：
- 确认仓库名是 `the-second-oasis`
- 确认 Settings → Pages → Source 是 GitHub Actions
- 等 2~3 分钟再刷新

---

## 七、进阶：自定义域名（可选）

如果你想用 `https://www.yourdomain.com` 而不是 GitHub 默认域名：

### 步骤 1：在项目里创建 CNAME 文件

```bash
echo "www.yourdomain.com" > public/CNAME
```

> `public/` 文件夹里的东西会被 Vite 原样复制到 `dist/`。

### 步骤 2：提交

```bash
git add public/CNAME
git commit -m "添加自定义域名"
git push origin main
```

### 步骤 3：在你的域名服务商那里添加 DNS 记录

类型：`CNAME`

名称：`www`

值：`msmapwr.github.io`

### 步骤 4：在 GitHub 仓库里验证域名

打开：

```
https://github.com/msmapwr/the-second-oasis/settings/pages
```

在 Custom domain 里填 `www.yourdomain.com`，点 Save。

---

## 八、进阶：手动部署到 `gh-pages` 分支（不推荐，但备用）

如果你不想用 GitHub Actions，可以手动把 `dist/` 推送到 `gh-pages` 分支：

```bash
npm run build:gh
git add dist -f
git commit -m "deploy to gh-pages"
git subtree push --prefix dist origin gh-pages
```

然后在 GitHub Settings → Pages 里：

- Source 选 **Deploy from a branch**
- Branch 选 `gh-pages`，文件夹 `/ (root)`

> 缺点：每次都要手动运行命令，容易忘。推荐用 GitHub Actions。

---

## 九、核心命令速查表

| 目的 | 命令 |
|------|------|
| 本地开发 | `npm run dev` |
| 本地构建（base=/） | `npm run build` |
| 构建 GitHub Pages 版本 | `npm run build:gh` |
| 本地预览 GitHub Pages 版本 | `npm run preview:gh` |
| TypeScript 类型检查 | `npm run typecheck` |
| 运行测试 | `npm run test` |
| 推送到 GitHub | `git push origin main` |
| 手动触发部署 | 到 Actions 页面点 "Run workflow" |

---

## 十、验证清单

部署完成后，逐条检查：

- [ ] 仓库名是 `the-second-oasis`
- [ ] `git push origin main` 成功
- [ ] GitHub Settings → Pages → Source 是 GitHub Actions
- [ ] Actions 页面 workflow 运行成功（绿色勾）
- [ ] 访问 `https://msmapwr.github.io/the-second-oasis/` 能看到游戏
- [ ] 点击游戏内跳转后，直接刷新页面不 404
