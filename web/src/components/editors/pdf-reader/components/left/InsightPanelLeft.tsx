/**
 * Insight Panel Left
 * 
 * 左边栏版本的 Quick Insights 面板
 * 特点：
 * - 紧凑的卡片式布局
 * - 支持添加到 Notes
 * - 支持 Citation 跳转
 * 
 * 更新：使用 InsightStore 管理 insights 缓存
 */

"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Target,
  Lightbulb,
  BarChart3,
  AlertTriangle,
  Compass,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PaperInsight, InsightType, SourceCitation } from '@/types/paperContext';
import { useAIStore } from '../../store/aiStore';
import { useCitationStore } from '../../store/citationStore';
import {
  useInsightStore,
  useCurrentInsights,
  useInsightLoading,
  useInsightError,
} from '../../store/insightStore';
import { InlineCitation } from '../ui/CitationTag';
import {
  getDefaultPaperAgentService,
  createAgentConfigAsync,
} from '../../services/paperAgentService';

// ============================================================
// Types
// ============================================================

interface InsightPanelLeftProps {
  className?: string;
  onAddToNotes?: (insight: PaperInsight) => void;
  onNavigateToPage?: (pageNumber: number) => void;
}

// ============================================================
// Insight Configuration (IMRAD)
// ============================================================

