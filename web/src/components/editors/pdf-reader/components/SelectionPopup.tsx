/**
 * Selection Popup
 * 
 * 选中文本后的弹出菜单
 * 
 * 操作：
 * - Add to Notes → 添加到 Notes 面板 (Coming Soon)
 * - Ask AI → 设置引用并跳转到 Chat 面板
 * - Translate → 翻译选中文本
 */

"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles,
  FileEdit,
  Languages,
  ChevronDown,
  Loader2,
  X,
  Check,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { useAIStore } from '../store/aiStore';
import { 
  translateService, 
  TranslationResult, 
  TargetLanguage, 
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from '../services/translateService';

// ============================================================
// Types
// ============================================================

interface SelectionPopupProps {
  position: { x: number; y: number };
  selectedText: string;
  pageNumber?: number;
  onClose: () => void;
}

// ============================================================
// Translation Panel Component
// ============================================================

interface TranslationPanelProps {
  text: string;
  onClose: () => void;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({ text, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(DEFAULT_LANGUAGE);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 执行翻译
  const doTranslate = useCallback(async (lang: TargetLanguage) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await translateService.translate(text, lang);
      setTranslation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  // 初始翻译
  useEffect(() => {
    doTranslate(targetLanguage);
  }, []);

  // 切换语言
  const handleLanguageChange = (lang: TargetLanguage) => {
    setTargetLanguage(lang);
    setShowLanguageSelect(false);
    doTranslate(lang);
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 5, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: 5, height: 0 }}
      className="border-t border-stone-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Languages className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-800">Translation</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageSelect(!showLanguageSelect)}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-stone-600 hover:bg-white/50 rounded transition-colors"
            >
              <span>{currentLang?.nativeName}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {showLanguageSelect && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-10 min-w-[140px]"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-xs hover:bg-stone-50 transition-colors flex items-center justify-between gap-2",
                        lang.code === targetLanguage && "bg-blue-50 text-blue-700"
                      )}
                    >
                      <span>{lang.nativeName}</span>
                      <span className="text-stone-400">{lang.name}</span>
                      {lang.code === targetLanguage && <Check className="w-3 h-3 text-blue-600" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-3 h-3 text-stone-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[200px] overflow-y-auto bg-white">
        {isLoading ? (
          <div className="flex items-center gap-2 text-stone-500 py-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Translating...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-red-500 py-2">{error}</div>
        ) : translation ? (
          <p className="text-sm text-stone-800 leading-relaxed">
            {translation.translatedText}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const SelectionPopup: React.FC<SelectionPopupProps> = ({
  position,
  selectedText,
  pageNumber = 1,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const { addExtract, setRightPanelTab, paperContext, setChatReference } = useAIStore();
  const [showTranslation, setShowTranslation] = useState(false);
  const [copied, setCopied] = useState(false);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /**
   * Copy：复制选中文本到剪贴板
   */
  const handleCopy = useCallback(async () => {
    if (!selectedText.trim()) return;
    
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      // 1.5秒后重置复制状态
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [selectedText]);

  /**
   * Add to Notes：添加到 Notes 面板
   */
  const handleAddToNotes = useCallback(() => {
    if (!selectedText.trim()) return;

    addExtract({
      type: 'highlight',
      content: selectedText,
      source: {
        id: `source-${Date.now()}`,
        text: selectedText,
        pageNumber: pageNumber,
        confidence: 1.0,
      },
      tags: [],
    });

    // 切换到 Notes 面板
    setRightPanelTab('notes');
    onClose();
  }, [selectedText, pageNumber, addExtract, setRightPanelTab, onClose]);

  /**
   * Ask AI：设置引用并跳转到 Chat 面板
   */
  const handleAskAI = useCallback(() => {
    setChatReference({
      text: selectedText,
      pageNumber: pageNumber,
    });
    setRightPanelTab('chat');
    onClose();
  }, [selectedText, pageNumber, setChatReference, setRightPanelTab, onClose]);

  /**
   * Translate：翻译选中文本
   */
  const handleTranslate = useCallback(() => {
    setShowTranslation(!showTranslation);
  }, [showTranslation]);

  // 计算 PDF 阅读区域的一半宽度
  const popupWidth = typeof window !== 'undefined' 
    ? Math.min(window.innerWidth * 0.4, 600) // 约为 PDF 区域的一半
    : 400;

  // Calculate adjusted position
  const adjustedPosition = {
    x: Math.max(10, Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - popupWidth - 20 : position.x)),
    y: Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 100 : position.y),
  };

  const hasAICapability = paperContext?.hasOCRData || paperContext?.markdown;
  const isTranslationAvailable = translateService.isAvailableSync();

  return (
    <div
      ref={popupRef}
      className="fixed z-50 selection-popup"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: showTranslation ? popupWidth : 'auto',
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 overflow-hidden min-w-[280px]">
        {/* Action Buttons */}
        <div className="p-1.5 flex items-center gap-1">
          {/* Copy 按钮 */}
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
              "hover:bg-stone-100 transition-colors",
              copied ? "text-green-600" : "text-stone-600"
            )}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckCheck className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="text-xs font-medium">{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* 分隔线 */}
          <div className="w-px h-5 bg-stone-200" />

          {/* Add to Notes 按钮 - Coming Soon */}
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
              "text-stone-300 cursor-not-allowed"
            )}
            disabled
            title="Add to Notes - Coming Soon"
          >
            <FileEdit className="w-4 h-4" />
            <span className="text-xs font-medium">Notes</span>
          </button>

          {/* 分隔线 */}
          {hasAICapability && <div className="w-px h-5 bg-stone-200" />}

          {/* Ask AI 按钮 */}
          {hasAICapability && (
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
                "hover:bg-indigo-50 transition-colors",
                "text-indigo-600"
              )}
              onClick={handleAskAI}
              title="Ask AI about this selection"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium">Ask AI</span>
            </button>
          )}

          {/* 分隔线 */}
          {isTranslationAvailable && <div className="w-px h-5 bg-stone-200" />}

          {/* Translate 按钮 */}
          {isTranslationAvailable && (
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md",
                "hover:bg-blue-50 transition-colors",
                showTranslation ? "bg-blue-100 text-blue-700" : "text-blue-600"
              )}
              onClick={handleTranslate}
              title="Translate this selection"
            >
              <Languages className="w-4 h-4" />
              <span className="text-xs font-medium">Translate</span>
            </button>
          )}
        </div>

        {/* Translation Panel */}
        <AnimatePresence>
          {showTranslation && (
            <TranslationPanel
              text={selectedText}
              onClose={() => setShowTranslation(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SelectionPopup;
