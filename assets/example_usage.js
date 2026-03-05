/**
 * FeishuMention Resolver - 使用示例
 */

import { 
  FeishuMentionResolver, 
  resolve, 
  addBotMapping, 
  addUserAlias, 
  saveBotConfig,
  loadBotConfig 
} from '../index.js';

console.log('===== FeishuMention Resolver 使用示例 =====\n');

// =====================
// 方式一：手动实例化（推荐）
// =====================

async function example1() {
  console.log('📌 方式一：手动实例化\n');
  
  // 创建解析器实例（可复用）
  const resolver = new FeishuMentionResolver(undefined, {
    botMappings: {
      '@技术助手': 'rs_tech_001',
      '@数据查询': 'rs_data_001'
    },
    aliases: [
      { name: '张三', alias: ['小王', '老张', 'zhangsan'] },
      { name: '李四', alias: ['李总', 'lisi'] }
    ]
  });
  
  const text = '你好 @技术助手，@小王 说...';
  console.log(`原文本："${text}"`);
  console.log('(实际解析需要调用 API)\n');
}

// =====================
// 方式二：便捷函数
// =====================

async function example2() {
  console.log('📌 方式二：便捷函数\n');
  
  const text = '请 @产品经理 确认需求';
  
  const result = await resolve(text, 'cliabxxx', 'oc_chatxxx', {
    botMappings: {
      '@产品经理': 'ou_product_manager'
    }
  });
  
  console.log(result);
  // 输出：请 @产品经理 ou_xxx 确认需求
}

// =====================
// 方式三：集成到飞书机器人消息处理流程
// =====================

class MyFeishuBot {
  constructor() {
    this.resolver = new FeishuMentionResolver(undefined, {
      botMappings: {
        '@技术助手': 'rs_tech_bot_id',
        '@审批流程': 'rs_approval_bot_id'
      },
      aliases: [
        { name: '张三', alias: ['小王', '张经理'] }
      ]
    });
    
    this.appId = process.env.FEISHU_APP_ID;
    this.appSecret = process.env.FEISHU_APP_SECRET;
  }
  
  /**
   * 处理收到的消息
   * @param {Object} event - 飞书事件对象
   */
  async handleMessage(event) {
    const { msg_type, content, sender } = event;
    
    // 提取用户 ID 和会话 ID
    const chatId = event.chat_id;
    
    // 获取消息内容
    let textContent;
    if (msg_type === 'text') {
      textContent = JSON.parse(content).text;
    } else if (msg_type === 'post') {
      textContent = extractTextFromPost(content);
    }
    
    // 解析@提及
    const resolvedText = await this.resolver.resolveTextMentions(
      textContent,
      this.appId,
      chatId
    );
    
    console.log('原始消息:', textContent);
    console.log('解析后:', resolvedText);
    
    // 发送回复
    await this.sendReply(resolvedText);
  }
  
  async sendReply(text) {
    // 实现发送消息的逻辑
    console.log('发送回复:', text);
  }
}

// =====================
// 方式四：批量处理多群
// =====================

async function example4() {
  console.log('📌 方式四：批量处理多群\n');
  
  const resolver = new FeishuMentionResolver();
  
  const groups = [
    { name: '技术讨论群', chatId: 'oc_group_tech', appId: 'cliab_tech_app' },
    { name: '产品规划群', chatId: 'oc_group_product', appId: 'cliab_product_app' },
    { name: '行政通知群', chatId: 'oc_group_admin', appId: 'cliab_admin_app' }
  ];
  
  const messageTemplate = '各位好，请大家关注 @管理员 的最新通知';
  
  for (const group of groups) {
    console.log(`\n=== ${group.name} ===`);
    
    const resolved = await resolver.resolveTextMentions(
      messageTemplate,
      group.appId,
      group.chatId
    );
    
    console.log(`${group.chatId}: ${resolved}`);
  }
}

// =====================
// 方式五：缓存管理
// =====================

async function example5() {
  console.log('📌 方式五：缓存管理\n');
  
  const resolver = new FeishuMentionResolver();
  
  const appId = 'cliab1234567890abcdef';
  const chatId = 'oc_1234567890abcdef';
  
  // 查看缓存状态
  const cachedMembers = resolver.getCachedMembers(appId, chatId);
  
  if (cachedMembers) {
    console.log(`当前缓存有 ${cachedMembers.length} 个成员`);
  } else {
    console.log('缓存为空，将调用 API 获取最新数据');
  }
  
  // 如果需要刷新缓存（如人员变动后）
  resolver.invalidateCache(appId, chatId);
  
  // 下次解析时会重新调用 API 获取数据
  const text = '@张三 请查收';
  const resolved = await resolver.resolveTextMentions(text, appId, chatId);
  console.log('解析结果:', resolved);
}

// =====================
// 方式六：动态添加配置
// =====================

async function example6() {
  console.log('📌 方式六：动态添加配置\n');
  
  // 添加机器人映射
  addBotMapping('@客服机器人', 'rs_customer_service');
  addBotMapping('@审批助手', 'rs_approval_bot');
  
  // 添加别名规则
  addUserAlias('王小明', ['WangX', '小王', 'xm_wang']);
  
  // 保存配置
  await saveBotConfig();
  
  console.log('✅ 配置已保存到本地');
  console.log('\n💡 下次启动时会自动加载这些配置\n');
}

// =====================
// 运行示例
// =====================

(async () => {
  await example1();
  await example2();
  console.log('\n===== 飞书机器人集成示例 =====\n');
  
  const bot = new MyFeishuBot();
  console.log('Bot 已初始化，配置了:');
  console.log('- 机器人映射:', Object.keys(bot.resolver.botMappings));
  console.log('- 别名规则:', bot.resolver.userAliases.length);
  console.log('\n模拟消息处理...');
  
  const mockEvent = {
    msg_type: 'text',
    content: JSON.stringify({
      text: '@技术助手 @小王 帮我查一下数据'
    }),
    chat_id: 'oc_example_group'
  };
  
  await bot.handleMessage(mockEvent);
})();

// 辅助函数：从富文本中提取纯文本
function extractTextFromPost(content) {
  const parsed = JSON.parse(content);
  const title = parsed.root_title || '';
  const paragraphs = parsed.paragraphs || [];
  
  return `${title}\n\n${paragraphs.map(p => p.text || '').join('\n')}`.trim();
}