const INSIGHT_CONFIG: Record<InsightType, {
  icon: React.ReactNode;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  core_problem: {
    icon: <Target className="w-3.5 h-3.5" />,
    label: 'Introduction',
    shortLabel: 'I',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  main_method: {
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    label: 'Methods',
    shortLabel: 'M',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  key_results: {
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    label: 'Results',
    shortLabel: 'R',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  limitations: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: 'Limitations',
    shortLabel: 'L',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  future_work: {
    icon: <Compass className="w-3.5 h-3.5" />,
    label: 'Future Work',
    shortLabel: 'F',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  custom: {
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    label: 'Insight',
    shortLabel: 'C',
    color: 'text-stone-600',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-200',
  },
};

// ============================================================
// Insight Card Component
// ============================================================

interface InsightCardCompactProps {
  insight: PaperInsight & { expanded?: boolean };
  onAddToNotes?: () => void;
  onNavigateToPage?: (pageNumber: number) => void;
  onToggleExpand: (id: string) => void;
}

const InsightCardCompact: React.FC<InsightCardCompactProps> = ({
  insight,
  onAddToNotes,
  onNavigateToPage,
  onToggleExpand,
}) => {
  const config = INSIGHT_CONFIG[insight.type];
  const { scrollToDetection } = useCitationStore();
  const isExpanded = insight.expanded ?? false;

  // 提取 [[detection_id]] 引用
  const citationRefs = useMemo(() => {
    const refs: { id: string; index: number }[] = [];
    const pattern = /\[\[(p\d+_\w+_\d+)\]\]/g;
    let match: RegExpExecArray | null;
    let index = 1;
    while ((match = pattern.exec(insight.content)) !== null) {
      const matchedId = match[1];
      if (matchedId && !refs.some(r => r.id === matchedId)) {
        refs.push({ id: matchedId, index: index++ });
      }
    }
    return refs;
  }, [insight.content]);

  // 将 [[id]] 替换为 Markdown code 格式
  const processedContent = useMemo(() => {
    let content = insight.content;
    citationRefs.forEach(ref => {
      content = content.replace(
        new RegExp(`\\[\\[${ref.id}\\]\\]`, 'g'),
        `\`cite:${ref.id}:${ref.index}\``
      );
    });
    return content;
  }, [insight.content, citationRefs]);

  const handleToggle = useCallback(() => {
    onToggleExpand(insight.id);
  }, [insight.id, onToggleExpand]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        config.bgColor,
        config.borderColor
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/50 transition-colors"
        onClick={handleToggle}
      >
        <span className={cn("flex-shrink-0", config.color)}>
          {config.icon}
        </span>
        <span className={cn("text-sm font-medium flex-1 truncate", config.color)}>
          {config.label}
        </span>
        {onAddToNotes && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToNotes();
                  }}
                  className="h-6 w-6 p-0 hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Add to Notes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="text-stone-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </div>

      {/* Content (Expandable) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="px-3 pb-3 pt-0">
              <div className="prose prose-sm prose-stone max-w-none 
                            prose-p:text-stone-700 prose-p:text-xs prose-p:leading-relaxed prose-p:my-1
                            prose-ul:my-1 prose-li:my-0.5 prose-li:text-xs
                            prose-ol:my-1 prose-ol:list-decimal prose-ol:ml-4
                            prose-strong:text-stone-800 prose-strong:font-medium
                            break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // 渲染 citation 标签
                    code: ({ children }) => {
                      const text = String(children);
                      const citeMatch = text.match(/^cite:(p\d+_\w+_\d+):(\d+)$/);
                      if (citeMatch) {
                        return (
                          <InlineCitation
                            detectionId={citeMatch[1]}
                            index={parseInt(citeMatch[2])}
                          />
                        );
                      }
                      return (
                        <code className="px-1 py-0.5 bg-stone-100 rounded text-[10px] font-mono text-stone-600 break-all">
                          {children}
                        </code>
                      );
                    },
                    // 简化段落样式
                    p: ({ children }) => (
                      <p className="text-xs text-stone-700 leading-relaxed my-1 break-words">
                        {children}
                      </p>
                    ),
                    // 简化列表样式
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside ml-4 my-1 space-y-0.5">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside ml-4 my-1 space-y-0.5">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-xs text-stone-700 break-words">{children}</li>
                    ),
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const InsightPanelLeft: React.FC<InsightPanelLeftProps> = ({
  className,
  onAddToNotes,
  onNavigateToPage,
}) => {
  // AI Store - for paper context (document-level state)
  const { paperContext } = useAIStore();

  // Insight Store - for insights management (paper-level cache)
  const {
    setInsights,
    setCurrentPaper,
    hasValidCache,
    setLoading: setInsightsLoading,
    setError: setInsightsError,
  } = useInsightStore();

  const insights = useCurrentInsights();
  const insightsLoading = useInsightLoading();
  const insightsError = useInsightError();

  // Local state for expansion
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const hasAutoGeneratedRef = useRef<string | null>(null);

  // Get current paper ID
  const currentPaperId = paperContext?.source?.arxivId || null;

  // 检查论文内容是否可用
  const hasPaperContent = paperContext && 
    paperContext.hasOCRData && 
    (paperContext.detections?.length > 0 || paperContext.markdown?.length > 0);

  // Set current paper in InsightStore when paper changes
  useEffect(() => {
    if (currentPaperId) {
      setCurrentPaper(currentPaperId);
    }
  }, [currentPaperId, setCurrentPaper]);

  // Toggle insight expansion (local state)
  const toggleInsightExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Get insights with expanded state
  const insightsWithExpanded = useMemo(() => {
    return insights.map((insight, index) => ({
      ...insight,
      // Default: first insight expanded
      expanded: expandedIds.size === 0 ? index === 0 : expandedIds.has(insight.id),
    }));
  }, [insights, expandedIds]);

  // 生成 Insights
  const handleGenerateInsights = useCallback(async () => {
    if (!paperContext || !hasPaperContent || insightsLoading || !currentPaperId) {
      console.log('[InsightPanelLeft] Cannot generate insights:', {
        hasPaperContext: !!paperContext,
        hasPaperContent,
        insightsLoading,
        currentPaperId,
      });
      return;
    }

    console.log('[InsightPanelLeft] Generating insights for paper:', {
      paperId: currentPaperId,
      detectionsCount: paperContext.detections?.length,
      markdownLength: paperContext.markdown?.length,
    });

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const service = getDefaultPaperAgentService();
      const config = await createAgentConfigAsync();

      if (!config) {
        throw new Error('Agent configuration not available');
      }
      
      await service.initialize(config);
      const newInsights = await service.generateInsights(paperContext);
      
      // Save to InsightStore with paper context
      setInsights(currentPaperId, newInsights, paperContext.metadata?.title);
      
      // Auto-expand first insight
      if (newInsights.length > 0) {
        setExpandedIds(new Set([newInsights[0].id]));
      }
    } catch (error) {
      console.error('[InsightPanelLeft] Failed to generate insights:', error);
      setInsightsError(error instanceof Error ? error.message : 'Failed to generate insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [paperContext, hasPaperContent, insightsLoading, currentPaperId, setInsightsLoading, setInsights, setInsightsError]);

  // 自动生成 (首次加载，当有内容且没有缓存时)
  useEffect(() => {
    if (!currentPaperId || !hasPaperContent || insightsLoading) {
      return;
    }
    
    // Check if we already have valid cache
    if (hasValidCache(currentPaperId)) {
      console.log(`[InsightPanelLeft] Using cached insights for: ${currentPaperId}`);
      return;
    }
    
    // Check if we already auto-generated for this paper
    if (hasAutoGeneratedRef.current === currentPaperId) {
      return;
    }
    
    // Mark as auto-generated for this paper
    hasAutoGeneratedRef.current = currentPaperId;
    
    console.log('[InsightPanelLeft] Auto-generating insights...');
    handleGenerateInsights();
  }, [currentPaperId, hasPaperContent, insightsLoading, hasValidCache, handleGenerateInsights]);

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200 bg-stone-50/50">
        <span className="text-sm font-medium text-stone-600">Quick Insights</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateInsights}
                disabled={insightsLoading || !paperContext}
                className="h-7 w-7 p-0"
              >
                {insightsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-stone-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{insightsLoading ? 'Generating...' : 'Regenerate insights'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Error State */}
        {insightsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {insightsError}
          </div>
        )}

        {/* Loading State */}
        {insightsLoading && insights.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Generating insights...</span>
          </div>
        )}

        {/* Empty State */}
        {!insightsLoading && insights.length === 0 && !insightsError && (
          <div className="flex flex-col items-center justify-center py-8 text-stone-400">
            <Lightbulb className="w-6 h-6 mb-2 opacity-50" />
            <span className="text-xs mb-2">No insights yet</span>
            {paperContext && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateInsights}
                className="text-xs h-7"
              >
                Generate
              </Button>
            )}
          </div>
        )}

        {/* Insights List */}
        {insightsWithExpanded.map((insight) => (
          <InsightCardCompact
            key={insight.id}
            insight={insight}
            onAddToNotes={onAddToNotes ? () => onAddToNotes(insight) : undefined}
            onNavigateToPage={onNavigateToPage}
            onToggleExpand={toggleInsightExpanded}
          />
        ))}
      </div>
    </div>
  );
};

export default InsightPanelLeft;
