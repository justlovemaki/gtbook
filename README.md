# gtbook 🚀

> **gtbook** 是一个现代、简约且功能强大的收藏夹管理器，它完全在客户端运行，并使用 GitHub 仓库作为您的后端存储。

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)](https://tailwindcss.com/)

---

## ✨ 特性

-   📂 **GitHub 为后端**：直接使用 GitHub 仓库存储数据。无需数据库，数据完全由您掌控。
-   🤖 **AI 驱动**：
    -   **智能整理**：自动提取网页信息并建议分类。
    -   **语义搜索**：基于 AI 的深度搜索，找到您真正需要的内容。
    -   **结构重构**：一键优化收藏夹层级结构。
-   🛡️ **隐私与安全**：纯客户端运行。敏感配置（如 Token）加密后存储在本地（IndexedDB），不经过任何第三方服务器。
-   📖 **极致阅读体验**：
    -   内置 Markdown 渲染引擎。
    -   AI 阅读器：自动总结网页核心内容，过滤干扰。
-   💻 **现代化 UI/UX**：
    -   基于 Tailwind CSS 4 构建，支持 **深色模式**。
    -   流畅的交互动画（Framer Motion）。
    -   响应式设计，适配手机、平板及桌面端。
-   📱 **PWA 支持**：可作为应用安装到桌面或移动设备，支持离线保存更改。
-   🌐 **多语言支持**：原生支持中文和英文。

## 🛠️ 技术栈

-   **核心**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
-   **构建工具**: [Vite](https://vitejs.dev/)
-   **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
-   **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
-   **数据同步**: [TanStack Query (v5)](https://tanstack.com/query)
-   **UI 组件**: [Radix UI](https://www.radix-ui.com/)
-   **图标**: [Lucide React](https://lucide.dev/)
-   **动画**: [Framer Motion](https://www.framer.com/motion/)

## 🚀 快速开始

### 1. 准备工作

1.  创建一个 GitHub 仓库（建议设为私有）。
2.  生成一个 [GitHub 个人访问令牌 (PAT)](https://github.com/settings/tokens) (需要 `repo` 权限)。
3.  （可选）获取 [OpenAI API Key](https://platform.openai.com/) 以开启 AI 功能。

### 2. 本地运行

```bash
# 克隆项目
git clone https://github.com/your-username/gtbook.git
cd gtbook

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 3. Docker 部署

如果您希望使用 Docker 部署，可以使用以下命令：

```bash
# 使用 Docker Compose 启动
docker-compose up -d
```

启动后，可以通过 `http://localhost:8080` 访问。

### 4. 云平台部署

您可以将 **gtbook** 轻松部署到常见的静态托管平台。

#### Cloudflare Pages
1.  在 Cloudflare 控制台中选择 Page 点击 **Create a project** -> **Connect to Git**。
2.  选择您的仓库。
3.  在 **Build settings** 中配置：
    -   **Framework preset**: `Vite`
    -   **Build command**: `npm run build`
    -   **Build output directory**: `dist`
4.  （可选）在 **Environment variables** 中添加环境变量（如 `VITE_GITHUB_OWNER`）。
5.  点击 **Save and Deploy**。

#### Vercel
1.  在 Vercel 控制台中点击 **Add New** -> **Project**。
2.  导入您的仓库。
3.  Vercel 会自动识别 Vite 项目并配置好构建参数。如果没有，请确保：
    -   **Framework Preset**: `Vite`
    -   **Build Command**: `npm run build`
    -   **Output Directory**: `dist`
4.  点击 **Deploy**。

### 5. 配置

在应用启动后的“设置”界面中，填入您的 GitHub 信息（Repo Owner, Repo Name, Token）即可开始同步。

## 📝 数据结构

gtbook 将书签存储为仓库中的 `.md` 文件。它会解析 Markdown 标题作为文件夹结构，并将链接提取为书签项目。这种方式使得您的数据在任何编辑器中都清晰易读。

## 📜 脚本

-   `npm run dev`: 启动 Vite 开发服务器。
-   `npm run build`: 构建生产版本。
-   `npm run lint`: 运行 ESLint 检查。
-   `npm run test`: 运行 Vitest 测试。

## 📄 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE) 协议开源。
