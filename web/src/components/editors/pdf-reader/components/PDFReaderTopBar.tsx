"use client";

import React, { useCallback } from "react";
import {
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Library,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DocumentTabs, OpenDocument } from "./DocumentTabs";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface PDFReaderTopBarProps {
  /** 已打开的文档列表 */
  documents: OpenDocument[];
  /** 当前活动文档 ID */
  activeDocumentId: string | null;
  /** 当前活动文档的 arxiv ID (用于 Save to Assets) */
  currentArxivId?: string;
  /** 当前活动文档的标题 */
  currentTitle?: string;
  /** 切换文档回调 */
  onSelectDocument: (id: string) => void;
  /** 关闭文档回调 */
  onCloseDocument: (id: string) => void;
  /** 添加新文档回调 */
  onAddDocument: () => void;
  /** 从 Assets 添加文档回调 */
  onAddFromAssets?: () => void;
  /** 最小化阅读器回调 (回到 Library 主页) */
  onMinimize: () => void;
  /** 左边栏状态 */
  isLeftPanelOpen: boolean;
  /** 切换左边栏 */
  onToggleLeftPanel: () => void;
  /** 右边栏状态 */
  isRightPanelOpen: boolean;
  /** 切换右边栏 */
  onToggleRightPanel: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const PDFReaderTopBar: React.FC<PDFReaderTopBarProps> = ({
  documents,
  activeDocumentId,
  currentArxivId,
  onSelectDocument,
  onCloseDocument,
  onAddDocument,
  onAddFromAssets,
  onMinimize,
  isLeftPanelOpen,
  onToggleLeftPanel,
  isRightPanelOpen,
  onToggleRightPanel,
}) => {
  const handleSaveToAssets = useCallback(() => {
    if (!currentArxivId) {
      toast.error("Cannot save: no document ID available");
      return;
    }
    toast.info("Assets module is not included in workspace-only open-source mode.");
  }, [currentArxivId]);

  return (
    <TooltipProvider>
      <div className="pdf-reader-topbar flex items-center justify-between px-3 py-2 
                      bg-white rounded-xl shadow-sm border border-stone-200/80">
        {/* 左侧：最小化按钮 + 左边栏切换 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMinimize}
                className="p-2 rounded-lg hover:bg-amber-100 transition-colors text-stone-600 hover:text-amber-700"
              >
                <Minus className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Minimize to sidebar (Esc)</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="w-px h-6 bg-stone-200" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleLeftPanel}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isLeftPanelOpen
                    ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                    : "hover:bg-stone-100 text-stone-600 hover:text-stone-800"
                )}
              >
                {isLeftPanelOpen ? (
                  <PanelLeftClose className="w-5 h-5" />
                ) : (
                  <PanelLeftOpen className="w-5 h-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isLeftPanelOpen ? "Hide left panel" : "Show left panel"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 中间：文档标签页 */}
        <div className="flex-1 mx-4 overflow-hidden">
          <DocumentTabs
            documents={documents}
            activeDocumentId={activeDocumentId}
            onSelectDocument={onSelectDocument}
            onCloseDocument={onCloseDocument}
            onAddDocument={onAddDocument}
            onAddFromAssets={onAddFromAssets}
          />
        </div>

        {/* 右侧：Save to Assets + 右边栏切换 */}
        <div className="flex items-center gap-2">
          {/* Save to Assets Button */}
          {currentArxivId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSaveToAssets}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    "hover:bg-blue-100 text-stone-600 hover:text-blue-600",
                    "disabled:cursor-not-allowed"
                  )}
                >
                  <Library className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Save to Assets (disabled in open-source mode)</p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-6 bg-stone-200" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleRightPanel}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isRightPanelOpen
                    ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                    : "hover:bg-stone-100 text-stone-600 hover:text-stone-800"
                )}
              >
                {isRightPanelOpen ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isRightPanelOpen ? "Hide panel" : "Show panel"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PDFReaderTopBar;
