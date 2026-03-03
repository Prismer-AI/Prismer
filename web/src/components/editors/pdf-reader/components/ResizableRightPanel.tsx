import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResizableRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  className?: string;
}

export const ResizableRightPanel: React.FC<ResizableRightPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onWidthChange,
  minWidth = 320,
  maxWidth = 600,
  defaultWidth = 380,
  className
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
      setWidth(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, minWidth, maxWidth, onWidthChange]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ x: width, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: width, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            opacity: { duration: 0.2 }
          }}
          className={cn(
            "flex-shrink-0 h-full bg-[#faf8f5] backdrop-blur-md shadow-xl z-40 border-l border-[#e5e2dd]",
            className
          )}
          style={{ width: `${width}px` }}
        >
          {/* Resize Handle */}
          <div
            className={cn(
              "absolute left-0 top-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-[var(--main-color)] transition-colors",
              "flex items-center justify-center group",
              isResizing && "bg-[var(--main-color)]"
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-12 bg-[var(--stroke-nor)] group-hover:bg-[var(--main-color)] transition-colors rounded-full" />
          </div>

          {/* Panel Content */}
          <div className="h-full flex flex-col pl-2">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--stroke-nor)]">
              <h2 className="text-lg font-['Source Serif'] text-[var(--text-1)]">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[var(--bg-box-nor)] rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-3)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-auto font-['PingFang_SC'] text-[var(--text-2)]">
              {children}
            </div>
          </div>

          {/* Resize cursor overlay */}
          {isResizing && (
            <div className="fixed inset-0 cursor-col-resize z-50" />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 