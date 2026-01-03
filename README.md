# 一只绵羊的春天（微信小程序）

微信小程序项目，主题为「春日扬帆」。包含庭院/音乐/蹄印等核心页面，并提供登录、打卡、会员、收藏与服务相关功能。

## 基本信息

- 小程序类型：`miniprogram`
- 开发者工具基础库：`3.12.0`
- AppID：`wxb9f2533915001854`
- 云函数目录：`cloudfunctions/`
- 语音插件：`WechatSI (0.3.1)`

## 页面与入口

- 主要 Tab 页面：`pages/garden` / `pages/music` / `pages/hoofprint`
- 其他页面：文章详情、登录、个人中心、打卡、会员、收藏、服务中心

## 本地开发

1. 使用微信开发者工具打开本目录。
2. 在工具中确认「云开发」环境与云函数根目录为 `cloudfunctions/`。
3. 需要用到云函数时，在微信开发者工具中安装依赖并上传/部署对应云函数。

## 目录结构（节选）

- `pages/`：页面代码
- `custom-tab-bar/`：自定义 tabBar
- `cloudfunctions/`：云函数
- `assets/`：图片、音频等资源
- `utils/`：工具模块

## 安全提示

目录中存在支付证书/私钥等敏感文件（如 `apiclient_key.pem`、`apiclient_cert.pem`），暂未上传到公开仓库。

