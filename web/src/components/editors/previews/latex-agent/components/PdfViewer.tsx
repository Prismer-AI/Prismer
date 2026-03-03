'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface PdfViewerProps {
  dataUrl: string;
  fileUrl?: string;
  className?: string;
}

function toBlobUrl(dataUrl: string): string {
  if (!dataUrl.startsWith('data:application/pdf;base64,')) {
    throw new Error('Invalid PDF data URL');
  }
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('Missing PDF payload');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export function PdfViewer({ dataUrl, fileUrl, className = '' }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filename = useMemo(
    () => fileUrl?.split('/').pop()?.split('?')[0] || 'compiled.pdf',
    [fileUrl]
  );

  useEffect(() => {
    let nextUrl: string | null = null;
    try {
      nextUrl = toBlobUrl(dataUrl);
      setBlobUrl(nextUrl);
      setError(null);
      setLoading(false);
    } catch (err) {
      setBlobUrl(null);
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
      setLoading(false);
    }

    return () => {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [dataUrl]);

  const openInNewTab = () => {
    if (blobUrl) window.open(blobUrl, '_blank');
  };

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`flex h-full flex-col bg-slate-900 ${className}`}>
      <div className="flex items-center justify-end gap-2 border-b border-slate-700 bg-slate-800 px-2 py-1.5">
        <button
          type="button"
          onClick={openInNewTab}
          disabled={!blobUrl}
          className="rounded p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!blobUrl}
          className="rounded p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 bg-slate-950">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="mb-2 h-8 w-8 animate-spin" />
            <p className="text-sm">Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 p-6 text-red-400">
            <AlertCircle className="mb-2 h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <iframe
            title="LaTeX PDF Preview"
            src={blobUrl}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}

export default PdfViewer;
