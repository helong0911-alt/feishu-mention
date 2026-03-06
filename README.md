# FeishuMention Resolver - 飞书@提及解析器

## 📦 功能特性

- ✅ 自动将 `@name` 替换为 `<at>` XML 格式
- ✅ 支持 `@[user:ou_xxxx]` 特殊格式自动解析
- ✅ 支持多 bot（通过 app_id 区分）
- ✅ 支持多群（通过 chat_id 区分）
- ✅ API 结果本地缓存 2 小时
- ✅ Name 未命中时实时调用飞书 API 获取成员
- ✅ 仍未匹配则原样输出 @name
- ✅ 支持通过环境变量 `FEISHU_BOT_MAPPING` 配置静态映射（兼容旧名称）
- ✅ Token 根据 app_id 自动从环境变量获取

## 🚀 快速开始

```javascript
const { FeishuMentionResolver, resolve } = require('./index');

// 方法 1: 实例化（推荐复用）
const resolver = new FeishuMentionResolver();
const text = '你好 @张三';
const resolved = await resolver.resolveTextMentions(text, appId, chatId);

// 方法 2: 便捷函数
const staticMap = JSON.stringify({"@技术助手": "rs_tech_001"});
const result = await resolve('请 @技术助手 确认', appId, chatId, { staticMapping: staticMap });
```


## 📖 详细文档

查看 [SKILL.md](./SKILL.md) 了解更多：
- API 完整参考
- 缓存机制详解
- 集成到你的项目
- 常见问题解答

## 🔧 配置

设置环境变量获取 access_token：

```bash
export FEISHU_APP_ID=cliab1234567890abcdef
export FEISHU_APP_SECRET=your_app_secret_here
```

## 🧪 测试

```bash
# 运行基础测试
node test.js

# 运行使用示例
node assets/example_usage.js
```

## 📂 文件结构

```
feishu-mention/
├── SKILL.md           # 完整文档
├── README.md          # 本文件
├── index.js           # 主入口
├── test.js            # 测试脚本
├── QUICKSTART.md      # 快速上手指南
├── integration.md     # 集成指南
└── assets/
    ├── mention_resolver.js    # 核心实现 (JS)
    └── example_usage.js       # 使用示例
└── scripts/
    └── mention_resolver.py    # Python 版本实现
```

## ⚠️ 注意事项

1. **Access Token**: 需要在代码中实现 token 获取逻辑（参考飞书 OAuth 2.0）
2. **权限要求**: 需要企业通讯录读取权限
3. **缓存位置**: `~/.openclaw/workspace/cache/feishu_mentions/`

## 💡 关于静态映射 (Static Mappings)

有些用户（如机器人）不在企业通讯录中，或者你需要固定某些名字的映射关系，可以使用静态映射。

**方式一：环境变量配置**

在 `openclaw.json` 或 `.env` 中设置：
```json
FEISHU_BOT_MAPPING='{"@技术助手":"rs_bot_123", "@审批":"rs_bot_456"}'
```

**方式二：代码动态配置**

```javascript
import { addStaticMapping, saveBotConfig } from './index.js';

addStaticMapping('@技术助手', 'rs_bot_id_123');
await saveBotConfig(); // 保存到本地
```

**方式三：调用时传入（推荐用于 Skill 调用）**

```javascript
// 传入 JSON 字符串
const mapping = JSON.stringify({ "@Bot": "rs_123" });
resolve('请 @Bot 帮忙', appId, chatId, { staticMapping: mapping });
```

## 📄 License

MIT

---

**维护者**: OpenClaw AI Assistant  
**版本**: 1.4.0
**更新时间**: 2026-03-05
