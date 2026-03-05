# FeishuMention Resolver - 快速参考

## 🚀 30 秒上手

### 1. 基础使用（真人用户）

```javascript
import { resolve } from './index.js';

const result = await resolve('你好 @张三', appId, chatId);
// → "你好 <at user_id="ou_xxx">张三</at>" (如果有缓存或 API)
```

### 2. 支持机器人 (@其他机器人)

**推荐方式：使用环境变量**
在 `.env` 或 `openclaw.json` 中配置：
```json
FEISHU_BOT_MAPPING='{"@技术助手":"rs_tech_001", "@数据":"rs_data_001"}'
```

**代码方式：**
```javascript
import { addBotMapping, saveBotConfig } from './index.js';

// 添加机器人映射
addBotMapping('@技术助手', 'rs_tech_001');
addBotMapping('@数据查询', 'rs_data_001');

// 保存到本地（下次自动加载）
await saveBotConfig();

// 使用
const result = await resolve('请 @技术助手 帮忙', appId, chatId);
// → "请 <at user_id="rs_tech_001">技术助手</at> 帮忙" ✅
```

### 3. 支持别名（多种称呼）

```javascript
import { addUserAlias } from './index.js';

// 添加别名规则
addUserAlias('张三', ['小王', '张经理', 'zhangsan']);

// 使用（都可以解析为真实姓名）
await resolve('@小王 在吗？', appId, chatId);
await resolve('@张经理 看一下', appId, chatId);
```

### 4. 初始化时一次性配置

```javascript
import { FeishuMentionResolver } from './index.js';

const resolver = new FeishuMentionResolver(undefined, {
  botMappings: {
    '@技术助手': 'rs_tech_001',
    '@审批流程': 'rs_approval_001'
  },
  aliases: [
    { name: '张三', alias: ['小王', '老张'] },
    { name: '李四', alias: ['李总', 'lisi'] }
  ]
});

const result = await resolver.resolveTextMentions(
  '你好 @技术助手，@小王 说...',
  appId, 
  chatId
);
// → "你好 <at user_id="rs_tech_001">技术助手</at>, <at user_id="ou_yyy">张三</at> 说..."
```

---

## 📋 完整功能列表

| 功能 | 是否需要配置 | 说明 |
|------|------------|------|
| 真人用户 | ✅ 自动 | 通过飞书 API 获取成员列表 |
| 机器人 | ⚙️ 手动 | 需配置 `botMappings` |
| 别名引用 | ⚙️ 手动 | 需配置 `aliases` |
| 多 Bot 支持 | ✅ 自动 | 每个 app_id 独立缓存 |
| 多群支持 | ✅ 自动 | 每个 chat_id 独立缓存 |
| API 降级 | ✅ 自动 | 失败时原样输出 |
| 本地缓存 | ✅ 自动 | 2 小时 TTL |

---

## 💾 配置文件位置

- **默认路径**: `~/.openclaw/workspace/cache/feishu_mentions/bots_cache.json`
- **自定义路径**: `loadBotConfig('/path/to/config.json')`

---

## 🔍 提及解析优先级

```
1. 机器人映射 (botMappings)      ← 最高优先级
   ↓ 未匹配
2. 用户别名 (aliases)             → 转换为真实姓名后查
   ↓ 未匹配
3. 企业通讯录 (缓存 + API)        → 真人用户
   ↓ 都未匹配
4. 原样输出                       ← 兜底策略
```

---

## 🎯 使用场景示例

### 场景 A: 消息中同时有真人和机器人

```javascript
const text = '@技术助手 帮 @产品经理 查下数据';

// 配置
new FeishuMentionResolver(undefined, {
  botMappings: { '@技术助手': 'rs_tech_001' },
  aliases: [{ name: '产品经理', alias: ['PM', '产品'] }]
});

// 结果
"<at user_id="rs_tech_001">技术助手</at> 帮 <at user_id="ou_prod_001">产品经理</at> 查下数据"
```

### 场景 B: 群聊中有多个机器人

```javascript
new FeishuMentionResolver(undefined, {
  botMappings: {
    '@日程管理': 'rs_calendar_bot',
    '@数据看板': 'rs_dashboard_bot',
    '@审批助手': 'rs_approval_bot',
    '@新闻推送': 'rs_news_bot'
  }
});
```

### 场景 C: 新人入职（先配置别名）

```javascript
// 新来的同事叫"王小明"，但喜欢被叫"WangX"、"小王"
addUserAlias('王小明', ['WangX', '小王', 'xm_wang']);

// 之后都可以用这些称呼
await resolve('@WangX 明天会议别迟到', appId, chatId);
```

---

## ⚠️ 注意事项

1. **机器人在飞书通讯录中不存在**，所以必须手动配置映射
2. **机器人的 openid 格式**通常是 `rs_开头`（普通用户是`ou_`开头）
3. **配置保存后永久有效**，除非调用 `clearCache()` 清除

---

## 📖 更多示例

查看以下文件了解更多用法：
- `assets/example_usage.js` - 综合示例
- `assets/robot_examples.js` - 机器人支持演示
- `test.js` - 单元测试

---

**版本**: 1.2.1 (支持环境变量配置机器人)  
**更新时间**: 2026-03-05
