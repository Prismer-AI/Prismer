"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ComponentPreviewProps } from "@/components/playground/registry";
import { createPDFSource, type PDFSource } from "@/types/paperContext";
import { useComponentStore } from "@/app/workspace/stores/componentStore";

// Dynamically import PDFReaderWrapper for multi-document support
const PDFReaderWrapper = dynamic(
  () => import("@/components/editors/pdf-reader/PDFReaderWrapper"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-stone-100">
        <div className="flex items-center gap-3 text-stone-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-indigo-500" />
          <span>Loading PDF Reader...</span>
        </div>
      </div>
    ),
  }
);

// Legacy mapping for demo documents
// Use papers that exist in local OCR data (/public/data/output/)
const legacyDocumentSources: Record<string, () => PDFSource> = {
  'library/vla-rail.pdf': () => createPDFSource.fromArxiv("2512.25072v1"),
  'default': () => createPDFSource.fromArxiv("2512.25072v1"),
};

/**
 * Resolve documentId to PDFSource with smart type detection.
 *
 * Supports:
 * - URL: starts with http:// or https://
 * - Upload asset: starts with "upload_" (from /api/v2/assets/upload Library mode)
 * - File path: starts with / or contains path separators
 * - arXiv ID: default (e.g., "2512.25072v1")
 */
function getPDFSource(documentId: string | undefined): PDFSource {
  if (!documentId) {
    return legacyDocumentSources['default']();
  }

  // Legacy demo documents
  if (legacyDocumentSources[documentId]) {
    return legacyDocumentSources[documentId]();
  }

  // 1. URL: direct PDF link
  if (documentId.startsWith('http://') || documentId.startsWith('https://')) {
    return createPDFSource.fromUrl(documentId);
  }

  // 2. Upload source ID (from asset upload Library mode)
  //    Pass as arxivId so PaperContextProvider can load OCR data via /api/ocr/{id}/
  if (documentId.startsWith('upload_')) {
    return createPDFSource.fromUrl(`/api/ocr/${documentId}/pdf`, documentId);
  }

  // 3. File path (container path or local path)
  if (documentId.startsWith('/') || documentId.startsWith('./')) {
    return createPDFSource.fromFile(documentId);
  }

  // 4. Default: arXiv ID format (e.g., "2512.25072v1")
  return createPDFSource.fromArxiv(documentId);
}

// ============================================================
// Component
// ============================================================

export default function PDFReaderPreview({}: ComponentPreviewProps) {
  // Read document ID from workspace component store
  const documentId = useComponentStore(
    (s) => s.componentStates['pdf-reader']?.documentId
  );

  // Get PDF source based on document ID
  const initialSource: PDFSource = useMemo(() => {
    return getPDFSource(documentId);
  }, [documentId]);

  const handleClose = () => {
    console.log("[Playground] PDF Reader close requested");
  };

  return (
    <div className="relative w-full h-full bg-white overflow-hidden">
      <PDFReaderWrapper
        initialSource={initialSource}
        onClose={handleClose}
      />
    </div>
  );
}
