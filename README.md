# AI Bookmarks

使用 AI 自动对书签进行分类的智能书签管理系统。

## 项目简介

AI Bookmarks 是一个基于 AI 的书签管理系统，能够自动分析网页内容并为书签生成智能标签。系统由两部分组成：

- **Cloudflare Worker 后端**：使用 Hono 框架构建的 API 服务，集成 Cloudflare AI 和 D1 数据库
- **浏览器扩展前端**：Chrome/Edge 扩展，提供书签同步和管理功能

## 功能特性

- 自动抓取网页元数据（标题、描述、Open Graph 信息）
- 使用 Cloudflare AI 自动生成智能标签
- 按标签自动组织书签到文件夹
- 支持多语言标签生成
- 云端存储，多设备同步

## 技术栈

### 后端
- Cloudflare Workers
- Hono Web Framework
- Cloudflare D1 (SQLite)
- Cloudflare AI (@cf/qwen/qwen3-30b-a3b-fp8)
- TypeScript

### 前端
- Chrome Extension Manifest V3
- TypeScript
- Vite

## 前置要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账号
- Chrome 或 Edge 浏览器

## 部署指南

### 1. 克隆项目

```bash
git clone <repository-url>
cd ai-bookmarks
```

### 2. 安装依赖

```bash
# 安装 Worker 依赖
cd worker
npm install

# 安装扩展依赖
cd ../extension
npm install
```

### 3. 配置 Cloudflare Worker

#### 3.1 创建 D1 数据库

在 `worker` 目录下运行：

```bash
cd worker
npm run db:create
```

命令执行后会输出数据库信息，包含 `database_id`，类似：

```
✅ Successfully created DB 'ai-bookmarks-db'
database_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**保存这个 database_id，下一步需要用到。**

#### 3.2 配置 wrangler.toml

编辑 `worker/wrangler.toml` 文件：

```toml
[vars]
API_KEY = "your-secret-api-key-here"  # 替换为你的 API 密钥（自定义，用于扩展认证）

[[d1_databases]]
binding = "DB"
database_name = "ai-bookmarks-db"
database_id = "your-database-id"  # 替换为上一步获取的 database_id
```

**重要说明：**
- `API_KEY`：自定义一个安全的密钥，浏览器扩展将使用此密钥访问 API
- `database_id`：使用 `npm run db:create` 命令输出的实际 ID

#### 3.3 初始化数据库

运行数据库迁移脚本：

```bash
npm run db:migrate
```

### 4. 部署 Worker

```bash
npm run deploy
```

部署成功后会输出 Worker URL，类似：

```
Published ai-bookmarks-worker
  https://ai-bookmarks-worker.your-subdomain.workers.dev
```

**保存这个 URL，配置浏览器扩展时需要用到。**

### 5. 构建浏览器扩展

```bash
cd ../extension
npm run build
```

构建完成后，扩展文件会生成在 `extension/dist` 目录。

### 6. 安装浏览器扩展

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/` (Chrome) 或 `edge://extensions/` (Edge)
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `extension/dist` 目录

### 7. 配置扩展

1. 点击浏览器工具栏中的扩展图标
2. 点击"设置"按钮
3. 填写配置信息：
   - **Worker URL**：第 4 步部署时获取的 Worker URL
   - **API Key**：`wrangler.toml` 中配置的 `API_KEY`
4. 点击"保存配置"

## 使用说明

### 添加书签

扩展会自动监听浏览器书签的添加事件。当你添加新书签时：

1. 扩展自动抓取网页元数据
2. 调用 Cloudflare AI 生成智能标签
3. 将书签和标签保存到云端数据库

### 同步书签

1. 点击扩展图标打开弹窗
2. 点击"同步书签"按钮
3. 扩展会从云端下载所有书签
4. 自动在"其他书签"文件夹中按标签创建文件夹
5. 将书签组织到对应的标签文件夹中

### 浏览书签

在扩展弹窗中：
- 查看所有标签及书签数量
- 点击标签查看该标签下的所有书签
- 点击书签在新标签页中打开

## API 接口

### 获取所有书签

```bash
GET /api/bookmarks
Headers:
  X-API-Key: your-api-key
```

响应：

```json
{
  "bookmarks": [
    {
      "id": 1,
      "url": "https://example.com",
      "title": "Example",
      "primary_tag": "技术",
      "tags": [
        { "name": "技术", "confidence": 0.95 },
        { "name": "编程", "confidence": 0.85 }
      ]
    }
  ],
  "total": 1
}
```

### 添加书签

```bash
POST /api/bookmarks
Headers:
  X-API-Key: your-api-key
  Content-Type: application/json

Body:
{
  "url": "https://example.com",
  "title": "Example",
  "language": "zh"
}
```

响应：

```json
{
  "id": 1,
  "url": "https://example.com",
  "title": "Example",
  "primary_tag": "技术",
  "tags": ["技术", "编程"]
}
```

## 数据库结构

### bookmarks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| url | TEXT | 网址（唯一） |
| title | TEXT | 标题 |
| description | TEXT | 描述 |
| og_title | TEXT | Open Graph 标题 |
| og_description | TEXT | Open Graph 描述 |
| og_type | TEXT | Open Graph 类型 |
| extracted_text | TEXT | 提取的文本内容 |
| primary_tag | TEXT | 主标签 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### tags 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 标签名称 |
| canonical_name | TEXT | 规范化名称（唯一） |

### bookmark_tags 表

| 字段 | 类型 | 说明 |
|------|------|------|
| bookmark_id | INTEGER | 书签 ID |
| tag_id | INTEGER | 标签 ID |
| confidence | REAL | 置信度 (0-1) |

## 开发

### 本地开发 Worker

```bash
cd worker
npm run dev
```

Worker 会在本地启动，默认地址：`http://localhost:8787`

### 本地开发扩展

```bash
cd extension
npm run dev
```

Vite 会监听文件变化并自动重新构建。修改代码后，在浏览器扩展页面点击"重新加载"即可。

## 故障排除

### Worker 部署失败

- 确认已登录 Cloudflare：`wrangler login`
- 检查 `wrangler.toml` 配置是否正确
- 确认 D1 数据库已创建并初始化

### 扩展无法连接 Worker

- 检查 Worker URL 是否正确（包含 https://）
- 确认 API Key 与 `wrangler.toml` 中的配置一致
- 在浏览器开发者工具中查看网络请求和错误信息

### 书签同步失败

- 确认已正确配置 Worker URL 和 API Key
- 检查 Worker 是否正常运行：访问 `https://your-worker-url/health`
- 查看浏览器控制台的错误信息

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request。
