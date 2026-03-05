# 飞书@提及格式说明（已修正）

## 📋 官方文档

根据飞书官方文档：https://open.feishu.cn/document/server-docs/im-v1/message-content-description/create_json

### ✅ 正确的@提及格式是 **XML 标签**

```xml
<!-- @单个用户 -->
<at user_id="ou_xxxxxxx" type="person">用户名</at>

<!-- @机器人 -->
<at user_id="rs_xxxxxx" type="robot">机器人名</at>

<!-- @所有人 -->
<at user_id="all" type="all"></at>
```

---

## 📥 支持的输入格式 (会自动解析)

1. **标准提及**: `@张三`
   - 解析器会自动查找名为 "张三" 的用户 OpenID，并转换为 `<at>` 标签。
   
2. **特殊格式 (Raw ID)**: `@[user:ou_12345678]`
   - 直接通过 OpenID 提及用户。
   - 解析器会自动尝试反查用户名（缓存/API），并转换为 `<at>` 标签。
   - 如果查不到用户名，默认显示为 "用户"。

3. **旧版显式 ID**: `@张三 (ou_12345678)`
   - 兼容旧的显式 ID 写法。

---

## ❌ 错误的方式

### 不要使用字符串拼接的 `@name openid` 格式

```javascript
// ❌ 错误 - 这样不会触发@提醒
const message = '@张三 ou_123456 在吗';
await sendMessage({ msg_type: 'text', content: JSON.stringify({ text: message }) });
```

### ⚠️ 即使使用 Post 类型也不正确

```javascript
// ❌ 部分错误 - 虽然能显示文本但不会触发@提醒
await sendMessage({
  msg_type: 'post',
  content: JSON.stringify({
    paragraphs: [
      { text: { content: '@张三 ou_123456 在吗' } }
    ]
  })
});
```

---

## ✅ 正确的方式

### 方式一：使用解析器自动转换（推荐）

```javascript
import { FeishuMentionResolver } from './index.js';

const resolver = new FeishuMentionResolver(undefined, {
  botMappings: {
    '@技术助手': 'rs_tech_001'
  },
  aliases: [
    { name: '张三', alias: ['小王'] }
  ]
});

// 1. 解析文本
const text = '请 @技术助手 帮忙 @小王 看一下';
const resolvedText = await resolver.resolveTextMentions(text, appId, chatId);

// resolvedText 结果：<at user_id="tech_001" type="robot">技术助手</at> <at user_id="zhangsan" type="person">张三</at> 看一下
console.log('解析后:', resolvedText);

// 2. 发送到飞书
await sendMessage({
  msg_type: 'post',
  content: JSON.stringify({
    title: '消息标题',
    paragraphs: [
      { text: { content: resolvedText } }
    ]
  })
});
```

### 方式二：手动构建<at>标签

```javascript
// 如果你有已知的 openid
const atZhangSan = `<at user_id="ou_zhangsan123" type="person">张三</at>`;
const atTechBot = `<at user_id="rs_tech_bot" type="robot">技术助手</at>`;

const message = `${atZhangSan}${atTechBot}请查看数据`;

await sendMessage({
  msg_type: 'post',
  content: JSON.stringify({
    title: '消息标题',
    paragraphs: [
      { text: { content: message } }
    ]
  })
});
```

---

## 📬 完整的 Post 消息结构

```json
{
  "msg_type": "post",
  "content": {
    "title": "消息标题",
    "cards": [], // 可选：卡片组件
    "paragraphs": [
      {
        "text": {
          "content": "<at user_id=\"ou_zhangsan\" type=\"person\">张三</at>你好呀！"
        }
      }
    ],
    "image": "", // 图片 URL（可选）
    "video": "" // 视频 URL（可选）
  }
}
```

### 参数说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg_type` | string | ✅ | 必须是 `"post"` (富文本) |
| `content.title` | string | ✅ | 消息标题，用于预览 |
| `content.paragraphs` | array | ✅ | 段落数组，每个段落包含 text 对象 |
| `content.paragraphs[].text.content` | string | ✅ | 文本内容，可嵌入 `<at>` 标签 |

---

## 🔑 关键要点总结

### 1. 必须使用 `<at>` 标签格式

```javascript
// ✅ 正确
'<at user_id="ou_xxx" type="person">张三</at>'

// ❌ 错误
'@张三 ou_xxx'
```

### 2. 必须使用 `msg_type: "post"`

```javascript
// ✅ 正确 - Post 类型支持<at>标签
{ msg_type: 'post', content: ... }

// ❌ 错误 - Text 类型只支持纯文本
{ msg_type: 'text', content: ... }
```

### 3. OpenID 前缀识别

| 前缀 | 类型 | 说明 |
|------|------|------|
| `ou_` | person | 真人用户 |
| `rs_` | robot | 机器人 |
| `all` | all | @所有人 |

### 4. user_id 需要去掉前缀

```javascript
// 如果 openid 是 "ou_zhangsan123"
const userId = openId.substring(3); // "zhangsan123"
const tag = `<at user_id="${userId}" type="person">张三</at>`;
```

---

## 💡 完整集成代码

```javascript
import { FeishuMentionResolver, addBotMapping, resolve } from './index.js';

class MyFeishuBot {
  constructor() {
    // 配置
    addBotMapping('@技术助手', 'rs_tech_assistant_001');
    
    this.resolver = new FeishuMentionResolver(undefined, {
      botMappings: {
        '@技术助手': 'rs_tech_assistant_001',
        '@审批流程': 'rs_approval_bot_001'
      }
    });
    
    this.appId = process.env.FEISHU_APP_ID;
    this.appSecret = process.env.FEISHU_APP_SECRET;
  }
  
  /**
   * 处理收到的消息
   */
  async handleMessage(event) {
    const { chat_id, content } = event;
    const userText = JSON.parse(content).text;
    
    // 1. 解析@提及
    const resolvedText = await this.resolver.resolveTextMentions(
      userText, 
      this.appId, 
      chat_id
    );
    
    console.log('✅ 解析结果:', resolvedText);
    // 输出："<at user_id="tech_assistant_001" type="robot">技术助手</at> 你在吗？"
    
    // 2. 构建回复消息
    const replyContent = {
      title: '回复',
      paragraphs: [
        { text: { content: resolvedText } }
      ]
    };
    
    // 3. 发送到飞书
    await this.sendPostMessage(chat_id, replyContent);
  }
  
  /**
   * 发送 Post 消息到飞书
   */
  async sendPostMessage(chatId, content) {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: 'post',
          content: JSON.stringify(content)
        })
      }
    );
    
    const result = await response.json();
    if (result.code === 0) {
      console.log('✅ 消息发送成功');
    } else {
      console.error('❌ 发送失败:', result.msg);
    }
  }
  
  async getAccessToken() {
    // TODO: 实现实际的 token 获取逻辑
    return 'your_access_token';
  }
}

// 使用
const bot = new MyFeishuBot();
bot.handleMessage(event);
```

---

## 📖 相关资源

- [飞书官方文档](https://open.feishu.cn/document/uYjL4xnC2UjkNwDN4QDN/group-message-api/send-messages-to-groups-via-webhook)
- [富文本消息格式](https://open.feishu.cn/document/ukTMukTM0QjL4iNMyQDN/send-group-messages-via-webhook)
- [@提及功能](https://open.feishu.cn/document/ukTMukTM0QjL4iNM2YDN/im-v1/message/create-card-message)

---

**更新日期**: 2026-03-05  
**状态**: ✅ 已修复 - 支持自动解析特殊格式和XML标签
