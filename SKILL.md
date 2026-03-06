---
name: feishu-mention
description: |
  **MANDATORY TOOL FOR FEISHU MESSAGING**.
  
  You **MUST** use this skill to process **EVERY** text message destined for Feishu (Lark) that contains or might contain an "@" mention (e.g., "@User", "@Bot", "@All").
  
  **Trigger**: ANY intent to send a message to Feishu/Lark.
  
  **Why**: Raw text like `@User` does NOT notify users in Feishu. It fails silently. You MUST convert it to Feishu's XML format using this skill.
  
  **Workflow**:
  1. Draft the text response.
  2. Call `feishu-mention.resolve` with the draft text.
  3. Send the *output* of this tool to the Feishu API.

  **Context Requirements**:
  - `appId`: Feishu App ID (starts with `cli_`). REQUIRED.
  - `chatId`: Feishu Chat ID (starts with `oc_`). REQUIRED.
  - `staticMapping`: JSON string for bot/static mappings (e.g. `{"@TechBot": "ou_xxx"}`). REQUIRED (pass `{}` if empty).

actions:
  resolve:
    description: Resolve all mentions in the text
    params:
      text: The message text to parse
      appId: The Feishu App ID (REQUIRED)
      chatId: The Feishu Chat ID (REQUIRED)
      staticMapping: JSON string of static name to ID mappings (REQUIRED)
---

# Feishu Mention Resolver - 飞书@提及解析器

将飞书消息中的 `@name` 自动转换为 `@name openid` 格式，实现更精确的提及提醒。

## 快速开始

### 基本用法

在你的飞书机器人代码中使用：

```javascript
// JavaScript/Node.js
const { FeishuMentionResolver } = require('./feishu-mention');

const resolver = new FeishuMentionResolver();

async function processMessage(text) {
  const app_id = 'cliab1234567890abcdef';
  const chat_id = 'oc_1234567890abcdef';
  
  // 解析文本中的所有@提及
  const resolvedText = await resolver.resolveTextMentions(text, app_id, chat_id);
  
  return resolvedText;
}
```

```python
# Python
from feishu_mention import FeishuMentionResolver

resolver = FeishuMentionResolver();

async def process_message(text):
    app_id = 'cliab1234567890abcdef'
    chat_id = 'oc_1234567890abcdef'
    
    # 解析文本
    resolved_text = await resolver.resolve_text_mentions(text, app_id, chat_id)
    
    return resolved_text
```

### 🤖 支持静态映射（如机器人）

如果消息中要 @的是另一个机器人（而非普通用户），或者需要固定映射某些名字，可以在初始化时配置映射表：

```javascript
const resolver = new FeishuMentionResolver(undefined, {
  staticMappings: {
    '@技术助手': 'rs_xxxxxxxxxxxxxx',   // 机器人的 open_id 以 rs_开头
    '@数据查询': 'rs_yyyyyyyyyyyyyy',
    '@日程提醒': 'rs_zzzzzzzzzzzzzz'
  },
  aliases: [
    { name: '张三', alias: ['小王', '张经理'] },  // 别名支持
    { name: '李四', alias: ['李总', 'lisi'] }
  ]
});

// 自动识别
resolve('你好 @技术助手', appId, chatId);
// → "你好 <at user_id="rs_xxx">技术助手</at>" ✅
```

**优先级顺序：**
1. `@静态映射` → 匹配 staticMappings（优先）
2. `@别名` → 转换为真实姓名后查找
3. `@真人` → 匹配企业通讯录缓存/API
4. 都不匹配 → 原样输出

## 核心特性

### 1. 多 Bot 支持
通过 `app_id` 区分不同的飞书应用：
- 每个 Bot 有独立的成员缓存
- 不同 Bot 可以有不同的权限范围

### 2. 多群支持
通过 `chat_id` 区分不同的会话：
- 群聊、私聊分别缓存
- 避免跨会话的成员混淆

### 3. 智能缓存
- **缓存有效期**: 2 小时（可配置）
- **自动过期**: 过期的缓存会被自动清除
- **位置**: `~/.openclaw/workspace/cache/feishu_mentions/`

### 4. 降级策略
```
① 优先使用本地缓存（最快）
   ↓ 未命中或已过期
② 调用飞书 API 获取最新成员
   ↓ API 调用失败或成员不存在
③ 返回原始 @name（保持兼容）
```

## API 参考

### `FeishuMentionResolver([cache_dir], [options])`

构造函数，初始化解析器。

**参数:**
- `cache_dir`: 可选，缓存目录路径
  - 默认：`~/.openclaw/workspace/cache/feishu_mentions`
- `options`: 可选，配置选项对象
  - `staticMappings`: 静态映射表 `{"@机器人名": "rs_xxx", "固定名": "ou_xxx"}` (原 `botMappings`)
  - `aliases`: 用户别名规则 `[{"name": "真实名", "alias": ["别名 1", "别名 2"]}]`

