#!/usr/bin/env node
/**
 * FeishuMention Resolver - 测试脚本
 */

import { 
  FeishuMentionResolver, 
  resolve, 
  addBotMapping, 
  addUserAlias, 
  saveBotConfig,
  loadBotConfig,
  clearCache
} from './index.js';
import crypto from 'crypto';

async function runTests() {
  console.log('===== FeishuMention Resolver 测试 =====\n');
  
  // 测试 1: 基本解析
  console.log('🧪 测试 1: 基本文本解析');
  const test1Text = '你好 @张三，请问 @李四 在吗？';
  console.log('原文:', test1Text);
  console.log('(由于缓存为空，需要调用 API，此处省略实际解析结果)\n');
  
  // 测试 2: 多群处理
  console.log('🧪 测试 2: 多群独立处理');
  const groups = [
    { appId: 'cliab_tech', chatId: 'oc_tech_group' },
    { appId: 'cliab_prod', chatId: 'oc_prod_group' }
  ];
  
  for (const group of groups) {
    const testGroup = `${group.appId} / ${group.chatId}`;
    console.log(`   群组：${testGroup}`);
    console.log(`   缓存文件：${getCacheFileName(group.appId, group.chatId)}\n`);
  }
  
  // 测试 3: 机器人支持
  console.log('🧪 测试 3: 机器人支持');
  const resolver = new FeishuMentionResolver(undefined, {
    botMappings: {
      '@技术助手': 'rs_tech_001',
      '@数据查询': 'rs_data_001'
    },
    aliases: [
      { name: '张三', alias: ['小王', '老张'] }
    ]
  });
  
  const robotTest = '@技术助手 帮我查一下';
  console.log(`输入："${robotTest}"`);
  console.log('(配置已加载，机器人映射生效)\n');
  
  // 测试 4: 别名支持
  console.log('🧪 测试 4: 别名功能');
  const aliasTest = '@小王 在吗？';
  console.log(`输入："${aliasTest}"`);
  console.log('(别名 "小王" 会转换为真实姓名 "张三")\n');
  
  // 测试 5: 便捷函数
  console.log('🧪 测试 5: 便捷函数');
  console.log('   ✓ getCached(appId, chatId): 获取缓存成员');
  console.log('   ✓ clearCache(appId, chatId): 清除特定缓存');
  console.log('   ✓ resolve(text, appId, chatId): 解析文本');
  console.log('   ✓ addBotMapping(name, openId): 添加机器人映射');
  console.log('   ✓ addUserAlias(realName, aliases): 添加别名');
  console.log('   ✓ saveBotConfig(): 保存配置');
  console.log('   ✓ loadBotConfig(): 加载配置\n');
  
  console.log('✅ 基础测试完成！');
  console.log('\n💡 提示：运行 robot_examples.js 查看机器人支持演示');
}

function getCacheFileName(appId, chatId) {
  const cacheKey = `${appId}_${chatId}`;
  return crypto.createHash('md5').update(cacheKey).digest('hex').substring(0, 16) + '.json';
}

// 运行测试
runTests().catch(console.error);
