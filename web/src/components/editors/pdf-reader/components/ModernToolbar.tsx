import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Menu,
  Tag,
  FileText,
  Network,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernToolbarProps {
  pageNumber: number;
  numPages: number;
  scale: number;
  onPageChange: (offset: number) => void;
  onZoomChange: (scale: number) => void;
  onToggleIndexPanel: () => void;
  onToggleTagPanel: () => void;
  onToggleNotesPanel: () => void;
  onToggleGraphPanel: () => void;
  className?: string;
}

export const ModernToolbar: React.FC<ModernToolbarProps> = ({
  pageNumber,
  numPages,
  scale,
  onPageChange,
  onZoomChange,
  onToggleIndexPanel,
  onToggleTagPanel,
  onToggleNotesPanel,
  onToggleGraphPanel,
  className
}) => {
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50",
      className
    )}>
      <div className="flex items-center gap-3">
        <Button
          onClick={onToggleIndexPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 rounded-xl"
        >
          <Menu className="w-4 h-4" />
        </Button>

        <div className="h-5 w-[1px] bg-gray-300" />

        <div className="flex items-center gap-1">
          <Button
            onClick={() => onPageChange(-1)}
            disabled={pageNumber <= 1}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 rounded-xl disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="px-3 py-1 text-sm text-gray-700 min-w-[4rem] text-center font-medium">
            {pageNumber} / {numPages || '?'}
          </span>
          
          <Button
            onClick={() => onPageChange(1)}
            disabled={pageNumber >= numPages}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 rounded-xl disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-5 w-[1px] bg-gray-300" />

        <div className="flex items-center gap-1">
          <Button
            onClick={() => onZoomChange(Math.max(0.5, scale - 0.1))}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 rounded-xl"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-gray-700 min-w-[3.5rem] text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            onClick={() => onZoomChange(Math.min(2.0, scale + 0.1))}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100 rounded-xl"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-5 w-[1px] bg-gray-300" />

        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 rounded-xl"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleTagPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 rounded-xl"
        >
          <Tag className="w-4 h-4" />
        </Button>

        <Button
          onClick={onToggleNotesPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 rounded-xl"
        >
          <FileText className="w-4 h-4" />
        </Button>

        <Button
          onClick={onToggleGraphPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 rounded-xl"
        >
          <Network className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}; 