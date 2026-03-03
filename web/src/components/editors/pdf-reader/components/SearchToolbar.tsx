'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchToolbarProps {
  searchQuery: string;
  searchResults: Array<{
    page: number;
    text: string;
    position: { x: number; y: number };
  }>;
  currentSearchIndex: number;
  onSearchQueryChange: (query: string) => void;
  onGoToNextResult: () => void;
  onGoToPrevResult: () => void;
  onClearSearch: () => void;
  className?: string;
}

export const SearchToolbar: React.FC<SearchToolbarProps> = ({
  searchQuery,
  searchResults,
  currentSearchIndex,
  onSearchQueryChange,
  onGoToNextResult,
  onGoToPrevResult,
  onClearSearch,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // 防抖搜索
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    
    // 清除之前的防抖定时器
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // 设置新的防抖定时器
    debounceTimeout.current = setTimeout(() => {
      onSearchQueryChange(value);
    }, 300);
  }, [onSearchQueryChange]);

  // 处理键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onGoToPrevResult();
      } else {
        onGoToNextResult();
      }
    } else if (e.key === 'Escape') {
      handleClearSearch();
    }
  }, [onGoToNextResult, onGoToPrevResult]);

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setInputValue('');
    onClearSearch();
    setIsExpanded(false);
  }, [onClearSearch]);

  // 切换搜索栏展开状态
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => {
      if (!prev) {
        // 展开时聚焦输入框
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      return !prev;
    });
  }, []);

  // 监听全局键盘快捷键 Ctrl+F
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsExpanded(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className={`search-toolbar ${className}`}>
      {/* 搜索按钮（折叠状态） */}
      {!isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleExpanded}
          className="flex items-center"
          title="Search (Ctrl+F)"
        >
          <Search className="w-4 h-4 mr-1" />
          Search
        </Button>
      )}

      {/* 搜索栏（展开状态） */}
      {isExpanded && (
        <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-80">
          <div className="flex items-center flex-1">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search document content..."
              className="flex-1 outline-none text-sm"
            />
          </div>

          {/* 搜索结果导航 */}
          {searchResults.length > 0 && (
            <div className="flex items-center space-x-1 ml-2 border-l border-gray-200 pl-2">
              <span className="text-xs text-gray-600 whitespace-nowrap">
                {currentSearchIndex + 1} / {searchResults.length}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoToPrevResult}
                disabled={searchResults.length === 0}
                className="p-1 h-6 w-6"
                title="Previous result (Shift+Enter)"
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoToNextResult}
                disabled={searchResults.length === 0}
                className="p-1 h-6 w-6"
                title="Next result (Enter)"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* 无结果提示 */}
          {inputValue && searchResults.length === 0 && (
            <div className="ml-2 text-xs text-gray-500">
              No matches found
            </div>
          )}

          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="p-1 h-6 w-6 ml-2"
            title="Close search (Esc)"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* 搜索结果预览（当有结果时显示） */}
      {isExpanded && searchResults.length > 0 && currentSearchIndex >= 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-80 max-w-96 z-50">
          <div className="text-xs text-gray-500 mb-1">
            Page {searchResults[currentSearchIndex]?.page}
          </div>
          <div className="text-sm text-gray-800 line-clamp-2">
            {searchResults[currentSearchIndex]?.text}
          </div>
        </div>
      )}

      {/* 搜索快捷键提示 */}
      {isExpanded && !inputValue && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap">
          <div>Enter: Next result</div>
          <div>Shift+Enter: Previous result</div>
          <div>Esc: Close search</div>
        </div>
      )}
    </div>
  );
}; 