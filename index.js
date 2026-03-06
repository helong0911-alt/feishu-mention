/**
 * FeishuMentionResolver - 飞书@提及解析器 (已修复)
 * 
 * 根据飞书官方文档：https://open.feishu.cn/document/server-docs/im-v1/message-content-description/create_json
 * @提及的正确格式是：<at user_id="ou_xxxxxxx">用户名</at>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 全局日志开关
const DEBUG_LOG = true;

function log(level, ...args) {
  if (DEBUG_LOG) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] [FeishuMention ${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
    
    // 标准输出
    console.log(msg);
  }
}

// 移除硬编码的测试密钥，改为从环境变量获取
const DEFAULT_APP_ID = process.env.FEISHU_APP_ID || '';
const DEFAULT_APP_SECRET = process.env.FEISHU_APP_SECRET || '';

export class FeishuMentionResolver {
  /**
   * 初始化解析器
   * @param {string} [cacheDir] - 缓存目录路径
   * @param {Object} [options] - 配置选项
   * @param {string} [options.appId] - 飞书 App ID
   * @param {string} [options.appSecret] - 飞书 App Secret
   */
  constructor(cacheDir, options = {}) {
    // log('INFO', '开始初始化解析器...');
    
    this.cacheDir = cacheDir || path.join(
      process.env.HOME || process.env.USERPROFILE,
      '.openclaw',
      'workspace',
      'cache',
      'feishu_mentions'
    );
    
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      // log('INFO', `创建缓存目录：${this.cacheDir}`);
    }
    
    this.cacheTTL = 2 * 60 * 60 * 1000; // 2 小时
    
    this.memoryCache = new Map();
    
    // 静态映射表（原机器人映射表）
    this.staticMappings = options.staticMappings || {};
    
    // 尝试从环境变量 FEISHU_BOT_MAPPING 加载配置
    // 格式: JSON string, e.g. '{"@技术助手":"ou_xxx", "@审批机器人":"ou_yyy"}'
    if (process.env.FEISHU_BOT_MAPPING) {
      try {
        const envMappings = JSON.parse(process.env.FEISHU_BOT_MAPPING);
        // 环境变量作为初始值
        this.staticMappings = { ...this.staticMappings, ...envMappings };
        // log('INFO', `✅ 从环境变量 FEISHU_BOT_MAPPING 加载了 ${Object.keys(envMappings).length} 个静态映射`);
      } catch (error) {
        log('WARN', `❌ 解析环境变量 FEISHU_BOT_MAPPING 失败: ${error.message}`);
      }
    }

    this.userAliases = options.aliases || [];
    
    // 默认配置 (用户提供的)
    this.appId = options.appId || DEFAULT_APP_ID;
    this.appSecret = options.appSecret || DEFAULT_APP_SECRET;
    this.tokenCache = {
      token: null,
      expireTime: 0
    };

    // log('INFO', '✅ 解析器初始化完成');
  }
  
  _getCacheFile(appId, chatId) {
    const cacheKey = `${appId}_${chatId}`;
    const hash = crypto.createHash('md5').update(cacheKey).digest('hex').substring(0, 16);
    return path.join(this.cacheDir, `${hash}.json`);
  }
  
  getCachedMembers(appId, chatId) {
    const key = `${appId}_${chatId}`;
    
    // 查内存缓存
    if (this.memoryCache.has(key)) {
      const [timestamp, members] = this.memoryCache.get(key);
      if (Date.now() - timestamp < this.cacheTTL) {
        // log('INFO', `✅ 内存缓存命中 (${members.length}个成员)`);
        return members;
      }
    }
    
    // 查文件缓存
    const cacheFile = this._getCacheFile(appId, chatId);
    if (!fs.existsSync(cacheFile)) {
      // log('WARN', `❌ 缓存文件不存在：${cacheFile}`);
      return null;
    }
    
    try {
      const content = fs.readFileSync(cacheFile, 'utf8');
      const data = JSON.parse(content);
      
      if (Date.now() - data.updated_at > this.cacheTTL) {
        // log('WARN', '❌ 缓存已过期');
        return null;
      }
      
      // log('INFO', `✅ 文件缓存命中 (${data.members_data?.length || 0}个成员)`);
      this.memoryCache.set(key, [Date.now(), data.members_data]);
      return data.members_data;
    } catch (error) {
      log('ERROR', `读取缓存失败:`, error.message);
      return null;
    }
  }
  
  /**
   * 获取 Tenant Access Token
   */
  async _getTenantAccessToken(appId = this.appId, appSecret = this.appSecret) {
    // 检查缓存
    if (this.tokenCache.token && Date.now() < this.tokenCache.expireTime) {
      // log('DEBUG', '使用缓存的 Tenant Access Token');
      return this.tokenCache.token;
    }

    // log('INFO', '正在获取新的 Tenant Access Token...');
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(`飞书 API 错误: ${data.msg} (code: ${data.code})`);
      }

      this.tokenCache.token = data.tenant_access_token;
      // 提前 5 分钟过期，确保可用
      this.tokenCache.expireTime = Date.now() + (data.expire - 300) * 1000;
      
      // log('INFO', '成功获取 Tenant Access Token');
      return this.tokenCache.token;
    } catch (error) {
      log('ERROR', '获取 Tenant Access Token 失败:', error.message);
      return null;
    }
  }
    
  async fetchMembersFromApi(appId, chatId) {
    // 如果没有配置 appSecret (使用默认值或传入值)，无法调用
    const currentAppId = appId || this.appId;
    const currentAppSecret = this.appSecret; // 假设 secret 是当前实例配置的
    
    if (!currentAppId || !currentAppSecret) {
      log('WARN', '⚠️ 缺少 App ID 或 App Secret，无法调用 API');
      return [];
    }
    
    // 获取 Token
    const token = await this._getTenantAccessToken(currentAppId, currentAppSecret);
    if (!token) return [];

    // log('INFO', `正在从飞书 API 获取群成员 (chat_id: ${chatId})...`);
    
    const members = [];
    let pageToken = '';
    let hasMore = true;

    try {
      while (hasMore) {
        const url = new URL(`https://open.feishu.cn/open-apis/im/v1/chats/${chatId}/members`);
        url.searchParams.append('member_id_type', 'open_id');
        if (pageToken) {
          url.searchParams.append('page_token', pageToken);
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code !== 0) {
          // 常见错误处理
          if (data.code === 230001) { // 无权限访问群组
            log('WARN', `❌ 机器人不在该群组或无权限访问成员列表`);
          } else {
             log('ERROR', `飞书 API 错误: ${data.msg} (code: ${data.code})`);
          }
          break; // 出错则停止
        }
        
        if (data.data && data.data.items) {
          members.push(...data.data.items);
        }
        
        hasMore = data.data.has_more;
        pageToken = data.data.page_token;
      }
      
      // log('INFO', `✅ 成功获取 ${members.length} 个群成员`);
      return members;
    } catch (error) {
      log('ERROR', '调用飞书 API 获取成员失败:', error.message);
      return [];
    }
  }
  
  /**
   * 构建飞书@提及的 XML 格式
   * @param {string} name - 用户/机器人的名称
   * @param {string} openId - openid (ou_开头的是真人，rs_开头的是机器人)
   * @returns {string} - <at user_id="ou_xxx">张三</at>
   */
  buildMentionTag(name, openId) {
    // 飞书文档：<at user_id="ou_xxx">name</at>
    // user_id 属性需要完整的 open_id (包含 ou_ 或 rs_ 前缀)
    
    return `<at user_id="${openId}">${name}</at>`;
  }
  
  /**
   * 解析单个提及
   */
  async resolveMention(mention, appId, chatId) {
    // log('INFO', `▶️ resolveMention: "${mention}"`);
    
    // 检查是否已经是<at>标签格式
    const atTagPattern = /<at\s+user_id=".*?".*?>.*?<\/at>/;
    if (atTagPattern.test(mention)) {
      // log('INFO', `✅ 已是<at>标签格式，直接返回`);
      return mention;
    }
    
    // 检查是否是旧格式的 "@name openid"
    const oldFormatPattern = /^@(.*?)\s+(ou_|rs_)/;
    const oldMatch = mention.match(oldFormatPattern);
    if (oldMatch) {
      const name = oldMatch[1];
      const openId = oldMatch[0].substring(name.length + 1).trim();
      const tag = this.buildMentionTag(name, openId);
      // log('INFO', `✅ 从旧格式转换为新格式:"${mention}" -> "${tag}"`);
      return tag;
    }
    
    // 标准@name 格式
    const nameMatch = mention.match(/^@(.*?)$/);
    if (!nameMatch) {
      log('WARN', `❌ 无法解析提及格式: ${mention}`);
      return mention;
    }
    
    const name = nameMatch[1];
    let matchedOpenId = null;
    
    // log('DEBUG', `🔍 开始查找: "${name}"`);
    
    // ① 静态映射（固定映射，最高优先级）
    // 支持：
    // 1. 大小写不敏感
    // 2. 配置项 key 可以带 @ 也可以不带
    // 3. 环境变量或配置文件加载的映射
    const lowerName = name.toLowerCase();
    for (const [key, id] of Object.entries(this.staticMappings)) {
      // 归一化 key: 去掉可能的 @ 前缀，并转小写
      const normalizedKey = key.replace(/^@/, '').toLowerCase();
      // Add detailed debug log for comparison
      // log('DEBUG', `比较: "${lowerName}" vs "${normalizedKey}" (config: ${key})`);
      if (normalizedKey === lowerName) {
        matchedOpenId = id;
        // 使用配置中的名称（保留大小写）作为显示名称
        const displayName = key.replace(/^@/, '');
        // log('INFO', `✅ [staticMappings] 匹配到：${name} (key: ${key}) → ${matchedOpenId}`);
        return this.buildMentionTag(displayName, matchedOpenId);
      }
    }
    
    if (matchedOpenId) {
      return this.buildMentionTag(name, matchedOpenId);
    }
    
    // ② 别名映射
    for (const aliasRule of this.userAliases) {
      if (aliasRule.name === name || aliasRule.alias.includes(name)) {
        // log('INFO', `✅ [aliases] 别名映射：${name} → ${aliasRule.name}`);
        return await this.resolveMention(`@${aliasRule.name}`, appId, chatId);
      }
    }
    
    // ③ 本地缓存
    const members = this.getCachedMembers(appId, chatId);
    
    if (members) {
      for (const member of members) {
        if (member.name === name) {
          matchedOpenId = member.open_id;
          // log('INFO', `✅ [cache] 找到：${name} → ${matchedOpenId}`);
          break;
        }
      }
    }
    
    if (matchedOpenId) {
      return this.buildMentionTag(name, matchedOpenId);
    }
    
    // ④ API 获取
    // log('DEBUG', `🌐 尝试 API 获取...`);
    try {
      const newMembers = await this.fetchMembersFromApi(appId, chatId);
      
      if (newMembers && newMembers.length > 0) {
        this.saveCache(appId, chatId, newMembers);
        
        for (const member of newMembers) {
          if (member.name === name) {
            matchedOpenId = member.member_id || member.open_id; // API 兼容
            // log('INFO', `✅ [API] 找到：${name} → ${matchedOpenId}`);
            break;
          }
        }
        
        if (matchedOpenId) {
          return this.buildMentionTag(name, matchedOpenId);
        }
      }
    } catch (error) {
      log('ERROR', 'API 调用失败:', error.message);
    }
    
    // 兜底：返回原样
    log('WARN', `❌ 未找到，返回原样: ${mention}`);
    return mention;
  }
  
  /**
   * 批量解析文本中的所有@提及
   */
  async resolveTextMentions(text, appId, chatId) {
    // 允许 appId 为空，此时使用实例配置的默认 appId
    const currentAppId = appId || this.appId;
    
    // log('INFO', `▶️ resolveTextMentions`);
    // log('DEBUG', `原文本："${text}" (appId: ${currentAppId}, chatId: ${chatId})`);
    
    // Log active mappings count to verify config loading
    const mappingCount = Object.keys(this.staticMappings).length;
    if (mappingCount > 0) {
      // log('INFO', `📊 当前生效的静态映射数量: ${mappingCount}`);
      // log('DEBUG', `映射详情: ${JSON.stringify(this.staticMappings)}`);
    } else {
      // log('WARN', `⚠️ 当前没有任何静态映射配置`);
    }

    if (!currentAppId) {
       log('WARN', '⚠️ 未提供 appId 且未配置环境变量 FEISHU_APP_ID，可能无法正确缓存或调用 API');
    }

    let processedText = text;

    // 0. 优先处理特殊格式：@[user:ou_xxxx]
    // 这种格式可能是某些机器人或 API 产生的变体
    // 正则解释：
    // @\[user:           匹配 @[user:
    // (ou_[a-z0-9]+)     匹配 OpenID
    // \]                 匹配 ]
    const specialUserPattern = /@\[user:(ou_[a-z0-9]+)\]/gi;
    
    processedText = processedText.replace(specialUserPattern, (match, openId) => {
      // 尝试从缓存或映射中反查名字
      let name = "用户"; // 默认回退名
      
      // 尝试在 staticMappings 中反查
      for (const [key, value] of Object.entries(this.staticMappings)) {
        if (value === openId) {
          name = key.replace(/^@/, '');
          break;
        }
      }
      
      // 尝试在缓存中查找
      if (name === "用户") {
        const cachedMembers = this.getCachedMembers(currentAppId, chatId);
        if (cachedMembers) {
          const member = cachedMembers.find(m => m.open_id === openId || m.member_id === openId);
          if (member) {
            name = member.name;
          }
        }
      }

      const tag = this.buildMentionTag(name, openId);
      // log('INFO', `✅ 识别到特殊格式: "${match}" -> "${tag}"`);
      return tag;
    });

    // 1. 先处理带有显式 ID 的格式：@姓名 (ou_xxxx) 或 @姓名 ou_xxxx
    // 这种格式通常是复制粘贴产生的，或者旧格式遗留
    // 正则解释：
    // @([^\s]+)       匹配 @姓名
    // \s*             允许中间有空格
    // (?:[\(（]\s*)?  可选的左括号（中英文）
    // ((?:ou_|rs_)[a-z0-9]+)  匹配 ID (必须以 ou_ 或 rs_ 开头)
    // (?:\s*[\)）])?  可选的右括号（中英文）
    const explicitIdPattern = /@([^\s]+)\s*(?:[\(（]\s*)?((?:ou_|rs_)[a-z0-9]+)(?:\s*[\)）])?/gi;
    
    // 1. 先处理带有显式 ID 的格式：@姓名 (ou_xxxx) 或 @姓名 ou_xxxx
    processedText = processedText.replace(explicitIdPattern, (match, name, openId) => {
      // 避免匹配到 [user:ou_xxx]
      if (name.includes('[') || name.includes(']')) {
         return match;
      }
      const tag = this.buildMentionTag(name, openId);
      // log('INFO', `✅ 识别到显式 ID 格式: "${match}" -> "${tag}"`);
      return tag;
    });
    // 匹配所有 @开头的提及
    // 修复: 移除了错误的 (?![^\w]) 检查，该检查会导致提及被截断
    const pattern = /(?<!:)(@[^\s:,。\!?；:\'".,!?;]+)/g;
    
    const matches = [...processedText.matchAll(pattern)];
    
    if (matches.length === 0) {
      if (text !== processedText) {
        // 如果处理了显式ID但没有其他@提及，直接返回处理后的文本
        return processedText;
      }
      // log('WARN', '⚠️ 未找到任何@提及');
      return text;
    }
    
    // log('INFO', `找到 ${matches.length} 个@提及 (普通解析):`);
    for (let i = 0; i < matches.length; i++) {
      // log('DEBUG', `   [${i + 1}] "${matches[i][0]}"`);
    }
    
    // 按反向顺序替换
    let result = processedText;
    
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const fullMatch = match[0];
      
      // 跳过已有<at>标签的
      if (/<at\s+user_id=".*?".*?>.*?<\/at>/.test(fullMatch)) {
        // log('DEBUG', `   ✅ 已有<at>标签，跳过`);
        continue;
      }
      
      const resolved = await this.resolveMention(fullMatch, currentAppId, chatId);
      result = result.substring(0, match.index) + resolved + result.substring(match.index + fullMatch.length);
      
      // log('INFO', `🔄 "${fullMatch}" => "${resolved}"`);
    }
    
    // log('INFO', `\n结果:"${result}"`);
    return result;
  }
  
  saveCache(appId, chatId, membersData) {
    const cacheFile = this._getCacheFile(appId, chatId);
    const cachedData = {
      updated_at: Date.now(),
      members_data: membersData
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2), 'utf8');
    // log('INFO', `💾 缓存已保存：${cacheFile}`);
  }
  
  invalidateCache(appId, chatId) {
    const cacheFile = this._getCacheFile(appId, chatId);
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      // log('INFO', `🗑️ 已清除缓存：${cacheFile}`);
    }
  }
  
  clearAllCache() {
    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
    this.memoryCache.clear();
    // log('INFO', `🗑️ 已清除所有缓存 (${files.length}个文件)`);
  }
}

