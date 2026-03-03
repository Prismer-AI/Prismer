'use client';

/**
 * ArtifactPreviewCard
 *
 * Renders an artifact reference inline in a chat message.
 * Shows file icon, name, preview, and "Open in WindowView" action.
 *
 * Design ref: WINDOWVIEW_DESIGN.md §3.3
 */

import React, { memo, useCallback } from 'react';
import {
  FileText,
  FileCode2,
  Table2,
  ImageIcon,
  Box,
  BookOpen,
  FunctionSquare,
  Code2,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtifactRef, ArtifactType } from '@/types/message';
import { ARTIFACT_COMPONENT_MAP } from '@/types/message';
import { useComponentStore } from '../../stores/componentStore';

// ============================================================
// Type icon & label mapping
// ============================================================

const ARTIFACT_ICONS: Record<ArtifactType, LucideIcon> = {
  notebook: FileCode2,
  latex: FunctionSquare,
  code: Code2,
  data: Table2,
  pdf: FileText,
  notes: BookOpen,
  image: ImageIcon,
  model3d: Box,
};

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  notebook: 'Jupyter Notebook',
  latex: 'LaTeX Document',
  code: 'Source Code',
  data: 'Dataset',
  pdf: 'PDF Document',
  notes: 'Notes',
  image: 'Image',
  model3d: '3D Model',
};

const ARTIFACT_COLORS: Record<ArtifactType, string> = {
  notebook: 'text-orange-600 bg-orange-50 border-orange-200',
  latex: 'text-teal-600 bg-teal-50 border-teal-200',
  code: 'text-amber-600 bg-amber-50 border-amber-200',
  data: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  pdf: 'text-rose-600 bg-rose-50 border-rose-200',
  notes: 'text-violet-600 bg-violet-50 border-violet-200',
  image: 'text-pink-600 bg-pink-50 border-pink-200',
  model3d: 'text-blue-600 bg-blue-50 border-blue-200',
};

// ============================================================
// Component
// ============================================================

interface ArtifactPreviewCardProps {
  artifact: ArtifactRef;
}

export const ArtifactPreviewCard = memo(function ArtifactPreviewCard({
  artifact,
}: ArtifactPreviewCardProps) {
  const setActiveComponent = useComponentStore((s) => s.setActiveComponent);

  const handleOpenInWindowView = useCallback(() => {
    const targetComponent = ARTIFACT_COMPONENT_MAP[artifact.type];
    if (targetComponent) {
      setActiveComponent(targetComponent);
    }
  }, [artifact.type, setActiveComponent]);

  const Icon = ARTIFACT_ICONS[artifact.type];
  const typeLabel = ARTIFACT_LABELS[artifact.type];
  const colorClass = ARTIFACT_COLORS[artifact.type];

  return (
    <div className={`rounded-xl border overflow-hidden ${colorClass} transition-all hover:shadow-sm`}>
      {/* Header: icon + filename + version */}
      <div className="flex items-center gap-2 px-3 py-2">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        <span className="text-xs font-medium truncate flex-1">
          {artifact.name}
        </span>
        {artifact.version && (
          <span className="text-[10px] font-mono opacity-70 flex-shrink-0">
            {artifact.version}
          </span>
        )}
      </div>

      {/* Preview area */}
      {artifact.previewUrl && artifact.type === 'image' && (
        <div className="px-3 pb-2">
          <div className="rounded-lg overflow-hidden bg-white/60">
            <img
              src={artifact.previewUrl}
              alt={artifact.name}
              className="w-full h-auto max-h-[160px] object-contain"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {artifact.previewText && (
        <div className="px-3 pb-2">
          <pre className="text-[10px] leading-tight font-mono opacity-70 max-h-[80px] overflow-hidden whitespace-pre-wrap">
            {artifact.previewText}
          </pre>
        </div>
      )}

      {/* Description + meta */}
      {(artifact.description || artifact.size) && (
        <div className="px-3 pb-2">
          {artifact.description && (
            <p className="text-[11px] opacity-70 line-clamp-2">
              {artifact.description}
            </p>
          )}
          {artifact.size && (
            <span className="text-[10px] opacity-50">{artifact.size}</span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-current/10 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] opacity-50">{typeLabel}</span>
        <button
          type="button"
          onClick={handleOpenInWindowView}
          className="flex items-center gap-1 text-[11px] font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="w-3 h-3" />
          Open
        </button>
      </div>
    </div>
  );
});

// ============================================================
// List renderer for multiple artifacts
// ============================================================

interface ArtifactPreviewListProps {
  artifacts: ArtifactRef[];
}

export const ArtifactPreviewList = memo(function ArtifactPreviewList({
  artifacts,
}: ArtifactPreviewListProps) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 max-w-[320px]">
      {artifacts.map((artifact) => (
        <ArtifactPreviewCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
});
