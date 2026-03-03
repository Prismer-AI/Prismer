/**
 * Context Indicator
 * 
 * 圆形进度指示器，显示当前 context 使用百分比
 * - 圆形 SVG 进度环
 * - 中间显示百分比数字
 * - 基于 200K 总容量
 */

"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAIStore } from '../../store/aiStore';
import { useActiveSession } from '../../store/chatSessionStore';

// ============================================================
// Constants
// ============================================================

const MAX_CONTEXT_TOKENS = 200000; // 200K tokens
const TOKENS_PER_CHAR = 0.25; // 粗略估算：1 个字符 ≈ 0.25 tokens
const WARNING_THRESHOLD = 0.8; // 80% 时警告
const DANGER_THRESHOLD = 0.95; // 95% 时危险

// ============================================================
// Helper Functions
// ============================================================

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// ============================================================
// Component
// ============================================================

interface ContextIndicatorProps {
  className?: string;
  size?: number; // 圆形大小，默认 40px
}

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  className,
  size = 40,
}) => {
  // Get paper context from AI Store
  const paperContext = useAIStore((state) => state.paperContext);
  const activeSession = useActiveSession();
  
  // Calculate token usage
  const contextStats = useMemo(() => {
    // 论文内容 tokens
    const markdownTokens = estimateTokens(paperContext?.markdown);
    
    // 检测数据 tokens (detections 内容)
    const detectionsTokens = paperContext?.detections?.reduce((sum, det) => {
      // PageDetection 可能没有 text 字段，使用 detections 数量估算
      return sum + 50; // 每个检测区域估算 50 tokens
    }, 0) || 0;
    
    // 元数据 tokens
    const metadataTokens = paperContext?.metadata 
      ? estimateTokens(paperContext.metadata.title) +
        estimateTokens(paperContext.metadata.abstract) +
        estimateTokens(paperContext.metadata.authors?.join(', '))
      : 0;
    
    // 对话历史 tokens (每条消息)
    const sessionMessages = activeSession?.messages || [];
    const conversationTokens = sessionMessages.reduce((sum, msg) => {
      return sum + estimateTokens(msg.rawContent);
    }, 0);
    
    // 系统提示词 tokens (估算)
    const systemPromptTokens = 2000;
    
    // 总计
    const paperContentTokens = markdownTokens + detectionsTokens + metadataTokens;
    const totalTokens = paperContentTokens + conversationTokens + systemPromptTokens;
    
    // 论文数量 (当前是单篇，未来可扩展)
    const paperCount = activeSession?.paperIds?.length || (paperContext ? 1 : 0);
    
    return {
      paperCount,
      paperContentTokens,
      conversationTokens,
      totalTokens,
      usagePercent: Math.min(totalTokens / MAX_CONTEXT_TOKENS, 1),
      remainingTokens: Math.max(MAX_CONTEXT_TOKENS - totalTokens, 0),
    };
  }, [paperContext, activeSession]);
  
  // SVG 圆形进度参数
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - contextStats.usagePercent);
  
  // 根据百分比确定颜色
  const getColor = (percent: number) => {
    if (percent >= DANGER_THRESHOLD) return { stroke: '#dc2626', text: 'text-red-600', bg: '#fef2f2' };
    if (percent >= WARNING_THRESHOLD) return { stroke: '#d97706', text: 'text-amber-600', bg: '#fffbeb' };
    return { stroke: '#10b981', text: 'text-emerald-600', bg: '#ecfdf5' };
  };
  
  const colors = getColor(contextStats.usagePercent);
  const percentValue = Math.round(contextStats.usagePercent * 100);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "relative flex items-center justify-center cursor-default flex-shrink-0",
              className
            )}
            style={{ width: size, height: size }}
          >
            {/* SVG 圆形进度环 */}
            <svg
              width={size}
              height={size}
              className="transform -rotate-90"
            >
              {/* 背景圆环 */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={strokeWidth}
              />
              {/* 进度圆环 */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={colors.stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            </svg>
            
            {/* 中间百分比数字 */}
            <span 
              className={cn(
                "absolute text-[10px] font-bold",
                colors.text
              )}
            >
              {percentValue}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-medium">Context Usage ({percentValue}%)</div>
            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">Papers:</span>
                <span>{contextStats.paperCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">Paper Content:</span>
                <span>{formatTokenCount(contextStats.paperContentTokens)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-stone-500">Chat History:</span>
                <span>{formatTokenCount(contextStats.conversationTokens)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t pt-1 font-medium">
                <span>Total:</span>
                <span>{formatTokenCount(contextStats.totalTokens)} / 200K</span>
              </div>
              <div className="flex justify-between gap-4 text-stone-500">
                <span>Remaining:</span>
                <span>{formatTokenCount(contextStats.remainingTokens)}</span>
              </div>
            </div>
            {contextStats.usagePercent >= DANGER_THRESHOLD && (
              <div className="pt-1 text-red-600">
                ⚠️ Context nearly full!
              </div>
            )}
            {contextStats.usagePercent >= WARNING_THRESHOLD && contextStats.usagePercent < DANGER_THRESHOLD && (
              <div className="pt-1 text-amber-600">
                ⚠️ Context getting full
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ContextIndicator;
