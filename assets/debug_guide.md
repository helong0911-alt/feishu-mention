# @隐式提醒调试指南

## 🔍 问题诊断步骤

### Step 1: 确认解析是否正确

```javascript
import { resolve, addBotMapping } from './index.js';

const text = '@技术助手 帮我一下';
const appId = 'cliabxxx';
const chatId = 'oc_yyy';

// 添加机器人映射
addBotMapping('@技术助手', 'rs_bot_id');

const result = await resolve(text, appId, chatId);

console.log('原文本:', text);
console.log('解析结果:', result);
console.log('是否包含 openid?:', result.includes('rs_') || result.includes('ou_'));
```

**预期输出：**
```
原文本：@技术助手 帮我一下
解析结果：@技术助手 rs_bot_id 帮我一下
是否包含 openid?: true
```

**如果结果还是 `@技术助手 帮我一下`（没有替换）：**
- ❌ 配置有误 - 检查 `botMappings` 是否正确
- ❌ 函数调用错误 - 确保使用了异步函数

---

### Step 2: 确认消息发送格式

⚠️ **飞书@提及需要特殊格式！**

#### ❌ 错误方式（纯文本）
```javascript
// 这样不会触发@提醒
await sendMessage('@张三 ou_xxx 在吗');
```

#### ✅ 正确方式（富文本格式）

```javascript
// 使用 mention_block 才能触发@提醒
await sendMessage({
  msg_type: 'post',
  content: JSON.stringify({
    title: '回复',
    paragraphs: [
      { tag: 'mention', user_id: 'ou_xxx', type: 'person' },
      { text: { content: '在吗' } }
    ]
  })
});
```

---

## 🐛 常见错误及解决方案

### 错误 1: 解析后没有 openid

**可能原因:**
1. `botMappings` 配置为空或 key 不匹配
2. 传入的文本不是 `@开头` 的格式

**调试:**
```javascript
console.log('要匹配的 name:', mention.match(/^@(.*?)$/)[1]);
console.log('botMappings:', resolver.botMappings);
console.log('是否找到？', !!resolver.botMappings[matchedName]);
```

### 错误 2: 发送了但没看到@效果

**原因:** 飞书的消息类型不支持纯文本@

**解决方案:** 使用富文本格式

参考飞书官方文档：
https://open.feishu.cn/document/uYjL4xnC2UjkNwDN4QDN

要点：
- 群聊@使用 `mention_block`
- message_id 参数指定被@的人

---

## ✅ 验证清单

在确认功能正常前，请依次检查：

- [ ] 1. `node_modules` 中有 `feishu-mention` 文件夹
- [ ] 2. `index.js` 可以正常导入（无语法错误）
- [ ] 3. `FeishuMentionResolver` 构造函数可用
- [ ] 4. `resolve()` 函数返回 Promise
- [ ] 5. `botMappings` 中配置了对应的机器人 ID
- [ ] 6. 解析后的文本包含 `ou_` 或 `rs_` 前缀
- [ ] 7. 发送消息时使用了正确的富文本格式
- [ ] 8. 飞书机器人有权限向该群组发送消息

---

## 💡 快速测试代码

复制这个完整测试脚本：

```javascript
// test_mention.js
import { FeishuMentionResolver, addBotMapping } from './index.js';

async function test() {
  console.log('=== 测试开始 ===\n');
  
  // 1. 初始化
  const resolver = new FeishuMentionResolver(undefined, {
    botMappings: {
      '@测试机器人': 'rs_test_001'
    }
  });
  
  console.log('✅ 初始化完成');
  
  // 2. 解析
  const text = '@测试机器人 你好';
  const resolved = await resolver.resolveTextMentions(text, 'appId123', 'oc_chat456');
  
  console.log('输入:', text);
  console.log('输出:', resolved);
  console.log('解析成功？', resolved.includes('rs_test_001'));
  
  // 3. 查看配置
  console.log('\n当前配置的机器人:');
  console.log(Object.keys(resolver.botMappings));
}

test().catch(console.error);
```

运行：
```bash
node test_mention.js
```

---

## 📞 仍不能解决？

请提供以下信息：

1. 你的完整代码片段
2. 控制台输出的日志
3. 飞书 API 返回的错误信息（如果有）
4. 你期望的行为 vs 实际行为

示例：
```javascript
// 你的代码
import { ... } from './index.js';
const result = await resolve(...);
console.log(result);
```

输出：
```
原文：...
解析结果：... (应该显示 openid)
```

实际看到的：
```
... (把你实际看到的贴上来)
```
