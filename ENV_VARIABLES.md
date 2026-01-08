# 环境变量配置指南

## 🔴 必需的环境变量（必须设置）

### 1. APP_SECRET_KEY
**用途：** 用于加密存储的 API 密钥（Credentials）
**格式：** 任意字符串（建议使用长随机字符串）
**示例：**
```bash
APP_SECRET_KEY=your_secret_key_here_make_it_long_and_random_12345
```
**⚠️ 警告：** 如果未设置，应用将无法启动！

---

### 2. Google OAuth 配置（3个变量）

#### GOOGLE_CLIENT_ID
**用途：** Google OAuth Client ID
**获取方式：** Google Cloud Console → APIs & Services → Credentials
**示例：**
```bash
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
```

#### GOOGLE_CLIENT_SECRET
**用途：** Google OAuth Client Secret
**获取方式：** 与 GOOGLE_CLIENT_ID 在同一页面
**示例：**
```bash
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

#### GOOGLE_REDIRECT_URI
**用途：** Google OAuth 回调地址（必须与 Google Console 中配置的一致）
**格式：** `https://你的域名/api/auth/callback/google`
**示例：**
```bash
GOOGLE_REDIRECT_URI=https://world2-autogen.onrender.com/api/auth/callback/google
```
**⚠️ 重要：** 必须在 Google Cloud Console 的 "Authorized redirect URIs" 中添加此 URL

---

### 3. FRONTEND_URL
**用途：** 前端应用地址，用于登录后重定向
**格式：** `https://你的域名`（不要带路径）
**示例：**
```bash
FRONTEND_URL=https://world2-autogen.onrender.com
```
**⚠️ 重要：** 如果不设置，登录后会重定向到 `localhost:5173`，导致无法正常工作

---

## 🟡 可选的环境变量（有默认值）

### DATABASE_TYPE
**用途：** 数据库类型
**可选值：** `sqlite` 或 `postgres`
**默认值：** `sqlite`
**示例：**
```bash
DATABASE_TYPE=sqlite
# 或
DATABASE_TYPE=postgres
```

### DATABASE_URL
**用途：** 数据库连接字符串
**默认值：** 
- SQLite: `lorecard.db`
- PostgreSQL: `postgresql://user:password@localhost:5432/lorecard`
**示例（SQLite）：**
```bash
DATABASE_URL=lorecard.db
```
**示例（PostgreSQL）：**
```bash
DATABASE_URL=postgresql://user:password@host:5432/lorecard
```

### PORT
**用途：** 服务器监听端口
**默认值：** `3000`
**示例：**
```bash
PORT=3000
```

---

## 📋 Render 环境变量配置清单

在 Render Dashboard 中，进入你的服务 → Environment，添加以下变量：

### 必需变量（必须添加）：
```
APP_SECRET_KEY=你的密钥（长随机字符串）
GOOGLE_CLIENT_ID=你的_Google_Client_ID
GOOGLE_CLIENT_SECRET=你的_Google_Client_Secret
GOOGLE_REDIRECT_URI=https://world2-autogen.onrender.com/api/auth/callback/google
FRONTEND_URL=https://world2-autogen.onrender.com
```

### 可选变量（根据需要）：
```
DATABASE_TYPE=sqlite
PORT=3000
```

---

## ✅ 验证配置

配置完成后，检查日志中是否有以下信息：

1. **数据库连接成功：**
   ```
   Database connected: type=sqlite file=...
   ```

2. **Google OAuth 配置检查：**
   - 如果配置错误，会看到：`Google OAuth not configured`

3. **登录重定向：**
   - 登录成功后，日志会显示：`Redirecting to: https://world2-autogen.onrender.com/...`

---

## 🔧 常见问题

### Q: 为什么登录后跳转到 localhost？
**A:** `FRONTEND_URL` 环境变量没有设置或设置错误。

### Q: 为什么出现 redirect_uri_mismatch 错误？
**A:** `GOOGLE_REDIRECT_URI` 与 Google Console 中配置的不一致。

### Q: 为什么应用无法启动？
**A:** 检查 `APP_SECRET_KEY` 是否设置。

---

## 📝 完整示例（.env 文件）

```bash
# 必需变量
APP_SECRET_KEY=your_very_long_and_random_secret_key_123456789
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_REDIRECT_URI=https://world2-autogen.onrender.com/api/auth/callback/google
FRONTEND_URL=https://world2-autogen.onrender.com

# 可选变量
DATABASE_TYPE=sqlite
PORT=3000
```

