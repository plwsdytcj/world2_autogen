# Facebook 数据源使用指南

## 功能概述

现在你可以从 Facebook 页面抓取内容来生成角色卡！系统会自动：
- 识别 Facebook URL
- 使用 Apify 抓取帖子和头像
- 将内容格式化为 Markdown
- 提取头像作为角色卡 avatar 备选

## 使用步骤

### 第一步：添加 Apify Credential

1. 打开浏览器，访问应用
2. 点击导航栏的 **Credential**
3. 点击 **Add New Credential** 按钮
4. 填写表单：
   - **Credential Name**: 例如 `My Apify Token`
   - **Provider Type**: 选择 `Apify (Facebook Scraper)`
   - **Apify API Token**: 输入你的 Apify token（格式：`apify_api_xxx...`）
5. 点击 **Create Credential** 保存

> 💡 **获取 Apify Token**: 
> - 访问 https://console.apify.com/account/integrations
> - 登录或注册账号
> - 复制你的 API token

### 第二步：创建 Character 项目

1. 点击导航栏的 **Project**
2. 点击 **Create New Project**
3. 选择项目类型：**Character**
4. 填写项目信息：
   - **Project Name**: 例如 `Nintendo Character`
   - **High-level Prompt**: 描述你想要生成的角色
   - **Credential**: 选择你的 LLM credential（用于生成角色卡）
   - **Model**: 选择模型
5. 点击 **Create Project**

### 第三步：添加 Facebook 数据源

1. 在项目页面，找到 **Context Sources** 部分
2. 点击 **Add** 按钮
3. 在 **Source URL** 输入框中输入 Facebook URL，例如：
   - `https://www.facebook.com/nintendo`
   - `https://www.facebook.com/plwsdyt`
   - `https://www.facebook.com/username`
4. 点击 **Add** 保存

> ✅ **自动识别**: 系统会自动识别 Facebook URL 并显示蓝色 **Facebook** 徽章

### 第四步：抓取 Facebook 内容

1. 在数据源列表中，找到你刚添加的 Facebook 数据源
2. 点击 **下载图标** (Fetch/Re-fetch Content)
3. 等待抓取完成（会显示进度条）
4. 抓取成功后，数据源会显示：
   - ✅ **Fetched** 绿色徽章
   - 📊 内容字符数（tokens 估算）

> ⏱️ **抓取时间**: 通常需要 10-30 秒，取决于帖子数量

### 第五步：查看抓取结果

1. 点击数据源旁边的 **眼睛图标** (View Content)
2. 查看抓取到的内容：
   - 页面信息（名称、ID）
   - 帖子列表（文本、点赞、评论数）
   - 图片 URL（如果有）

> 🖼️ **头像**: 头像图片会出现在图片列表的第一位，优先作为 avatar 使用

### 第六步：生成角色卡

1. **勾选**已抓取的 Facebook 数据源（复选框）
2. 在 **Character Card** 部分，点击 **Generate** 按钮
3. 系统会使用 Facebook 内容生成：
   - **Name**: 角色名称
   - **Description**: 角色描述
   - **Persona**: 角色性格
   - **Scenario**: 场景设定
   - **First Message**: 首条消息
   - **Example Messages**: 示例对话
   - **Avatar**: 使用 Facebook 头像（如果可用）

## 支持的 Facebook URL 类型

- ✅ Facebook 页面: `https://www.facebook.com/pagename`
- ✅ Facebook 个人资料: `https://www.facebook.com/username`
- ✅ Facebook 群组: `https://www.facebook.com/groups/groupname`
- ✅ Facebook 帖子: `https://www.facebook.com/.../posts/...`

## 配置选项

### 抓取数量限制

在添加数据源时，`max_pages_to_crawl` 字段控制抓取的帖子数量：
- 默认值：20 条帖子
- 范围：1-100
- 建议：5-10 条帖子通常足够生成角色卡

## 常见问题

### Q: 抓取失败怎么办？

**A**: 检查以下几点：
1. ✅ Apify credential 是否正确配置
2. ✅ Apify token 是否有效且有足够额度
3. ✅ Facebook URL 是否可公开访问
4. ✅ 网络连接是否正常

### Q: 为什么看不到头像？

**A**: 可能原因：
- 该 Facebook 页面没有设置头像
- 头像设置为私密
- 抓取时出现错误（检查浏览器控制台）

### Q: 可以抓取私密页面吗？

**A**: 不可以。只能抓取公开的 Facebook 页面和帖子。

### Q: 抓取会消耗 Apify 额度吗？

**A**: 是的，每次抓取都会消耗 Apify 的计算单元。建议：
- 使用 Apify 的免费额度测试
- 根据需要调整抓取数量
- 避免频繁重复抓取同一页面

## 技术细节

### 工作流程

```
用户添加 Facebook URL
    ↓
系统检测到 Facebook URL
    ↓
调用 Apify Facebook Posts Scraper
    ↓
解析返回的数据（帖子、头像、元数据）
    ↓
格式化为 Markdown
    ↓
提取图片 URL（头像优先）
    ↓
存储到 ProjectSource
    ↓
用户选择数据源生成角色卡
```

### 数据格式

抓取的内容会格式化为以下 Markdown 结构：

```markdown
# Facebook Content: [页面名]

## Page Information
**Name:** [页面名]
**URL:** [页面URL]
**ID:** [Facebook ID]

## Posts ([数量] total)

### Post 1
*[时间]*

[帖子内容]

*👍 [点赞数] | 💬 [评论数] | 🔄 [分享数]*

[View post]([帖子链接])
```

## 示例

### 示例 1: 抓取 Nintendo 页面

1. URL: `https://www.facebook.com/nintendo`
2. 抓取结果：
   - 5-10 条最新帖子
   - Nintendo 官方头像
   - 游戏相关内容和图片
3. 生成角色卡：可以生成一个 Nintendo 品牌角色

### 示例 2: 抓取个人账号

1. URL: `https://www.facebook.com/plwsdyt`
2. 抓取结果：
   - 个人帖子历史
   - 个人头像
   - 个人风格和内容
3. 生成角色卡：可以基于该用户的风格生成角色

## 注意事项

⚠️ **重要提示**:
- 确保遵守 Facebook 的使用条款
- 不要抓取他人私密内容
- 合理使用 Apify 服务，避免过度抓取
- 抓取的内容仅用于生成角色卡，请勿用于其他用途

## 获取帮助

如果遇到问题：
1. 检查浏览器控制台（F12）的错误信息
2. 查看后端服务器日志
3. 确认 Apify token 有效
4. 尝试使用其他公开的 Facebook 页面测试

