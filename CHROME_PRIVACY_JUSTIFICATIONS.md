# Chrome Web Store 隐私权规范说明

本文档包含 AI Bookmarks 扩展在 Chrome Web Store 发布时所需的所有隐私权规范说明。

---

## 1. 单一用途说明（Single Purpose）

**字数：50-100 字**

本扩展的唯一功能是使用 AI 技术自动对用户的 Chrome 书签进行智能分类和标签管理。当用户添加新书签时，扩展会自动分析书签内容，生成相关标签，并将书签移动到对应的分类文件夹中，帮助用户更好地组织和管理书签。

---

## 2. 远程代码使用理由（Remote Code Justification）

**字数：100-150 字**

本扩展需要调用用户自行配置的 Cloudflare Worker API 来实现 AI 分析功能。远程 API 的作用是：接收书签的 URL 和标题，使用 AI 模型分析网页内容，生成相关的分类标签和主标签，然后将结果返回给扩展。

由于 AI 模型需要大量计算资源且模型文件体积庞大，无法在浏览器扩展中本地运行，因此必须通过远程 API 调用来实现。用户完全控制 API 的部署和配置，所有数据传输仅在用户的浏览器和用户自己的 Worker 服务之间进行，不会发送到第三方服务器。扩展不会收集、存储或分享用户的任何个人数据。

---

## 3. bookmarks 权限理由（Bookmarks Permission Justification）

**字数：100-150 字**

本扩展的核心功能是自动组织和分类书签，因此需要 bookmarks 权限来实现以下功能：

- 监听书签创建事件（chrome.bookmarks.onCreated）：当用户添加新书签时自动触发分类流程
- 监听书签移动事件（chrome.bookmarks.onMoved）：当用户将书签移动到根目录时自动进行分类
- 读取书签信息（chrome.bookmarks.get, getTree, getChildren）：获取书签的 URL、标题和位置信息
- 创建分类文件夹（chrome.bookmarks.create）：根据 AI 生成的标签自动创建对应的文件夹
- 移动书签（chrome.bookmarks.move）：将书签移动到对应的分类文件夹中

所有操作仅在用户的本地浏览器中进行，不会将书签数据上传到任何服务器。

---

## 4. notifications 权限理由（Notifications Permission Justification）

**字数：50-100 字**

本扩展使用 notifications 权限向用户显示以下通知：

- 配置缺失提醒：当用户首次使用扩展但未配置 Worker URL 和 API Key 时，提示用户进行配置
- 书签保存成功通知：当书签成功分类后，显示 AI 生成的标签信息，让用户了解书签被分类到哪些标签下

通知仅用于改善用户体验，不涉及任何数据收集或传输。

---

## 5. storage 权限理由（Storage Permission Justification）

**字数：50-100 字**

本扩展使用 storage 权限在本地存储以下数据：

- chrome.storage.sync：存储用户配置（Worker URL 和 API Key），这些配置可在用户的不同设备间同步
- chrome.storage.local：存储最后一个书签的信息和本地书签数据，用于在扩展弹窗中显示最近分类的书签

所有数据仅存储在用户的本地浏览器中，不会上传到任何服务器。扩展不会访问或收集用户的其他浏览数据。

---

## 数据隐私承诺

- 本扩展不会收集、存储或分享用户的任何个人数据
- 书签 URL 和标题仅发送到用户自行配置的 Worker API，不会发送到第三方服务器
- 所有配置和书签数据仅存储在用户的本地浏览器中
- 扩展不包含任何追踪代码或分析工具
- 扩展完全开源，用户可以审查所有源代码

---

## 技术说明

本扩展的工作流程：

1. 用户添加书签或将书签移动到根目录
2. 扩展读取书签的 URL 和标题
3. 扩展将 URL 和标题发送到用户配置的 Worker API
4. Worker API 使用 AI 分析网页内容并返回标签
5. 扩展根据标签创建文件夹并移动书签
6. 扩展显示通知告知用户分类结果

整个过程中，数据仅在用户的浏览器和用户自己的 Worker 服务之间传输。