// ========== 便捷函数 ==========

export async function resolve(text, appId, chatId, options = {}) {
  // 优先级：
  // 1. options 中的显式参数
  // 2. 环境变量 (通过默认值)
  // 3. globalResolver 中已存在的配置

  // 解析传入的映射配置 (优先级：staticMapping JSON > botMapping JSON > staticMappings Obj > botMappings Obj)
  const passedMappings = options.staticMapping 
    ? JSON.parse(options.staticMapping) 
    : (options.botMapping 
        ? JSON.parse(options.botMapping) 
        : (options.staticMappings || options.botMappings || {}));

  const finalOptions = {
    appId: options.appId || globalResolver.appId,
    appSecret: options.appSecret || globalResolver.appSecret,
    // 合并全局配置和传入配置
    staticMappings: { ...globalResolver.staticMappings, ...passedMappings },
    aliases: [ ...globalResolver.userAliases, ...(options.aliases || []) ]
  };

  // 如果传递了特定的配置或密钥，创建一个新的临时解析器实例
  if (Object.keys(options).length > 0 || appId || finalOptions.appId !== globalResolver.appId) {
     const resolver = new FeishuMentionResolver(undefined, finalOptions);
     return await resolver.resolveTextMentions(text, appId, chatId);
  }
  
  return await globalResolver.resolveTextMentions(text, appId, chatId);
}

