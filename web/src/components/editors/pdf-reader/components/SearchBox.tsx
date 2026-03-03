import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
  searchResults: Array<{
    pageNumber: number;
    textContent: string;
    position: { x: number; y: number; width: number; height: number };
  }>;
  currentResultIndex: number;
  onNavigateResult: (direction: 'prev' | 'next') => void;
  onClearSearch: () => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  onSearch,
  searchResults,
  currentResultIndex,
  onNavigateResult,
  onClearSearch,
  isVisible,
  onToggleVisibility
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the search box becomes visible, automatically focus
  useEffect(() => {
    if (isVisible && isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible, isExpanded]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onClearSearch();
    setIsExpanded(false);
  };

  const handleToggleExpanded = () => {
    if (isExpanded) {
      handleClearSearch();
    } else {
      setIsExpanded(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigateResult('prev');
      } else {
        onNavigateResult('next');
      }
    } else if (e.key === 'Escape') {
      handleClearSearch();
    }
  };

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleVisibility}
        className="hover:bg-[var(--bg-box-nor)]"
        title="Search (Ctrl+F)"
      >
        <Search className="w-4 h-4 text-[var(--text-2)]" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {!isExpanded ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleExpanded}
          className="hover:bg-[var(--bg-box-nor)]"
          title="Search"
        >
          <Search className="w-4 h-4 text-[var(--text-2)]" />
        </Button>
      ) : (
        <>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[var(--text-3)] absolute left-2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search PDF Content..."
              className="pl-8 pr-8 py-1 w-48 text-sm bg-[var(--bg-box-nor)] border border-[var(--stroke-nor)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)] focus:border-transparent text-[var(--text-1)] placeholder-[var(--text-3)] transition-all duration-200"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSearch}
                className="absolute right-1 w-6 h-6 hover:bg-[var(--bg-main)]"
                title="Empty Search"
              >
                <X className="w-3 h-3 text-[var(--text-3)]" />
              </Button>
            )}
          </div>

          {searchResults.length > 0 && (
            <>
              <div className="flex items-center gap-1 text-xs text-[var(--text-3)]">
                <span className="min-w-[3rem] text-center">
                  {currentResultIndex + 1} / {searchResults.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigateResult('prev')}
                  disabled={searchResults.length === 0}
                  className="w-6 h-6 hover:bg-[var(--bg-box-nor)]"
                  title="Previous result ([or<)"
                >
                  <ChevronUp className="w-3 h-3 text-[var(--text-2)]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNavigateResult('next')}
                  disabled={searchResults.length === 0}
                  className="w-6 h-6 hover:bg-[var(--bg-box-nor)]"
                  title="Next result (]or>)"
                >
                  <ChevronDown className="w-3 h-3 text-[var(--text-2)]" />
                </Button>
              </div>
            </>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="text-xs text-[var(--text-3)] px-2">
              No results found
            </div>
          )}
        </>
      )}

      <div className="h-6 w-px bg-[var(--stroke-nor)]" />
    </div>
  );
}; 