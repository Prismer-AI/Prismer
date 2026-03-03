import React from 'react';

interface SearchResult {
  pageNumber: number;
  textContent: string;
  position: { x: number; y: number; width: number; height: number };
  matchIndex: number;
}

interface SearchHighlightProps {
  searchResults: SearchResult[];
  currentResultIndex: number;
  pageNumber: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({
  searchResults,
  currentResultIndex,
  pageNumber,
  scale,
  pageWidth,
  pageHeight
}) => {
  // 过滤出当前页面的搜索结果
  const currentPageResults = searchResults.filter(result => result.pageNumber === pageNumber);
  
  if (currentPageResults.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {currentPageResults.map((result, index) => {
        const isCurrentResult = searchResults.indexOf(result) === currentResultIndex;
        
        // 将PDF坐标转换为页面坐标
        // PDF.js的坐标系原点在左下角，需要转换为页面坐标系（原点在左上角）
        // result.position 中的坐标是PDF的原始坐标（以PDF单位为基础）
        // 需要应用缩放并转换坐标系
        const x = result.position.x * scale;
        const y = (pageHeight - result.position.y - result.position.height) * scale;
        const width = Math.max(result.position.width * scale, 10); // 最小宽度确保可见
        const height = Math.max(result.position.height * scale, 15); // 最小高度确保可见

        return (
          <div
            key={`search-${result.matchIndex}-${index}`}
            className={`absolute rounded-sm transition-all duration-200 ${
              isCurrentResult
                ? 'bg-orange-400/60 ring-2 ring-orange-500 ring-offset-1'
                : 'bg-yellow-300/50'
            }`}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
              // 确保高亮显示在文本上方
              zIndex: 10
            }}
            title={`Search result: ${result.textContent}`}
          />
        );
      })}
    </div>
  );
}; 