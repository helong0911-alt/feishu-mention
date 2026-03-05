/**
 * 飞书消息发送完整示例 - 使用正确的 @提及格式
 * 
 * 根据官方文档：https://open.feishu.cn/document/server-docs/im-v1/message-content-description/create_json
 */

import { FeishuMentionResolver, addBotMapping } from '../index.js';

class FeishuMessageSender {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    
    // 配置机器人映射
    addBotMapping('@技术助手', 'rs_tech_assistant_001');
    addBotMapping('@数据查询', 'rs_data_analyst_001');
    
    this.resolver = new FeishuMentionResolver(undefined, {
      botMappings: {
        '@技术助手': 'rs_tech_assistant_001',
        '@审批流程': 'rs_approval_bot_001'
      },
      aliases: [
        { name: '张三', alias: ['小王', '老张'] },
        { name: '李四', alias: ['李总', 'lisi'] }
      ]
    });
  }
  
  /**
   * 发送富文本消息（推荐方式）
   * @param {string} chatId - 群聊 ID (oc_xxx 格式)
   * @param {Object} messageContent - 消息内容对象
   */
  async sendPostMessage(chatId, messageContent) {
    console.log(`📤 发送 Post 消息到 ${chatId}`);
    console.log('消息内容:', JSON.stringify(messageContent, null, 2));
    
    // TODO: 实际发送 API 调用
    /*
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
          content: messageContent
        })
      }
    );
    const result = await response.json();
    console.log('API 响应:', result);
    */
  }
  
  /**
   * 构建包含@提及的富文本消息
   * @param {string} text - 原始文本，可能包含 @name
   * @returns {Object} 飞书可识别的消息对象
   */
  buildRichTextMessage(text) {
    console.log('📝 原文本:', text);
    
    // 解析@提及，转换为<at>标签格式
    const resolvedText = await this.resolver.resolveTextMentions(text, this.appId, 'oc_test_group');
    
    console.log('✨ 解析后:', resolvedText);
    
    // 飞书 Post 消息格式要求 paragraphs 数组
    return {
      title: '系统通知',
      paragraphs: [
        {
          text: {
            content: resolvedText
          }
        }
      ]
    };
  }
  
  /**
   * 更高级的方式：直接使用<at>标签构建段落
   * 这样可以让@提及成为富文本的一部分
   */
  buildAdvancedRichTextMessage(mentionsInfo) {
    /**
     * mentionsInfo 是一个数组，每个元素包含：
     * { type: 'mention' | 'text', user_id?: string, text?: string }
     * 
     * 例如：
     * [
     *   { type: 'text', text: '你好' },
     *   { type: 'mention', user_id: 'ou_zhangsan', name: '张三' },
     *   { type: 'text', text: '在吗？' }
     * ]
     */
    
    const paragraphs = [];
    
    for (const item of mentionsInfo) {
      if (item.type === 'mention') {
        // 构建<at>标签
        const atTag = `<at user_id="${item.user_id}" type="person">${item.name || ''}</at>`;
        paragraphs.push({ text: { content: atTag } });
      } else if (item.type === 'text') {
        paragraphs.push({ text: { content: item.text } });
      }
    }
    
    return {
      title: '消息标题',
      paragraphs: paragraphs
    };
  }
  
  async getAccessToken() {
    // TODO: 实现 token 获取
    return 'mock_token';
  }
}

// ========== 使用示例 ==========

async function examples() {
  console.log('\n========================================');
  console.log('📬 飞书消息发送示例');
  console.log('========================================\n');
  
  const sender = new FeishuMessageSender('cliab_test_app', 'secret_key');
  
  // 示例 1: 简单文本+自动解析@
  console.log('【示例 1】普通文本，自动解析@提及\n');
  const simpleMessage = '请 @技术助手 帮忙处理一下问题';
  const content1 = sender.buildRichTextMessage(simpleMessage);
  console.log('最终消息内容:');
  console.log(JSON.stringify(content1, null, 2));
  console.log();
  
  // 示例 2: 多个@提及
  console.log('【示例 2】多个@提及\n');
  const multiMention = '请 @技术助手 @数据查询 @张三 一起开会';
  const content2 = sender.buildRichTextMessage(multiMention);
  console.log('最终消息内容:');
  console.log(JSON.stringify(content2, null, 2));
  console.log();
  
  // 示例 3: 别名支持
  console.log('【示例 3】别名解析 (@小王 -> @张三)\n');
  const aliasMessage = '@小王 请查看最新数据';
  const content3 = sender.buildRichTextMessage(aliasMessage);
  console.log('最终消息内容:');
  console.log(JSON.stringify(content3, null, 2));
  console.log();
}

examples().catch(console.error);
