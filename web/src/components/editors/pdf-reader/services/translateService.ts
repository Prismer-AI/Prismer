/**
 * Translation Service
 * 
 * 使用服务端代理 /api/ai/translate 进行文本翻译
 * - 不在客户端暴露 API Key
 * - 支持多种目标语言
 * - 本地缓存减少重复请求
 */

// ============================================================
// Types
// ============================================================

export type TargetLanguage = 'zh' | 'ja' | 'de' | 'fr' | 'it' | 'es';

export interface LanguageOption {
  code: TargetLanguage;
  name: string;
  nativeName: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  targetLanguage: TargetLanguage;
  timestamp: number;
}

// ============================================================
// Constants
// ============================================================

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

export const DEFAULT_LANGUAGE: TargetLanguage = 'zh';

// Translation cache to avoid duplicate requests
const translationCache = new Map<string, TranslationResult>();

// AI availability status
let _aiAvailable: boolean | null = null;
let _aiCheckPromise: Promise<boolean> | null = null;

// ============================================================
// Translation Service
// ============================================================

class TranslateService {
  constructor() {
    // 启动时检查 AI 服务是否可用
    if (typeof window !== 'undefined') {
      this.checkAvailability();
    }
  }

  /**
   * 检查 AI 服务是否可用
   */
  private async checkAvailability(): Promise<boolean> {
    if (_aiAvailable !== null) {
      return _aiAvailable;
    }

    if (_aiCheckPromise) {
      return _aiCheckPromise;
    }

    _aiCheckPromise = (async () => {
      try {
        const response = await fetch('/api/config/client');
        if (response.ok) {
          const config = await response.json();
          _aiAvailable = !!config.aiEnabled;
          return _aiAvailable;
        }
      } catch (error) {
        console.warn('[TranslateService] Failed to check AI availability:', error);
      }
      _aiAvailable = false;
      return false;
    })();

    return _aiCheckPromise;
  }

  /**
   * 获取缓存 key
   */
  private getCacheKey(text: string, language: TargetLanguage): string {
    return `${language}:${text.slice(0, 100)}`;
  }

  /**
   * 从缓存获取翻译
   */
  getFromCache(text: string, language: TargetLanguage): TranslationResult | null {
    const key = this.getCacheKey(text, language);
    return translationCache.get(key) || null;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(result: TranslationResult): void {
    const key = this.getCacheKey(result.originalText, result.targetLanguage);
    translationCache.set(key, result);
    
    // Limit cache size
    if (translationCache.size > 500) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
  }

  /**
   * 获取语言名称
   */
  getLanguageName(code: TargetLanguage): string {
    return SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code;
  }

  /**
   * 翻译文本 - 通过服务端代理
   */
  async translate(
    text: string,
    targetLanguage: TargetLanguage = DEFAULT_LANGUAGE
  ): Promise<TranslationResult> {
    // Check cache first
    const cached = this.getFromCache(text, targetLanguage);
    if (cached) {
      return cached;
    }

    // Validate
    if (!text.trim()) {
      throw new Error('Empty text');
    }

    // 通过服务端代理翻译
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 503) {
        throw new Error('翻译服务未配置。请联系管理员。');
      }
      
      throw new Error(errorData.error || `Translation failed: ${response.status}`);
    }

    const result: TranslationResult = await response.json();

    // Save to cache
    this.saveToCache(result);

    return result;
  }

  /**
   * 检查是否可用 (异步)
   */
  async isAvailable(): Promise<boolean> {
    return this.checkAvailability();
  }

  /**
   * 同步检查是否可用 (使用缓存的状态)
   */
  isAvailableSync(): boolean {
    return _aiAvailable === true;
  }
}

// Singleton instance
export const translateService = new TranslateService();

export default translateService;
