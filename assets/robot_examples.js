/**
 * FeishuMention Resolver - 机器人支持示例
 */

import { 
  FeishuMentionResolver, 
  resolve, 
  addBotMapping, 
  addUserAlias, 
  saveBotConfig,
  loadBotConfig 
} from '../index.js';

console.log('===== 机器人支持功能演示 =====\n');

// ========== 场景 1: 基本配置 ==========

async function scenario1() {
  console.log('📌 场景 1: 配置机器人映射\n');
  
  // 方式 A: 构造函数传入
  const resolver = new FeishuMentionResolver(undefined, {
    botMappings: {
      '@技术助手': 'rs_xxxxxxxxxxxxxx',
      '@数据查询': 'rs_yyyyyyyyyyyyyy',
      '@日程提醒': 'rs_zzzzzzzzzzzzzz'
    },
    aliases: [
      { name: '张三', alias: ['小王', '张经理', 'zhangsan'] },
      { name: '李四', alias: ['李总', 'ls'] }
    ]
  });
  
  const text = '你好 @技术助手，@小王 问了下进度';
  console.log(`原文："${text}"`);
  console.log('(实际解析需要调用 API)\n');
  
  // 方式 B: 动态添加
  console.log('方式 B: 动态添加机器人映射');
  addBotMapping('@客服机器人', 'rs_customer_service');
  addBotMapping('@审批助手', 'rs_approval_bot');
  await saveBotConfig(); // 保存到本地文件
  console.log();
}

// ========== 场景 2: 使用已有配置 ==========

async function scenario2() {
  console.log('📌 场景 2: 从配置文件加载\n');
  
  // 尝试加载已保存的配置
  const loaded = await loadBotConfig();
  
  if (loaded) {
    const resolver = new FeishuMentionResolver(undefined, {});
    
    // 此时 resolver 会继承全局的机器人映射
    const testText = '请 @技术助手 帮我查一下 @王五 的数据';
    console.log(`测试文本："${testText}"`);
    console.log('(注意：@王五 如果没有缓存或 API，会原样输出)\n');
  } else {
    console.log('没有配置文件，先创建一些示例配置...\n');
  }
}

// ========== 场景 3: 完整工作流 ==========

async function scenario3() {
  console.log('📌 场景 3: 完整工作流\n');
  
  // 1. 加载配置
  await loadBotConfig();
  
  // 2. 设置多个群聊的配置
  const groups = [
    { appId: 'cliab_tech_app', chatId: 'oc_tech_group' },
    { appId: 'cliab_admin_app', chatId: 'oc_admin_group' }
  ];
  
  const messageTemplate = `各位好，这是最新的周报摘要：\n
✅ @技术助手 已完成系统升级\n
⚠️ @数据查询 反馈有个小问题，@项目经理 请关注\n
💡 @小王 提出了一个创新方案`;
  
  for (const group of groups) {
    console.log(`群组：${group.chatId}`);
    const resolved = await resolve(messageTemplate, group.appId, group.chatId, {
      botMappings: {
        '@技术助手': 'rs_tech_001',
        '@数据查询': 'rs_data_001',
        '@项目经理': 'ou_project_manager',
        '@小王': 'ou_wangxiaoming'
      },
      aliases: [
        { name: '张三', alias: ['小王', '老张'] },
        { name: '李四', alias: ['李总', 'lisi'] }
      ]
    });
    
    console.log('解析结果:');
    console.log(resolved);
    console.log();
  }
}

// ========== 场景 4: 配置文件格式 ==========

async function scenario4() {
  console.log('📌 场景 4: 配置文件格式示例\n');
  
  const configExample = {
    botMappings: {
      "@技术助手": "rs_tech_assistant_id",
      "@数据分析": "rs_data_analyst_id",
      "@日程管理": "rs_calendar_bot_id"
    },
    aliases: [
      {
        "name": "张三",
        "alias": ["小王", "张经理", "zhangsan", "ZS"]
      },
      {
        "name": "李四",
        "alias": ["李总", "lisi", "LS"]
      }
    ],
    saved_at: "2026-03-05T14:00:00.000Z"
  };
  
  console.log('建议的配置文件内容：');
  console.log(JSON.stringify(configExample, null, 2));
  console.log('\n文件位置：~/.openclaw/workspace/cache/feishu_mentions/bots_cache.json\n');
}

// ========== 运行演示 ==========

(async () => {
  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  
  console.log('✅ 所有演示完成！');
  console.log('\n💡 下一步:');
  console.log('1. 配置你的机器人映射：addBotMapping("@机器人名", "rs_xxx")');
  console.log('2. 保存配置：await saveBotConfig()');
  console.log('3. 在代码中使用时会自动生效');
})();
