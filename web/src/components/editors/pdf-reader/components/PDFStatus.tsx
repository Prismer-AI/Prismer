import React from 'react';
import { Button } from '@/components/ui/button';

interface PDFStatusProps {
  loading: boolean;
  error: string;
  pdfUrl: string;
  onRetry: () => void;
}

export const PDFStatus: React.FC<PDFStatusProps> = ({ loading, error, pdfUrl, onRetry }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 w-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--main-color)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--text-2)] font-['PingFang_SC']">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("PDF loading error:", error, pdfUrl);
    return (
      <div className="flex items-center justify-center h-96 w-96">
        <div className="text-center text-[var(--destructive)]">
          <p className="font-['Source Serif'] mb-2">Loading Failed</p>
          <Button 
            onClick={onRetry}
            className="mt-4"
            size="sm"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return null;
}; 