**示例:**
```javascript
// 支持静态映射和别名
const resolver = new FeishuMentionResolver(undefined, {
  staticMappings: {
    '@技术助手': 'rs_tech_001',
    '@数据查询': 'rs_data_001'
  },
  aliases: [
    { name: '张三', alias: ['小王', '老张'] }
  ]
});
```

---

### `resolve_text_mentions(text, app_id, chat_id)`

批量解析文本中的所有 `@提及`。

**参数:**
- `text` (string): 输入文本，如 `"你好 @张三，请问 @李四 在吗？"`
- `app_id` (string): 飞书应用的 App ID
- `chat_id` (string): 会话 ID（群聊或私聊的 chat_id）

**返回值:**
- `string`: 解析后的文本，如 `"你好 <at user_id="ou_xxx">张三</at>, 请问 <at user_id="ou_yyy">李四</at> 在吗？"`

**示例:**
```python
text = "你好 @张三，请查看文档"
result = resolver.resolve_text_mentions(text, app_id, chat_id)
# 输出："你好 <at user_id="ou_xxx123">张三</at>, 请查看文档"
```

---

### `resolve_mention(mention, app_id, chat_id)`

解析单个 `@提及`。

**参数:**
- `mention` (string): 待解析的提及，如 `"@张三"` 或 `"@张三:ou_xxx"`
- `app_id` (string): 飞书应用的 App ID
- `chat_id` (string): 会话 ID

**返回值:**
- `string`: 解析后的提及，如 `<at user_id="ou_xxx">张三</at>`

**注意:**
- 如果传入的提及已经是 `<at>` 标签格式，会直接返回
- 如果 `@name` 无法解析，返回原始值

---

### `get_cached_members(app_id, chat_id)`

从本地缓存获取成员列表。

**参数:**
- `app_id` (string): 飞书应用的 App ID
- `chat_id` (string): 会话 ID

**返回值:**
- `list[dict] | None`: 成员列表 `[{name, open_id}, ...]` 或 None（无缓存）

---

### `fetch_members_from_api(app_id, chat_id)`

通过飞书 API 实时获取成员列表。

**需要权限:**
- 企业通讯录读取权限
- Access Token（根据 app_id 自动获取）

**返回值:**
- `list[dict]`: 成员列表

---

### `invalidate_cache(app_id, chat_id)`

使指定 bot+ 群的缓存失效。

**使用场景:**
- 团队人员发生变动后手动刷新
- 测试新的成员数据

---

### `clear_all_cache()`

清除所有缓存数据。

**使用场景:**
- 重置所有缓存
- 磁盘空间不足时清理

---

## 🤖 支持的提及类型

### 1. 真人用户 (自动解析)

通过飞书企业通讯录 API 获取：
```javascript
// 原文："你好 @张三"
await resolve('你好 @张三', appId, chatId);
// → "<at user_id="ou_xxx">张三</at>"
```

### 2. 特殊格式 (Raw ID)

支持直接使用 OpenID 的特殊格式：
```javascript
// 原文："请 @[user:ou_123456] 确认"
await resolve('请 @[user:ou_123456] 确认', appId, chatId);
// → "请 <at user_id="ou_123456">张三</at> 确认" (自动反查名字)
```

### 3. 静态映射（如机器人、固定ID）

可以通过 `staticMappings` 配置固定的映射关系：
```javascript
const resolver = new FeishuMentionResolver(undefined, {
  staticMappings: {
    '@技术助手': 'rs_tech_assistant',
    '@固定用户': 'ou_fixed_user_id'
  }
});

// 原文："请 @技术助手 帮我查一下"
await resolve('请 @技术助手 帮我查一下', appId, chatId);
// → "请 <at user_id="rs_tech_assistant">技术助手</at> 帮我查一下"
```

### 3. 别名引用 (需配置)
```javascript
{
  aliases: [
    { name: '张三', alias: ['小王', '张经理', 'zhangsan'] }
  ]
}

// 原文："@小王 过来一下"
await resolve('@小王 过来一下', appId, chatId);
// → "<at user_id="ou_xxx">张三</at> 过来一下" (如果张三在成员列表中)
```

---

## 💡 配置文件示例

建议将常用配置保存在文件中：

```json
{
  "staticMappings": {
    "@技术助手": "rs_tech_bot_001",
    "@数据分析": "rs_data_bot_001"
  },
  "aliases": [
    {
      "name": "张三",
      "alias": ["小王", "张经理", "zhangsan"]
    }
  ],
  "saved_at": "2026-03-05T14:00:00.000Z"
}
```

### 3. 别名引用 (需配置)
```javascript
{
  aliases: [
    { name: '张三', alias: ['小王', '老张'] }
  ]
}

// 原文："@小王 过来一下"
await resolve('@小王 过来一下', appId, chatId);
// → "<at user_id="ou_xxx">张三</at> 过来一下" (如果张三在成员列表中)
```

---

## 💡 配置文件示例

建议将常用配置保存在文件中：

