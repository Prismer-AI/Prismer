'use client';

/**
 * OutputArea - 渲染 Cell 输出
 * 支持多种输出类型：stream, execute_result, display_data, error
 * 
 * 富输出支持：
 * - 图片（PNG, JPEG, SVG）懒加载
 * - DataFrame（HTML 表格，可交互）
 * - Plotly 图表（动态加载）
 * - HTML（DOMPurify 安全过滤）
 */

import React, { useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronUp, Maximize2, Download, Copy, Check } from 'lucide-react';
import type { Output, StreamOutput, ExecuteResultOutput, DisplayDataOutput, ErrorOutput } from '../types';

// 动态加载 Plotly 组件（避免 SSR 问题）
const PlotlyRenderer = dynamic(() => import('./PlotlyRenderer'), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-8 flex items-center justify-center text-stone-500">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
      Loading chart...
    </div>
  ),
});

interface OutputAreaProps {
  outputs: Output[];
  executionCount: number | null;
  isExecuting?: boolean;
  collapseThreshold?: number; // 超过此高度自动折叠
}

/**
 * OutputArea - 优化后的输出区域
 * 
 * 策略：
 * 1. 短输出（< 200px）：直接展示，无滚动
 * 2. 中等输出（200-800px）：直接展示，无内部滚动
 * 3. 长输出（> 800px）：默认折叠，展开后也无内部滚动（让外层滚动）
 */
