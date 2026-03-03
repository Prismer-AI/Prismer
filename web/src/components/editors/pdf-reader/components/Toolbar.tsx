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

interface ToolbarProps {
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

export const Toolbar: React.FC<ToolbarProps> = ({
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
      "flex items-center justify-between gap-4 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm",
      className
    )}>
      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleIndexPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <Menu className="w-4 h-4" />
        </Button>

        <div className="h-4 w-[1px] bg-gray-200" />

        <div className="flex items-center gap-1">
          <Button
            onClick={() => onPageChange(-1)}
            disabled={pageNumber <= 1}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="px-2 py-1 text-sm text-gray-600 min-w-[4rem] text-center">
            {pageNumber} / {numPages || '?'}
          </span>
          
          <Button
            onClick={() => onPageChange(1)}
            disabled={pageNumber >= numPages}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-4 w-[1px] bg-gray-200" />

        <div className="flex items-center gap-1">
          <Button
            onClick={() => onZoomChange(Math.max(0.5, scale - 0.1))}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-gray-600 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            onClick={() => onZoomChange(Math.min(2.0, scale + 0.1))}
            variant="ghost"
            size="sm"
            className="hover:bg-gray-100"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-4 w-[1px] bg-gray-200" />

        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleTagPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <Tag className="w-4 h-4" />
        </Button>

        <Button
          onClick={onToggleNotesPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <FileText className="w-4 h-4" />
        </Button>

        <Button
          onClick={onToggleGraphPanel}
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100"
        >
          <Network className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}; 