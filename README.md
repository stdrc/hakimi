# Hakimi

Hakimi 让你通过 Telegram/Slack/飞书 与 AI 助手对话，远程控制你的电脑。

## 快速开始

### 1. 安装

```bash
npm install
```

### 2. 启动

```bash
npm run dev
```

调试模式（显示详细日志）：

```bash
npm run dev -- --debug
```

### 3. 登录 Kimi Code

按 `L` 登录 Kimi Code 账号，按照提示在浏览器完成授权。

### 4. 配置

按 `C` 进入配置向导，AI 助手会引导你完成：
- 给你的 AI 助手起个名字
- 配置聊天平台（Telegram/Slack/飞书）

### 5. 开始使用

按 `S` 启动服务，然后在聊天平台给你的 Bot 发消息即可。

## 支持的平台

### Telegram

1. 在 Telegram 搜索 @BotFather
2. 发送 `/newbot` 创建机器人
3. 获取 Bot Token

### Slack

1. 访问 https://api.slack.com/apps 创建应用
2. 获取 App-Level Token (`xapp-...`)
3. 获取 Bot User OAuth Token (`xoxb-...`)

### 飞书

1. 访问 https://open.feishu.cn 创建应用
2. 获取 App ID 和 App Secret

## 配置文件位置

- Kimi Code：`~/.kimi/config.toml`
- Hakimi：`~/.hakimi/config.toml`

## 快捷键

| 键 | 功能 |
|---|------|
| L | 登录 Kimi Code |
| C | 配置向导 |
| S | 启动/停止服务 |
| Q | 退出 |
| Esc | 返回/取消 |