export function OutputArea({ 
  outputs, 
  executionCount, 
  isExecuting, 
  collapseThreshold = 800 
}: OutputAreaProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // 测量内容高度
  React.useEffect(() => {
    if (contentRef.current && outputs.length > 0) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      // 超过阈值自动折叠
      if (height > collapseThreshold && !isCollapsed) {
        setIsCollapsed(true);
      }
    }
  }, [outputs, collapseThreshold, isCollapsed]);

  if (outputs.length === 0 && !isExecuting) {
    return null;
  }

  const hasRichOutput = outputs.some(o => 
    o.type === 'execute_result' || o.type === 'display_data'
  );

  // 预览高度（折叠时显示）
  const previewHeight = 200;

  return (
    <div className="border-t border-stone-200 bg-stone-50">
      {/* Output Header */}
      {outputs.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1 bg-stone-100 border-b border-stone-200">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>Output</span>
            {outputs.length > 1 && <span className="text-stone-400">({outputs.length})</span>}
            {contentHeight > collapseThreshold && (
              <span className="text-stone-400 ml-1">
                ({Math.round(contentHeight)}px)
              </span>
            )}
          </button>
          <div className="flex items-center gap-1">
            {contentHeight > collapseThreshold && isExpanded && (
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-2 py-0.5 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-200/60 rounded"
              >
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            )}
            {hasRichOutput && (
              <button className="p-1 hover:bg-stone-200/60 rounded text-stone-500 hover:text-stone-700" title="Fullscreen">
                <Maximize2 size={12} />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Output Content - 无内部滚动 */}
      {isExpanded && (
        <div className="relative">
          {isExecuting && outputs.length === 0 && (
            <div className="px-4 py-2 text-stone-500 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Running...
            </div>
          )}
          
          {isCollapsed ? (
            // 折叠预览模式
            <>
              <div 
                className="overflow-hidden relative"
                style={{ maxHeight: previewHeight }}
              >
                <div ref={contentRef}>
                  {outputs.map((output, index) => (
                    <OutputRenderer key={index} output={output} />
                  ))}
                </div>
                {/* 渐变遮罩 */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-stone-50 to-transparent pointer-events-none" />
              </div>
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-full py-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
              >
                Show full output ({contentHeight}px)
              </button>
            </>
          ) : (
            // 展开模式 - 无 overflow
            <div ref={contentRef}>
              {outputs.map((output, index) => (
                <OutputRenderer key={index} output={output} />
              ))}
              {contentHeight > collapseThreshold && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="w-full py-2 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
                >
                  Collapse output
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OutputRendererProps {
  output: Output;
}

function OutputRenderer({ output }: OutputRendererProps) {
  switch (output.type) {
    case 'stream':
      return <StreamOutputRenderer output={output} />;
    case 'execute_result':
      return <ExecuteResultRenderer output={output} />;
    case 'display_data':
      return <DisplayDataRenderer output={output} />;
    case 'error':
      return <ErrorOutputRenderer output={output} />;
    default:
      return null;
  }
}

function StreamOutputRenderer({ output }: { output: StreamOutput }) {
  const isError = output.name === 'stderr';
  
  return (
    <pre 
      className={`px-4 py-1 text-sm font-mono whitespace-pre-wrap ${
        isError ? 'text-red-600 bg-red-50' : 'text-stone-700'
      }`}
    >
      {output.text}
    </pre>
  );
}

function ExecuteResultRenderer({ output }: { output: ExecuteResultOutput }) {
  return <MimeBundleRenderer data={output.data} metadata={output.metadata} />;
}

function DisplayDataRenderer({ output }: { output: DisplayDataOutput }) {
  return <MimeBundleRenderer data={output.data} metadata={output.metadata} />;
}

function ErrorOutputRenderer({ output }: { output: ErrorOutput }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="px-4 py-2 bg-red-50">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-red-600 font-semibold text-sm flex-1">
          {output.ename}: {output.evalue}
        </div>
        <button className="text-red-600/50 hover:text-red-600">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {isExpanded && output.traceback.length > 0 && (
        <pre className="text-red-500 text-xs font-mono mt-2 whitespace-pre-wrap max-h-[300px] overflow-auto">
          {output.traceback.map((line, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }} />
          ))}
        </pre>
      )}
    </div>
  );
}

interface MimeBundleRendererProps {
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function MimeBundleRenderer({ data, metadata }: MimeBundleRendererProps) {
  // 按优先级选择最佳的 MIME 类型渲染
  const mimePreference = [
    'application/vnd.plotly.v1+json',
    'text/html',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'text/latex',
    'text/markdown',
    'application/json',
    'text/plain',
  ];

  for (const mime of mimePreference) {
    if (data[mime] !== undefined) {
      return <MimeRenderer mime={mime} content={data[mime]} metadata={metadata} />;
    }
  }

  // 回退到 text/plain
  if (data['text/plain']) {
    return <MimeRenderer mime="text/plain" content={data['text/plain']} />;
  }

  return null;
}

interface MimeRendererProps {
  mime: string;
  content: unknown;
  metadata?: Record<string, unknown>;
}

function MimeRenderer({ mime, content, metadata }: MimeRendererProps) {
  switch (mime) {
    case 'text/plain':
      return <TextPlainRenderer content={content} />;
    case 'text/html':
      return <HtmlRenderer content={content} />;
    case 'image/png':
    case 'image/jpeg':
      return <ImageRenderer mime={mime} content={content} metadata={metadata} />;
    case 'image/svg+xml':
      return <SvgRenderer content={content} />;
    case 'application/vnd.plotly.v1+json':
      return <PlotlyOutput data={content} />;
    case 'application/json':
      return <JsonRenderer content={content} />;
    case 'text/latex':
      return <LatexRenderer content={content} />;
    case 'text/markdown':
      return <MarkdownRenderer content={content} />;
    default:
      return <TextPlainRenderer content={JSON.stringify(content, null, 2)} />;
  }
}

// ============================================================
// 具体渲染器组件
// ============================================================

function TextPlainRenderer({ content }: { content: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = String(content);
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="group relative">
      <pre className="px-4 py-2 text-sm font-mono text-stone-700 whitespace-pre-wrap">
        {text}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 bg-stone-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-stone-600" />}
      </button>
    </div>
  );
}

function HtmlRenderer({ content }: { content: unknown }) {
  const sanitizedHtml = useMemo(() => {
    if (typeof content !== 'string') return '';
    
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'code', 'pre', 'img', 'svg', 'path',
        'style', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'caption', 'colgroup', 'col',
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'src', 'alt', 'width', 'height', 'href', 'target',
        'd', 'fill', 'stroke', 'viewBox', 'xmlns', 'colspan', 'rowspan', 'scope',
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    });
  }, [content]);

  // 检测是否是 DataFrame HTML（pandas 输出）
  const isDataFrame = typeof content === 'string' && content.includes('dataframe');

  return (
    <div 
      className={`px-4 py-2 text-sm text-stone-700 overflow-auto ${
        isDataFrame ? 'jupyter-dataframe' : 'jupyter-html-output'
      }`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

function ImageRenderer({ mime, content, metadata }: { 
  mime: string; 
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 获取图片尺寸
  const dimensions = metadata?.['image/png'] as { width?: number; height?: number } | undefined;
  
  const src = `data:${mime};base64,${content}`;

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `output.${mime.split('/')[1]}`;
    link.click();
  }, [src, mime]);

  return (
    <div className="px-4 py-2 group relative">
      {!isLoaded && (
        <div className="w-full h-32 bg-stone-200 animate-pulse rounded flex items-center justify-center">
          <span className="text-stone-500 text-sm">Loading image...</span>
        </div>
      )}
      <img 
        src={src}
        alt="Output"
        className={`max-w-full rounded cursor-pointer transition-transform ${
          isLoaded ? 'block' : 'hidden'
        } ${isExpanded ? 'max-w-none' : ''}`}
        style={dimensions ? { width: dimensions.width, height: dimensions.height } : undefined}
        onLoad={() => setIsLoaded(true)}
        onClick={() => setIsExpanded(!isExpanded)}
      />
      {isLoaded && (
        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDownload}
            className="p-1.5 bg-white/80 rounded hover:bg-stone-200"
            title="Download"
          >
            <Download size={14} className="text-stone-700" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-white/80 rounded hover:bg-stone-200"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <Maximize2 size={14} className="text-stone-700" />
          </button>
        </div>
      )}
    </div>
  );
}

function SvgRenderer({ content }: { content: unknown }) {
  const sanitizedSvg = useMemo(() => {
    return DOMPurify.sanitize(String(content), {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  }, [content]);

  return (
    <div 
      className="px-4 py-2 overflow-auto"
      dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
    />
  );
}

function PlotlyOutput({ data }: { data: unknown }) {
  return <PlotlyRenderer data={data} />;
}

function JsonRenderer({ content }: { content: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatted = JSON.stringify(content, null, 2);
  const preview = formatted.slice(0, 200);
  const needsTruncate = formatted.length > 200;

  return (
    <div className="px-4 py-2">
      <pre className="text-sm font-mono text-stone-700 whitespace-pre-wrap">
        {isExpanded ? formatted : preview}
        {needsTruncate && !isExpanded && '...'}
      </pre>
      {needsTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-indigo-600 hover:text-indigo-700 mt-1"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  );
}

function LatexRenderer({ content }: { content: unknown }) {
  // 简单的 LaTeX 渲染，后续可用 KaTeX
  return (
    <div className="px-4 py-2 text-sm text-stone-700 font-mono">
      {String(content)}
    </div>
  );
}

function MarkdownRenderer({ content }: { content: unknown }) {
  // 简单的 markdown 显示，后续可用 react-markdown
  return (
    <div className="px-4 py-2 text-sm text-stone-700 prose prose-sm max-w-none">
      {String(content)}
    </div>
  );
}

// ============================================================
// 工具函数
// ============================================================

/**
 * ANSI 转 HTML（用于错误输出和终端输出）
 * 支持基本的 ANSI 颜色代码
 */
function ansiToHtml(text: string): string {
  const colorMap: Record<string, string> = {
    '30': 'color: #4a4a4a',
    '31': 'color: #ff6b6b',
    '32': 'color: #51cf66',
    '33': 'color: #ffd43b',
    '34': 'color: #339af0',
    '35': 'color: #cc5de8',
    '36': 'color: #22b8cf',
    '37': 'color: #f8f9fa',
    '1': 'font-weight: bold',
    '0': '',
  };

  let result = text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 处理 ANSI 转义序列
  result = result.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const styles = codes.split(';')
      .map((code: string) => colorMap[code])
      .filter(Boolean)
      .join('; ');
    return styles ? `<span style="${styles}">` : '</span>';
  });

  return result;
}