```json
{
  "botMappings": {
    "@技术助手": "rs_tech_bot_001",
    "@数据分析": "rs_data_bot_001",
    "@日程提醒": "rs_calendar_bot_001",
    "@审批流程": "rs_approval_bot_001"
  },
  "aliases": [
    {
      "name": "张三",
      "alias": ["小王", "张经理", "zhangsan"]
    },
    {
      "name": "李四",
      "alias": ["李总", "lisi", "LS"]
    }
  ],
  "saved_at": "2026-03-05T14:00:00.000Z"
}
```

保存后启动时自动加载：
```javascript
await loadBotConfig(); // 从默认路径加载
// 或指定路径：
await loadBotConfig('/path/to/custom/config.json');
```

## 集成到你的项目

### 方案一：直接使用 Python 脚本

在项目目录下运行测试脚本：

```bash
cd /home/liuhelong/.npm-global/lib/node_modules/openclaw/skills/feishu-mention/scripts

# 修改 mention_resolver.py 中的示例数据
python3 mention_resolver.py
```

### 方案二：封装成工具类

创建一个包装类供你的飞书机器人使用：

```python
class FeishuBotProcessor:
    def __init__(self):
        self.resolver = FeishuMentionResolver()
        self.bot_configs = {}  # app_id -> config
    
    async def process_message(self, message):
        """处理收到的消息"""
        app_id = message['app_id']
        chat_id = message['chat_id']
        content = message['content']
        
        # 解析@提及
        resolved_content = self.resolver.resolve_text_mentions(
            content, app_id, chat_id
        )
        
        # 发送回复
        await self.send_reply(resolved_content)
```

### 方案三：ACP 环境集成

如果在 ACP 环境中，可以使用异步 HTTP 调用：

```javascript
async resolveTextMentions(text, appId, chatId) {
  // ACP 环境下可以直接调用飞书 API
  const cachedMembers = this.resolver.getCachedMembers(appId, chatId);
  
  if (!cachedMembers) {
    // 缓存未命中，获取最新数据
    const members = await fetchMembersFromApi(appId, chatId);
    this.resolver.saveCache(appId, chatId, members);
  }
  
  // 执行解析...
}
```

## 缓存机制详解

### 缓存结构
```json
{
  "updated_at": 1709625600000,
  "members_data": [
    {
      "name": "张三",
      "open_id": "ou_xxxxxxxxxxxxxx"
    },
    {
      "name": "李四",
      "open_id": "ou_yyyyyyyyyyyyyy"
    }
  ]
}
```

### 缓存文件名生成
基于 `app_id + chat_id` 的 MD5 哈希：
```
md5("cliab1234567890abcdef_oc_1234567890abcdef")[:16] + ".json"
# → a1b2c3d4e5f6g7h8.json
```

这样可以：
- 避免文件名过长
- 相同 bot+ 群总是映射到同一文件
- 自动处理特殊字符

## 常见问题

### Q: 如何获取 Access Token？

A: 需要根据 app_id 和 app_secret 通过飞书 OAuth 2.0 获取。建议使用已有的 token 管理工具，或者参考飞书官方文档。

### Q: 为什么有些 @name 没有被替换？

A: 可能的原因：
1. 该用户不在缓存的成员列表中
2. 用户名与飞书显示的名称不完全匹配
3. API 调用失败，降级为原样输出
4. **这是机器人或固定映射** → 需要使用 staticMappings 配置映射

### Q: 支持 @其他机器人吗？

A: **支持！** 有两种方式：
1. **推荐**：在初始化时通过 `staticMappings` 配置映射表
   ```javascript
   new FeishuMentionResolver(undefined, {
     staticMappings: { '@技术助手': 'rs_xxx' }
   });
   ```
2. **动态添加**：使用 `addStaticMapping('@机器人名', 'rs_xxx')`

### Q: 支持别名吗？

A: 支持！可以配置用户别名：
```javascript
{
  aliases: [
    { name: '张三', alias: ['小王', '张经理', 'zhangsan'] }
  ]
}
```

### Q: 配置文件存在哪里？

A: 默认保存在 `~/.openclaw/workspace/cache/feishu_mentions/bots_cache.json`，可以通过 `loadBotConfig()`自动加载。

## 安全注意事项

1. **不要硬编码敏感信息**: app_id、app_secret、access_token 应从环境变量或安全配置中读取
2. **最小权限原则**: 请求的 API 权限应限制在必要范围内
3. **缓存加密**: 生产环境建议对缓存文件进行加密
4. **定期清理**: 定期检查并清理过期的缓存文件

## 相关资源

- [飞书开放平台文档](https://open.feishu.cn/document)
- [用户管理 API](https://open.feishu.cn/document/server-docs/user-management/get-user-detail)
- [企业通讯录 API](https://open.feishu.cn/document/server-docs/humans-resources-v4/user/list_department_users)

---

**版本**: 1.4.0 (支持静态映射参数 staticMapping)  
**作者**: OpenClaw AI Assistant  
**最后更新**: 2026-03-05
