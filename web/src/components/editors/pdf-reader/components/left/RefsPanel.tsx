"use client";

/**
 * References Panel
 * 
 * 显示论文引用列表，支持：
 * - References: 该论文引用的其他文献
 * - Citations: 引用该论文的文献 (via Semantic Scholar)
 * - arXiv 元数据悬浮预览
 * - 一键在阅读器中打开
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ExternalLink,
  FileText,
  BookOpen,
  Loader2,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Info,
  Quote,
  Link2,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ParsedReference,
  ArxivMetadata,
  getArxivMetadata,
  getReferences,
  getCitations,
} from "../../services/referenceService";
import { PaperContext } from "@/types/paperContext";

// ============================================================================
// Types
// ============================================================================

type TabType = "references" | "citations";

interface RefsPanelProps {
  paperContext: PaperContext | null;
  onOpenInReader?: (arxivId: string) => void;
}

interface ReferenceCardProps {
  reference: ParsedReference;
  metadata: ArxivMetadata | null;
  isLoadingMetadata: boolean;
  isLocallyAvailable: boolean;
  onOpenInReader?: (arxivId: string) => void;
  onHover?: (ref: ParsedReference | null) => void;
  isCitation?: boolean;
}

// ============================================================================
// Reference Card Component
// ============================================================================

const ReferenceCard: React.FC<ReferenceCardProps> = ({
  reference,
  metadata,
  isLoadingMetadata,
  isLocallyAvailable,
  onOpenInReader,
  onHover,
  isCitation = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 使用 S2 数据作为补充
  const s2Data = reference._s2Data;
  
  // 智能标题提取：优先使用解析的标题，否则尝试从 rawText 中提取
  const getDisplayTitle = () => {
    // 1. 优先使用 arXiv/S2 元数据
    if (metadata?.title) return metadata.title;
    // 2. 使用解析的标题
    if (reference.title) return reference.title;
    // 3. 从 rawText 中智能提取
    if (reference.rawText) {
      let text = reference.rawText;
      // 移除引用编号
      text = text.replace(/^\s*\[\d+\]\s*/, '');
      // 尝试提取引号中的标题
      const quotedMatch = text.match(/"([^"]+)"/);
      if (quotedMatch) return quotedMatch[1];
      // 尝试提取年份后的内容
      const afterYear = text.match(/\(\d{4}\)[a-z]?[.,]\s*([^.]+)/);
      if (afterYear && afterYear[1].length > 10) return afterYear[1].trim();
      // 截取前 80 个字符作为标题
      return text.slice(0, 80) + (text.length > 80 ? '...' : '');
    }
    return "Unknown Title";
  };
  
  const displayTitle = getDisplayTitle();
  
  // 智能作者提取
  const getDisplayAuthors = () => {
    // 1. 优先使用 arXiv/S2 元数据
    if (metadata?.authors && metadata.authors.length > 0) {
      return metadata.authors.slice(0, 3).join(", ");
    }
    // 2. 使用解析的作者
    if (reference.authors && reference.authors.length > 0) {
      return reference.authors.slice(0, 3).join(", ");
    }
    // 3. 从 rawText 中提取
    if (reference.rawText) {
      let text = reference.rawText.replace(/^\s*\[\d+\]\s*/, '');
      // 尝试提取到括号年份之前的内容
      const beforeYear = text.match(/^(.+?)\s*\(\d{4}\)/);
      if (beforeYear) {
        const authors = beforeYear[1].replace(/\s+et\s+al\.?/gi, ' et al.').trim();
        if (authors.length < 100) return authors;
      }
      // 尝试提取到引号之前
      const beforeQuote = text.match(/^(.+?)\s*"/);
      if (beforeQuote) {
        return beforeQuote[1].replace(/,\s*$/, '').trim();
      }
    }
    return "Unknown Authors";
  };
  
  const displayAuthors = getDisplayAuthors();
  const hasMoreAuthors = (metadata?.authors?.length || reference.authors?.length || 0) > 3;
  const displayAbstract = metadata?.abstract || s2Data?.abstract;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        "bg-white hover:bg-stone-50",
        reference.arxivId
          ? "border-indigo-200/60 hover:border-indigo-300"
          : s2Data
          ? "border-sky-200/60 hover:border-sky-300"
          : "border-stone-200 hover:border-stone-300"
      )}
      onMouseEnter={() => onHover?.(reference)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className={cn(
            "text-sm font-medium text-stone-800 leading-tight",
            !isExpanded && "line-clamp-2"
          )}>
            {displayTitle}
          </h4>
          
          {/* Authors */}
          <p className="text-xs text-stone-500 mt-1 line-clamp-1">
            {displayAuthors}
            {hasMoreAuthors && " et al."}
            {reference.year && ` • ${reference.year}`}
            {reference.venue && ` • ${reference.venue}`}
          </p>
        </div>
        
        {/* Status Badges */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end max-w-[100px]">
          {reference.arxivId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
              arXiv
            </span>
          )}
          {s2Data && !reference.arxivId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              S2
            </span>
          )}
          {isLocallyAvailable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5" />
              Local
            </span>
          )}
          {s2Data?.citationCount !== undefined && s2Data.citationCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              {s2Data.citationCount} cites
            </span>
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Abstract (if available) */}
            {displayAbstract && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <p className="text-xs text-stone-600 leading-relaxed line-clamp-4">
                  {displayAbstract}
                </p>
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {reference.arxivId && (
                <>
                  <a
                    href={`https://arxiv.org/abs/${reference.arxivId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    arXiv
                  </a>
                  
                  <a
                    href={`https://arxiv.org/pdf/${reference.arxivId}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    PDF
                  </a>
                  
                  {isLocallyAvailable && onOpenInReader && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInReader(reference.arxivId!);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                    >
                      <BookOpen className="w-3 h-3" />
                      Open
                    </button>
                  )}
                </>
              )}
              
              {s2Data?.openAccessPdf && (
                <a
                  href={s2Data.openAccessPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Open Access
                </a>
              )}
              
              {reference.doi && (
                <a
                  href={`https://doi.org/${reference.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  DOI
                </a>
              )}
              
              {reference.url && !reference.arxivId && (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Link
                </a>
              )}
            </div>
            
            {/* Loading Metadata */}
            {isLoadingMetadata && (
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading metadata...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Expand Indicator */}
      <div className="mt-2 flex items-center justify-center">
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-stone-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-stone-400" />
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  loading?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, count, loading }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
      active
        ? "bg-indigo-100 text-indigo-700"
        : "text-stone-600 hover:bg-stone-100"
    )}
  >
    {icon}
    {label}
    {loading ? (
      <Loader2 className="w-3 h-3 animate-spin" />
    ) : count !== undefined && (
      <span className={cn(
        "px-1.5 py-0.5 text-[10px] rounded-full",
        active ? "bg-indigo-200 text-indigo-800" : "bg-stone-200 text-stone-600"
      )}>
        {count}
      </span>
    )}
  </button>
);

// ============================================================================
// Main Component
// ============================================================================

export const RefsPanel: React.FC<RefsPanelProps> = ({
  paperContext,
  onOpenInReader,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("references");
  const [searchQuery, setSearchQuery] = useState("");
  
  // References state
  const [references, setReferences] = useState<ParsedReference[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);
  
  // Citations state
  const [citations, setCitations] = useState<ParsedReference[]>([]);
  const [isLoadingCitations, setIsLoadingCitations] = useState(false);
  const [citationsError, setCitationsError] = useState<string | null>(null);
  const [citationsFetched, setCitationsFetched] = useState(false);
  
  // Metadata state
  const [metadataMap, setMetadataMap] = useState<Map<string, ArxivMetadata>>(new Map());
  const [loadingMetadata, setLoadingMetadata] = useState<Set<string>>(new Set());
  
  // Get arXiv ID from paper context
  const arxivId = useMemo(() => {
    if (!paperContext) return null;
    // Try to extract from source.arxivId
    const id = paperContext.source?.arxivId || "";
    // Already looks like arXiv ID (e.g., 2301.12345v1)
    if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(id)) {
      return id;
    }
    return id || null;
  }, [paperContext]);
  
  // Load references
  useEffect(() => {
    if (!paperContext) return;
    
    setIsLoadingRefs(true);
    setRefsError(null);
    
    getReferences(arxivId || "", paperContext.markdown)
      .then(refs => {
        setReferences(refs);
        console.log(`[RefsPanel] Loaded ${refs.length} references`);
      })
      .catch(err => {
        console.error("[RefsPanel] Failed to load references:", err);
        setRefsError("Failed to load references");
      })
      .finally(() => {
        setIsLoadingRefs(false);
      });
  }, [paperContext, arxivId]);
  
  // Load citations when tab is switched (lazy load)
  useEffect(() => {
    if (activeTab !== "citations" || !arxivId || citationsFetched) return;
    
    setIsLoadingCitations(true);
    setCitationsError(null);
    
    getCitations(arxivId)
      .then(cites => {
        setCitations(cites);
        setCitationsFetched(true);
        console.log(`[RefsPanel] Loaded ${cites.length} citations`);
      })
      .catch(err => {
        console.error("[RefsPanel] Failed to load citations:", err);
        setCitationsError("Failed to load citations");
      })
      .finally(() => {
        setIsLoadingCitations(false);
      });
  }, [activeTab, arxivId, citationsFetched]);
  
  // Refresh citations
  const handleRefreshCitations = useCallback(() => {
    if (!arxivId) return;
    setCitationsFetched(false);
  }, [arxivId]);
  
  // Fetch metadata for visible arXiv references
  const fetchMetadataForRef = useCallback(async (ref: ParsedReference) => {
    if (!ref.arxivId || metadataMap.has(ref.arxivId) || loadingMetadata.has(ref.arxivId)) {
      return;
    }
    
    setLoadingMetadata(prev => new Set(prev).add(ref.arxivId!));
    
    try {
      const metadata = await getArxivMetadata(ref.arxivId);
      if (metadata) {
        setMetadataMap(prev => new Map(prev).set(ref.arxivId!, metadata));
      }
    } finally {
      setLoadingMetadata(prev => {
        const newSet = new Set(prev);
        newSet.delete(ref.arxivId!);
        return newSet;
      });
    }
  }, [metadataMap, loadingMetadata]);
  
  // Current data based on active tab
  const currentData = activeTab === "references" ? references : citations;
  const isLoading = activeTab === "references" ? isLoadingRefs : isLoadingCitations;
  const error = activeTab === "references" ? refsError : citationsError;
  
  // Filter by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return currentData;
    
    const query = searchQuery.toLowerCase();
    return currentData.filter(ref => {
      const metadata = ref.arxivId ? metadataMap.get(ref.arxivId) : null;
      return (
        ref.rawText?.toLowerCase().includes(query) ||
        ref.title?.toLowerCase().includes(query) ||
        ref.authors?.some(a => a.toLowerCase().includes(query)) ||
        ref.arxivId?.toLowerCase().includes(query) ||
        ref.venue?.toLowerCase().includes(query) ||
        metadata?.title.toLowerCase().includes(query) ||
        metadata?.authors.some(a => a.toLowerCase().includes(query))
      );
    });
  }, [currentData, searchQuery, metadataMap]);
  
  // Stats
  const stats = useMemo(() => {
    const data = currentData;
    return {
      total: data.length,
      withArxiv: data.filter(r => r.arxivId).length,
      locallyAvailable: data.filter(r => r.isLocallyAvailable).length,
      fromS2: data.filter(r => r._s2Data && !r.arxivId).length,
    };
  }, [currentData]);
  
  if (!paperContext) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-stone-500">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No paper loaded</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 space-y-3">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <TabButton
            active={activeTab === "references"}
            onClick={() => setActiveTab("references")}
            icon={<Quote className="w-4 h-4" />}
            label="References"
            count={references.length}
            loading={isLoadingRefs}
          />
          <TabButton
            active={activeTab === "citations"}
            onClick={() => setActiveTab("citations")}
            icon={<ArrowUpRight className="w-4 h-4" />}
            label="Citations"
            count={citationsFetched ? citations.length : undefined}
            loading={isLoadingCitations}
          />
          
          {activeTab === "citations" && citationsFetched && (
            <button
              onClick={handleRefreshCitations}
              className="ml-auto p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
              title="Refresh citations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-stone-100 rounded-lg border border-transparent focus:border-indigo-300 focus:bg-white focus:outline-none transition-colors"
          />
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
          <span>{stats.total} {activeTab}</span>
          {stats.withArxiv > 0 && (
            <span className="text-indigo-600">{stats.withArxiv} arXiv</span>
          )}
          {stats.fromS2 > 0 && (
            <span className="text-sky-600">{stats.fromS2} S2</span>
          )}
          {stats.locallyAvailable > 0 && (
            <span className="text-emerald-600">{stats.locallyAvailable} local</span>
          )}
        </div>
        
        {/* S2 Attribution */}
        {activeTab === "citations" && (
          <div className="text-[10px] text-stone-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Powered by Semantic Scholar API
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto mb-2" />
              <p className="text-xs text-stone-500">Loading {activeTab}...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => activeTab === "citations" ? handleRefreshCitations() : window.location.reload()}
              className="mt-2 text-xs text-indigo-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            <p className="text-sm">
              {searchQuery
                ? `No matching ${activeTab}`
                : activeTab === "citations"
                ? "No citations found via Semantic Scholar"
                : "No references found"}
            </p>
            {activeTab === "references" && !searchQuery && (
              <p className="text-xs mt-2 text-stone-400">
                References are extracted from the paper&apos;s text or fetched from Semantic Scholar.
              </p>
            )}
          </div>
        ) : (
          filteredData.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              metadata={ref.arxivId ? metadataMap.get(ref.arxivId) || null : null}
              isLoadingMetadata={ref.arxivId ? loadingMetadata.has(ref.arxivId) : false}
              isLocallyAvailable={ref.isLocallyAvailable || false}
              onOpenInReader={onOpenInReader}
              onHover={(r) => r && fetchMetadataForRef(r)}
              isCitation={activeTab === "citations"}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RefsPanel;