export function getCached(appId, chatId) {
  return globalResolver.getCachedMembers(appId, chatId);
}

export function clearCache(appId, chatId) {
  if (appId && chatId) {
    globalResolver.invalidateCache(appId, chatId);
  } else {
    globalResolver.clearAllCache();
  }
}

// 全局实例
const globalResolver = new FeishuMentionResolver();

export function addStaticMapping(atName, openId) {
  globalResolver.staticMappings[atName] = openId;
  // log('INFO', `➕ 添加静态映射：${atName} → ${openId}`);
}

// 兼容旧函数名
export const addBotMapping = addStaticMapping;

export function addUserAlias(realName, aliases) {
  globalResolver.userAliases.push({ name: realName, alias: aliases });
  // log('INFO', `➕ 添加别名：${realName} ← [${aliases.join(', ')}]`);
}

export async function saveBotConfig(filePath = null) {
  const config = {
    staticMappings: globalResolver.staticMappings,
    userAliases: globalResolver.userAliases,
    saved_at: new Date().toISOString()
  };
  const targetPath = filePath || path.join(globalResolver.cacheDir, 'bots_cache.json');
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');
  // log('INFO', `💾 配置已保存到：${targetPath}`);
  return targetPath;
}

export async function loadBotConfig(filePath = null) {
  const targetPath = filePath || path.join(globalResolver.cacheDir, 'bots_cache.json');
  if (!fs.existsSync(targetPath)) {
    // log('WARN', `❌ 配置文件不存在：${targetPath}`);
    return false;
  }
  try {
    const content = fs.readFileSync(targetPath, 'utf8');
    const config = JSON.parse(content);
    // 兼容旧配置 key (botMappings)
    Object.assign(globalResolver.staticMappings, config.staticMappings || config.botMappings || {});
    globalResolver.userAliases.push(...(config.aliases || []));
    // log('INFO', `✅ 配置已加载 (${Object.keys(globalResolver.staticMappings).length}个静态映射，${globalResolver.userAliases.length}个别名)`);
    return true;
  } catch (error) {
    log('ERROR', '加载配置失败:', error.message);
    return false;
  }
}
