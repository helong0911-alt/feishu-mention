# FeishuMention Resolver - 集成指南

## 🎯 核心功能

将飞书消息中的 `@name` 转换为 `@name openid` 格式，实现更精准的 @提及提醒。

### 处理流程

```
用户输入："你好 @张三，请问 @李四 在吗？"
    ↓
① 查找本地缓存 (2 小时内)
   └─ 找到 → 解析为 "你好 <at user_id="ou_xxx">张三</at>, 请问 <at user_id="ou_yyy">李四</at> 在吗？"
   └─ 未找到 → 继续下一步
   
② 调用飞书 API 获取最新成员列表
   ├─ 成功 → 缓存并解析
   └─ 失败 → 返回原样 "@张三", "@李四"
   
③ 成员不存在 → 返回原样 "@name"
```

## 🔑 关键特性

### 1. 多 Bot 支持
每个 Bot 通过唯一的 `app_id` 区分：
```javascript
// Bot 1: 技术群机器人
const techBot = new FeishuMentionResolver();
await techBot.resolveTextMentions(text, 'cliab_tech_app_id', chatId);

// Bot 2: 产品群机器人  
const prodBot = new FeishuMentionResolver();
await prodBot.resolveTextMentions(text, 'cliab_product_app_id', chatId);
```

### 2. 多群独立缓存
每个群聊有独立的缓存文件：
```
cliabxxx_oc_tech_group      → 缓存 A.json
cliabxxx_oc_prod_group      → 缓存 B.json
cliabyyy_oc_tech_group      → 缓存 C.json
```

### 3. 智能降级策略
- **最佳情况**: 缓存命中（毫秒级响应）
- **中等情况**: API 调用成功（秒级响应 + 更新缓存）
- **兜底情况**: API 失败或成员不存在（保持原样输出）

## 🛠️ 集成到你的项目

### 场景一：飞书机器人消息处理

```javascript
import { FeishuMentionResolver } from './index.js';

class MyFeishuBot {
  constructor() {
    this.resolver = new FeishuMentionResolver();
    this.appId = process.env.FEISHU_APP_ID;
  }
  
  async handleMessage(event) {
    const { chat_id, content, msg_type } = event;
    
    // 提取文本内容
    let text = this.extractText(content, msg_type);
    
    // 解析@提及
    const resolvedText = await this.resolver.resolveTextMentions(
      text, 
      this.appId, 
      chat_id
    );
    
    // 使用解析后的内容进行后续处理
    await this.processMessage(resolvedText, event);
  }
}
```

### 场景二：定时刷新缓存

```javascript
// 每小时自动刷新缓存
setInterval(async () => {
  const apps = [
    { id: 'cliab_app1' },
    { id: 'cliab_app2' }
  ];
  
  const chats = [
    'oc_group_tech',
    'oc_group_product'
  ];
  
  for (const app of apps) {
    for (const chat of chats) {
      resolver.invalidateCache(app.id, chat);
      
      // 获取最新数据
      const members = await resolver.fetchMembersFromApi(app.id, chat);
      resolver.saveCache(app.id, chat, members);
    }
  }
}, 3600000); // 1 hour
```

### 场景三：API 调用封装

需要在 ACP 环境中实现的完整 API 调用：

```javascript
async fetchMembersFromApi(appId, chatId) {
  // 1. 获取 access_token
  const accessToken = await this.getAccessToken(appId);
  
  // 2. 调用飞书企业通讯录 API
  const response = await fetch(
    'https://open.feishu.cn/open-apis/user/v4/list_department_users',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const result = await response.json();
  
  if (result.code !== 0) {
    throw new Error(`飞书 API 错误：${result.msg}`);
  }
  
  // 3. 转换数据格式
  return result.data.user_list.map(user => ({
    name: user.name,
    open_id: user.open_id
  }));
}
```

### 场景四：Token 管理

```javascript
// 建议封装成独立的 token 管理服务
class TokenManager {
  async getAccessToken(appId) {
    const appSecret = process.env[`FEISHU_${appId.toUpperCase()}_SECRET`];
    
    // 调用飞书 OAuth 2.0
    const response = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret
        })
      }
    );
    
    const result = await response.json();
    return result.tenant_access_token;
  }
}
```

## 📝 环境变量配置

```bash
# 开发环境
export FEISHU_APP_ID=cliab1234567890abcdef
export FEISHU_APP_SECRET=your_app_secret_here

# 生产环境（每个 bot 单独设置）
export FEISHU_CLIAB_TECH_SECRET=tech_bot_secret
export FEISHU_CLIAB_PROD_SECRET=product_bot_secret
```

## 🧪 测试代码

完整的集成测试示例在 `assets/example_usage.js` 中查看。

## ⚠️ 注意事项

1. **权限要求**: 确保应用已获得「企业通讯录读取」权限
2. **频率限制**: 飞书 API 有调用频率限制，建议使用缓存
3. **数据安全**: 不要将敏感信息硬编码在代码中
4. **错误处理**: API 调用失败时应有兜底策略

## 📖 相关文档

- [飞书开放平台](https://open.feishu.cn/document)
- [用户管理 API](https://open.feishu.cn/document/server-docs/user-management/get-user-detail)
- [企业通讯录 API](https://open.feishu.cn/document/server-docs/humans-resources-v4/user/list_department_users)

---

**版本**: 1.1.1
**更新时间**: 2026-03-05
