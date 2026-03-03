"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Loader2,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface PaperMeta {
  id: string;
  arxivId: string;
  title: string;
  authors: string[];
  published?: string;
  abstract?: string;
  hasOCRData: boolean;
  pdfPath: string;
}

interface PaperLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPaper: (paper: PaperMeta) => void;
  /** 已打开的论文 ID 列表 */
  openPaperIds?: string[];
}

// ============================================================================
// Paper Card Component
// ============================================================================

const PaperCard: React.FC<{
  paper: PaperMeta;
  isOpen: boolean;
  onSelect: () => void;
}> = ({ paper, isOpen, onSelect }) => {
  // 格式化作者列表
  const authorsText = useMemo(() => {
    if (!paper.authors.length) return "Unknown authors";
    if (paper.authors.length <= 3) return paper.authors.join(", ");
    return `${paper.authors.slice(0, 3).join(", ")} et al.`;
  }, [paper.authors]);

  // 格式化日期
  const dateText = useMemo(() => {
    if (!paper.published) return "";
    try {
      const date = new Date(paper.published);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return paper.published;
    }
  }, [paper.published]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group p-4 rounded-xl border transition-all cursor-pointer",
        isOpen
          ? "border-indigo-300 bg-indigo-50/50"
          : "border-stone-200 bg-white hover:border-indigo-200 hover:shadow-md"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            isOpen
              ? "bg-indigo-100 text-indigo-600"
              : "bg-stone-100 text-stone-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
          )}
        >
          <FileText className="w-5 h-5" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className="font-medium text-stone-900 line-clamp-2 leading-tight">
            {paper.title}
          </h3>

          {/* 作者 + 日期 */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-stone-500">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{authorsText}</span>
            </div>
            {dateText && (
              <>
                <span className="text-stone-300">•</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{dateText}</span>
                </div>
              </>
            )}
          </div>

          {/* arXiv ID + OCR 状态 */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
              {paper.arxivId}
            </span>
            {paper.hasOCRData && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                <Sparkles className="w-3 h-3" />
                AI Ready
              </span>
            )}
            {isOpen && (
              <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" />
                Open
              </span>
            )}
          </div>

          {/* 摘要预览 */}
          {paper.abstract && (
            <p className="mt-2 text-xs text-stone-500 line-clamp-2">
              {paper.abstract}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const PaperLibraryDialog: React.FC<PaperLibraryDialogProps> = ({
  isOpen,
  onClose,
  onSelectPaper,
  openPaperIds = [],
}) => {
  const [papers, setPapers] = useState<PaperMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 加载论文列表
  const loadPapers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/papers");
      if (!response.ok) {
        throw new Error("Failed to fetch papers");
      }
      const data = await response.json();
      setPapers(data.papers || []);
    } catch (e) {
      console.error("Failed to load papers:", e);
      setError("Failed to load paper library");
    } finally {
      setLoading(false);
    }
  }, []);

  // 当对话框打开时加载论文
  useEffect(() => {
    if (isOpen) {
      loadPapers();
    }
  }, [isOpen, loadPapers]);

  // 过滤论文
  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const query = searchQuery.toLowerCase();
    return papers.filter(
      (paper) =>
        paper.title.toLowerCase().includes(query) ||
        paper.arxivId.toLowerCase().includes(query) ||
        paper.authors.some((author) => author.toLowerCase().includes(query)) ||
        paper.abstract?.toLowerCase().includes(query)
    );
  }, [papers, searchQuery]);

  // 处理选择论文
  const handleSelect = useCallback(
    (paper: PaperMeta) => {
      onSelectPaper(paper);
      onClose();
    },
    [onSelectPaper, onClose]
  );

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 对话框 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       w-[90vw] max-w-2xl max-h-[80vh] 
                       bg-white rounded-2xl shadow-2xl overflow-hidden
                       flex flex-col"
          >
            {/* 头部 */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-stone-900">
                    Paper Library
                  </h2>
                  <span className="text-sm text-stone-500">
                    ({papers.length} papers)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-stone-500 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author, or arXiv ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl
                           text-sm placeholder-stone-400 focus:outline-none focus:ring-2 
                           focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* 论文列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    onClick={loadPapers}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <FileText className="w-12 h-12 mb-2 text-stone-300" />
                  <p>
                    {searchQuery ? "No papers match your search" : "No papers available"}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredPapers.map((paper) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      isOpen={openPaperIds.includes(paper.id)}
                      onSelect={() => handleSelect(paper)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* 底部提示 */}
            <div className="flex-shrink-0 px-6 py-3 border-t border-stone-200 bg-stone-50">
              <p className="text-xs text-stone-500 text-center">
                Click a paper to open it in the reader • Papers with{" "}
                <span className="text-emerald-600">AI Ready</span> tag have OCR data for enhanced features
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PaperLibraryDialog;
