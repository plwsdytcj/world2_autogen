# Mobile Import via Deep Links and QR

## Goals

- Web 端生成的角色卡（Character）或 Lorebook，可在手机端 App 中一键导入。
- 提供可扫码的 Deep Link（Universal Link/自定义 Scheme），并支持安全、限时、限次访问。
- 不暴露用户凭据；导出内容仅包含卡片/Lorebook 数据本身。

## Data Formats

- Character
  - PNG v2：JSON 以 base64 形式写入 PNG `chara` 文本块（已支持）。
  - JSON：已支持 `GET /api/projects/{project_id}/character/export?format=json`。
- Lorebook
  - JSON：`GET /api/projects/{project_id}/lorebook/download`（已支持）。

两类数据统一抽象为：

- `content_type ∈ { character, lorebook }`
- `export_format ∈ { json, png }`（Lorebook 固定为 json）

## Deep Link 形态

- Universal Link（推荐）：`https://share.lorecard.app/i?s=<share_id>&t=<c|l>&v=1`
- 自定义 Scheme（兜底）：`lorecard://import?s=<share_id>&t=<c|l>&v=1`
- 说明：
  - `s`：分享 ID，例如 `sh_ab12cd`。
  - `t`：内容类型（`c`=character, `l`=lorebook）。
  - `v`：协议版本，当前 `1`。

可选（默认关闭）：内联数据 `d=<base64url(deflate(json))>`，仅对体积很小的 JSON 开放，避免超长二维码。

## 安全模型

- Share 资源（短期导出视图）：
  - 限时（`expires_at`）与限次（`max_uses`）。
  - 访问需要 `token`，后端存储 `token_hash`，不存明文。
  - 可通过 `resolve` 交换出短期 `download_url`，也可直接在 `content` 携带 token（初期实现）。
- 速率限制与审计：记录使用次数、时间、来源 UA/IP（最小必要）。

## 后端 API（v1）

1) `POST /api/shares`

请求：

```json
{
  "project_id": "<id>",
  "content_type": "character|lorebook",
  "export_format": "json|png",
  "expires_in_s": 3600,        // 可选，默认 3600
  "max_uses": 3                // 可选，默认 3
}
```

响应：

```json
{
  "share_id": "sh_ab12cd",
  "token": "<one-time-token>",
  "links": {
    "universal": "https://share.lorecard.app/i?s=sh_ab12cd&t=c&v=1",
    "scheme": "lorecard://import?s=sh_ab12cd&t=c&v=1"
  }
}
```

2) `POST /api/shares/{share_id}/resolve`

请求：`{ "token": "..." }`

响应（初期实现返回带 token 的直连）：

```json
{
  "download_url": "/api/shares/sh_ab12cd/content?token=...",
  "content_type": "character",
  "export_format": "json|png",
  "filename": "<suggested>"
}
```

3) `GET /api/shares/{share_id}/content?token=...`

- 返回 `application/json`（Lorebook/Character JSON）或 `image/png`（Character PNG v2）。
- 成功后 `uses++`；超过 `max_uses` 或过期返回 `410 Gone`。

## 数据库

新表 `Share`：

- `id TEXT PK`（形如 `sh_<shortid>`）
- `content_type TEXT`（`character|lorebook`）
- `project_id TEXT`
- `export_format TEXT`（`json|png`）
- `token_hash TEXT`
- `expires_at TIMESTAMP`
- `max_uses INT`，`uses INT DEFAULT 0`
- `created_at/updated_at`（默认当前时间）

## Web 前端

- 在 Character/Lorebook 导出区域增加“Export to Mobile”。
- 调用 `POST /api/shares` 创建分享，展示生成的 QR（内容为 Universal Link）。
- 提供复制链接与下载二维码 PNG。

## iOS 客户端

- Universal Links（推荐）或自定义 Scheme。
- 扫码或点击链接 → 解析 `share_id` → 调用 `resolve` → 下载 `content` → 导入。
- Character：
  - PNG v2：从 PNG 文本块 `chara` 读取 base64(JSON) 并解析。
  - JSON：直接解析。
- Lorebook：直接解析 JSON。

## 版本化

- Deep Link `v=1`。
- 响应头可携带 `X-Lorecard-Schema`（如 `lorebook.v1`）。

## 初期取舍（MVP）

- `resolve` 返回带 `token` 的直链（无需额外一次性签名）；后续可升级为一次性临时签名 URL。
- 内容实时生成（角色卡 PNG 在请求时生成），如有性能瓶颈再引入 `storage_ref` 预生成缓存。

