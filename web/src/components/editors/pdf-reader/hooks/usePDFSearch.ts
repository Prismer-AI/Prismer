import { useState, useCallback, useEffect, useRef } from "react";
import { pdfjs } from "react-pdf";

interface SearchResult {
  pageNumber: number;
  textContent: string;
  position: { x: number; y: number; width: number; height: number };
  matchIndex: number;
}

interface PDFSearchParams {
  pdfUrl: string;
  currentPageNumber: number;
  onPageChange: (page: number) => void;
}

export const usePDFSearch = ({
  pdfUrl,
  onPageChange,
}: PDFSearchParams) => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const pdfDocumentRef = useRef<any>(null);
  const pageTextCacheRef = useRef<Map<number, any>>(new Map());

  // 加载PDF文档
  useEffect(() => {
    const loadPDFDocument = async () => {
      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        pdfDocumentRef.current = pdf;
      } catch (error) {
        console.error("Error loading PDF for search:", error);
      }
    };

    if (pdfUrl) {
      loadPDFDocument();
    }
  }, [pdfUrl]);

  // 获取页面文本内容
  const getPageTextContent = useCallback(async (pageNumber: number) => {
    if (!pdfDocumentRef.current) return null;

    // 检查缓存
    if (pageTextCacheRef.current.has(pageNumber)) {
      return pageTextCacheRef.current.get(pageNumber);
    }

    try {
      const page = await pdfDocumentRef.current.getPage(pageNumber);
      const textContent = await page.getTextContent({
        disableCombineTextItems: true,
        includeMarkup: false,
      });

      // 缓存文本内容
      pageTextCacheRef.current.set(pageNumber, textContent);
      return textContent;
    } catch (error) {
      console.error(
        `Error getting text content for page ${pageNumber}:`,
        error
      );
      return null;
    }
  }, []);

  // 在页面中搜索文本
  const searchInPage = useCallback(
    async (pageNumber: number, query: string): Promise<SearchResult[]> => {
      const textContent = await getPageTextContent(pageNumber);
      if (!textContent || !query.trim()) return [];

      const results: SearchResult[] = [];
      const queryLower = query.toLowerCase();

      // 将所有文本项组合成一个完整的字符串，同时记录位置信息
      let fullText = "";
      const textItems: Array<{
        str: string;
        transform: number[];
        width: number;
        height: number;
      }> = [];

      textContent.items.forEach((item: any) => {
        if (item.str) {
          textItems.push({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
          });
          fullText += item.str + " ";
        }
      });

      const fullTextLower = fullText.toLowerCase();
      let searchIndex = 0;
      let matchIndex = 0;

      while (true) {
        const foundIndex = fullTextLower.indexOf(queryLower, searchIndex);
        if (foundIndex === -1) break;

        // 计算匹配文本在原始文本中的位置
        let charCount = 0;
        let matchStartItem = -1;
        let matchEndItem = -1;

        // 找到匹配开始的文本项
        for (let i = 0; i < textItems.length; i++) {
          const nextCharCount = charCount + textItems[i].str.length + 1; // +1 for space
          if (charCount <= foundIndex && foundIndex < nextCharCount) {
            matchStartItem = i;
            break;
          }
          charCount = nextCharCount;
        }

        // 找到匹配结束的文本项
        charCount = 0;
        for (let i = 0; i < textItems.length; i++) {
          const nextCharCount = charCount + textItems[i].str.length + 1;
          if (
            charCount <= foundIndex + query.length &&
            foundIndex + query.length <= nextCharCount
          ) {
            matchEndItem = i;
            break;
          }
          charCount = nextCharCount;
        }

        if (matchStartItem !== -1) {
          const startItem = textItems[matchStartItem];
          const endItem = textItems[matchEndItem] || startItem;

          // 计算位置（基于PDF坐标系）
          const x = startItem.transform[4];
          const y = startItem.transform[5];
          const width = endItem.transform[4] + endItem.width - x;
          const height = Math.max(startItem.height, endItem.height);

          results.push({
            pageNumber,
            textContent: query,
            position: { x, y, width, height },
            matchIndex,
          });

          matchIndex++;
        }

        searchIndex = foundIndex + 1;
      }

      return results;
    },
    [getPageTextContent]
  );

  // 搜索整个PDF
  const searchPDF = useCallback(
    async (query: string) => {
      if (!pdfDocumentRef.current || !query.trim()) {
        setSearchResults([]);
        setCurrentResultIndex(0);
        return;
      }

      setIsSearching(true);
      const allResults: SearchResult[] = [];

      try {
        const numPages = pdfDocumentRef.current.numPages;

        // 搜索所有页面
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const pageResults = await searchInPage(pageNum, query);
          allResults.push(...pageResults);
        }

        setSearchResults(allResults);
        setCurrentResultIndex(0);

        // 如果有结果，跳转到第一个结果
        if (allResults.length > 0) {
          onPageChange(allResults[0].pageNumber);
        }
      } catch (error) {
        console.error("Error searching PDF:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchInPage, onPageChange]
  );

  // 导航到搜索结果
  const navigateResult = useCallback(
    (direction: "prev" | "next") => {
      if (searchResults.length === 0) return;

      let newIndex = currentResultIndex;
      if (direction === "next") {
        newIndex = (currentResultIndex + 1) % searchResults.length;
      } else {
        newIndex =
          currentResultIndex === 0
            ? searchResults.length - 1
            : currentResultIndex - 1;
      }

      setCurrentResultIndex(newIndex);
      const result = searchResults[newIndex];
      if (result) {
        onPageChange(result.pageNumber);
      }
    },
    [searchResults, currentResultIndex, onPageChange]
  );

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setCurrentResultIndex(0);
  }, []);

  // 切换搜索框可见性
  const toggleSearchVisibility = useCallback(() => {
    setIsSearchVisible((prev) => !prev);
    if (isSearchVisible) {
      clearSearch();
    }
  }, [isSearchVisible, clearSearch]);

  // 处理搜索快捷键
  const handleSearchShortcut = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setIsSearchVisible(true);
        return;
      }

      // 只有在搜索框可见且有搜索结果时才处理导航快捷键
      if (!isSearchVisible || searchResults.length === 0) return;

      // [ 或 < 上一个结果
      if (e.key === "[" || e.key === "<") {
        e.preventDefault();
        navigateResult("prev");
      }
      // ] 或 > 下一个结果
      else if (e.key === "]" || e.key === ">") {
        e.preventDefault();
        navigateResult("next");
      }
      // Escape 关闭搜索
      else if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchVisible(false);
        clearSearch();
      }
    },
    [isSearchVisible, searchResults.length, navigateResult, clearSearch]
  );

  // 添加键盘事件监听
  useEffect(() => {
    window.addEventListener("keydown", handleSearchShortcut);
    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, [handleSearchShortcut]);

  return {
    searchResults,
    currentResultIndex,
    isSearchVisible,
    isSearching,
    searchPDF,
    navigateResult,
    clearSearch,
    toggleSearchVisibility,
    getCurrentSearchResult: () => searchResults[currentResultIndex] || null,
  };
};
