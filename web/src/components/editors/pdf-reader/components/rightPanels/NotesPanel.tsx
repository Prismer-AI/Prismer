/**
 * NotesPanel - Placeholder for notes functionality in PDF reader right panel
 *
 * Provides a simple rich-text notes editor that can be used alongside the PDF reader.
 */

"use client";

import React, { forwardRef, useImperativeHandle, useState, useCallback } from 'react';

export interface NotesPanelRef {
  insertContent: (content: string, type?: 'text' | 'quote') => void;
}

interface NotesPanelProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onInsertContent?: (content: string) => void;
}

export const NotesPanel = forwardRef<NotesPanelRef, NotesPanelProps>(
  ({ initialValue = '', onChange, onInsertContent }, ref) => {
    const [value, setValue] = useState(initialValue);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange?.(newValue);
      },
      [onChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        insertContent: (content: string, type: 'text' | 'quote' = 'text') => {
          const formatted = type === 'quote' ? `> ${content}\n\n` : `${content}\n`;
          setValue((prev) => {
            const newValue = prev + formatted;
            onChange?.(newValue);
            return newValue;
          });
          onInsertContent?.(content);
        },
      }),
      [onChange, onInsertContent]
    );

    return (
      <div className="flex flex-col h-full p-4">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder="Write your notes here..."
          className="flex-1 w-full resize-none bg-transparent text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none"
        />
      </div>
    );
  }
);

NotesPanel.displayName = 'NotesPanel';
