/**
 * GET /api/config/client
 * 
 * Returns runtime configuration for the frontend client.
 * Replaces build-time NEXT_PUBLIC_* variables with dynamic values.
 */

import { NextResponse } from 'next/server';

// 客户端配置类型
interface ClientConfig {
  aiEnabled: boolean;
  cdnDomain: string;
  githubClientId: string;
  googleClientId: string;
  appUrl: string;
  appName: string;
}

// 缓存配置，避免每次请求都读取
let cachedConfig: ClientConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 分钟缓存

export async function GET() {
  try {
    
    const now = Date.now();
    
    // 使用缓存
    if (cachedConfig && now - cacheTime < CACHE_TTL) {
      return NextResponse.json(cachedConfig);
    }
    
    // 返回客户端需要的配置
    // 注意：只返回安全的、客户端需要的配置
    // 
    // ⚠️ 安全警告：绝不返回敏感信息如 API Keys、Secrets 等
    // AI 请求通过 /api/ai/* 代理处理，客户端不需要 API Key
    const config = {
      // AI 配置 - 只返回是否可用的状态，不返回 API Key
      // 支持多种命名格式
      aiEnabled: !!(
        process.env.OPENAI_API_KEY 
        || process.env.OPENAI_APIKEY 
        || process.env.AI_API_KEY
      ),
      
      // CDN 配置
      cdnDomain: process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_DOMAIN || '',
      
      // OAuth 配置 (Client IDs 是公开的，安全)
      githubClientId: process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '',
      googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      
      // App 配置
      appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      appName: process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'Prismer Library',
    };
    
    // 更新缓存
    cachedConfig = config;
    cacheTime = now;
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('[Config] Failed to get client config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}
