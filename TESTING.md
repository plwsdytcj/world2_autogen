# 本地测试指南

## 前置条件

1. **配置环境变量** (`server/.env`):
```bash
APP_SECRET_KEY=your_secret_key_here
GOOGLE_CLIENT_ID=你的_Google_Client_ID
GOOGLE_CLIENT_SECRET=你的_Google_Client_Secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
FRONTEND_URL=http://localhost:5173
```

2. **确保数据库迁移已运行**:
   - 迁移文件会自动在服务器启动时运行
   - 检查 `0014_add_users.sqlite.sql` 和 `0015_add_user_to_credential.sqlite.sql` 是否已应用

## 启动服务

### 1. 启动后端服务器

```bash
cd server
source .venv/bin/activate
export APP_SECRET_KEY="test_secret_key_12345"
export GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"
export FRONTEND_URL="http://localhost:5173"
python src/main.py
```

服务器应该在 `http://localhost:3000` 启动

### 2. 启动前端开发服务器

```bash
cd client
pnpm dev
```

前端应该在 `http://localhost:5173` 启动

## 测试步骤

### 测试 1: 健康检查

```bash
curl http://localhost:3000/api/health
```

应该返回: `{"status": "ok"}`

### 测试 2: Google OAuth 登录 URL

```bash
curl -I http://localhost:3000/api/auth/login/google
```

应该返回 302 重定向到 Google OAuth 页面

### 测试 3: 未认证访问项目列表

```bash
curl http://localhost:3000/api/projects
```

应该返回空数组 `{"data": [], "meta": {...}}` (因为没有认证，user_id 为 null)

### 测试 4: 完整登录流程

1. 在浏览器访问: `http://localhost:5173`
2. 应该看到登录页面
3. 点击 "Sign in with Google"
4. 完成 Google OAuth 流程
5. 重定向回前端，URL hash 中包含 tokens
6. 前端自动提取 tokens 并保存
7. 应该能看到项目列表页面

### 测试 5: 数据隔离验证

1. 用两个不同的 Google 账号登录
2. 每个账号创建项目
3. 验证：
   - 账号 A 只能看到自己的项目
   - 账号 B 只能看到自己的项目
   - 账号 A 不能访问账号 B 的项目

### 测试 6: Credentials 隔离

1. 登录后创建 API Key 凭证
2. 验证：
   - 只能看到自己的凭证
   - 不能删除其他用户的凭证
   - 全局凭证（user_id = NULL）所有用户可见但不能删除

## 使用测试脚本

```bash
cd server
source .venv/bin/activate
python test_auth.py
```

## 常见问题

### 问题 1: "Google OAuth not configured"

**解决**: 确保 `.env` 文件中设置了 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`

### 问题 2: 迁移失败

**解决**: 检查数据库文件权限，确保 SQLite 数据库可写

### 问题 3: 前端无法连接后端

**解决**: 
- 检查后端是否在 `http://localhost:3000` 运行
- 检查 CORS 配置（`main.py` 中的 `cors_config`）

### 问题 4: 登录后看不到项目

**解决**: 
- 检查浏览器控制台是否有错误
- 检查 `localStorage` 中是否有 `lorecard-auth` 数据
- 验证 JWT token 是否有效

## 调试技巧

1. **查看服务器日志**: 服务器启动时会输出详细日志
2. **检查浏览器控制台**: F12 打开开发者工具
3. **检查网络请求**: Network 标签查看 API 请求和响应
4. **验证数据库**: 使用 SQLite 工具查看数据库内容

```bash
sqlite3 server/lorecard.db
.tables
SELECT * FROM User;
SELECT * FROM Project;
SELECT * FROM Credential;
```

