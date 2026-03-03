"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";

// ============================================================
// Props
// ============================================================

interface TemplateSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  debounceMs?: number;
}

// ============================================================
// Component
// ============================================================

export function TemplateSearch({
  value,
  onChange,
  onSearch,
  placeholder = "Search templates...",
  isLoading = false,
  debounceMs = 300,
}: TemplateSearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Sync external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the onChange
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
        onSearch?.(newValue);
      }, debounceMs);
    },
    [onChange, onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    onSearch?.("");
    inputRef.current?.focus();
  }, [onChange, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        // Clear debounce and trigger immediately
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onChange(localValue);
        onSearch?.(localValue);
      }
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [localValue, onChange, onSearch, handleClear]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
        ) : (
          <Search className="h-4 w-4 text-slate-400" />
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2.5 
          bg-slate-800 border border-slate-700 rounded-lg
          text-sm text-white placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
          transition-all
        "
      />

      {localValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
