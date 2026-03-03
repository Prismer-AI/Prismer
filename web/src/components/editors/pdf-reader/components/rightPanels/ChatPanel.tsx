import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  FileText,
  BookOpen,
  BarChart3,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfjs } from "react-pdf";
import { aiChatStream } from "@/lib/services/ai-client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  description: string;
}

interface ChatPanelProps {
  pdfOutline?: any[];
  pdfText?: string;
  pdfUrl?: string;
  onInsertToNotes?: (content: string) => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "summary",
    label: "Summary",
    icon: <FileText className="w-4 h-4" />,
    prompt:
      "Please provide a comprehensive summary of this paper, including the main objectives, methodology, key findings, and conclusions.",
    description: "Generate paper summary",
  },
  {
    id: "related-work",
    label: "Related Work",
    icon: <BookOpen className="w-4 h-4" />,
    prompt:
      "Analyze the related work section. What are the key references and how do they relate to this work? What gaps in existing research does this paper address?",
    description: "Analyze related work",
  },
  {
    id: "methodology",
    label: "Methodology",
    icon: <BarChart3 className="w-4 h-4" />,
    prompt:
      "Explain the methodology used in this paper. What approaches, techniques, or frameworks are employed? How are experiments designed and conducted?",
    description: "Explain research methodology",
  },
  {
    id: "report",
    label: "Make Report",
    icon: <MessageSquare className="w-4 h-4" />,
    prompt:
      "Create a detailed research report based on this paper, including: 1) Background and motivation, 2) Main contributions, 3) Technical approach, 4) Experimental results, 5) Limitations and future work.",
    description: "Generate research report",
  },
];

// 关键词集合，用于筛选相关段落
const SECTION_KEYWORDS = {
  introduction: [
    "introduction",
    "background",
    "motivation",
    "problem",
    "objective",
  ],
  methodology: [
    "method",
    "approach",
    "technique",
    "algorithm",
    "framework",
    "model",
    "architecture",
  ],
  results: [
    "result",
    "experiment",
    "evaluation",
    "performance",
    "analysis",
    "finding",
  ],
  discussion: [
    "discussion",
    "conclusion",
    "limitation",
    "future",
    "implication",
  ],
  relatedWork: [
    "related work",
    "literature review",
    "prior work",
    "previous",
    "existing",
  ],
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  pdfOutline = [],
  pdfUrl = "",
  onInsertToNotes,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfTextContent, setPdfTextContent] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pdfDocumentRef = useRef<any>(null);

  // 滚动到消息底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载PDF文档并提取文本内容
  useEffect(() => {
    const loadPDFContent = async () => {
      if (!pdfUrl) return;

      try {
        console.log("Starting to load PDF document and text content...");
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        pdfDocumentRef.current = pdf;

        // 提取前几页的文本内容（避免内容过长）
        const maxPages = Math.min(pdf.numPages, 5); // 只提取前5页
        let fullText = "";

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // 将文本项组合成字符串
            const pageText = textContent.items
              .map((item: any) => item.str || "")
              .join(" ")
              .replace(/\s+/g, " ") // 合并多个空格
              .trim();

            if (pageText) {
              fullText += `\n\n=== Page ${pageNum} ===\n${pageText}`;
            }

            console.log(
              `Extracted page ${pageNum} text, length: ${pageText.length}`
            );
          } catch (error) {
            console.error(`Failed to extract page ${pageNum} text:`, error);
          }
        }

        setPdfTextContent(fullText);
        console.log(
          "PDF text content extraction completed, total length:",
          fullText.length
        );
      } catch (error) {
        console.error("Failed to load PDF document:", error);
      }
    };

    loadPDFContent();
  }, [pdfUrl]);

  // 构建上下文：基于关键词筛选相关段落
  const buildContext = useCallback(
    (userQuery: string = "") => {
      console.log("Building context - PDF outline:", pdfOutline);
      console.log("Building context - PDF text length:", pdfTextContent.length);
      console.log("Building context - User query:", userQuery);

      let context = "";

      // 添加文档结构（大纲）
      if (pdfOutline && pdfOutline.length > 0) {
        context += "Document Structure:\n";

        // 添加完整大纲结构
        const processOutlineItem = (item: any, level: number = 0): string => {
          const indent = "  ".repeat(level);
          let result = `${indent}- ${item.title}`;
          if (item.pageNumber) {
            result += ` (Page ${item.pageNumber})`;
          }
          result += "\n";

          if (item.items && item.items.length > 0) {
            item.items.forEach((subItem: any) => {
              result += processOutlineItem(subItem, level + 1);
            });
          }

          return result;
        };

        pdfOutline.forEach((item) => {
          context += processOutlineItem(item);
        });

        // 基于关键词筛选重要段落
        const lowerQuery = userQuery.toLowerCase();
        const relevantSections: string[] = [];

        // 检查用户查询是否匹配特定关键词类别
        Object.entries(SECTION_KEYWORDS).forEach(([_, keywords]) => {
          const isRelevant = keywords.some(
            (keyword) =>
              lowerQuery.includes(keyword.toLowerCase()) ||
              pdfOutline.some((item) =>
                item.title.toLowerCase().includes(keyword.toLowerCase())
              )
          );

          if (isRelevant) {
            const matchingSections = pdfOutline.filter((item) =>
              keywords.some((keyword) =>
                item.title.toLowerCase().includes(keyword.toLowerCase())
              )
            );

            matchingSections.forEach((section) => {
              relevantSections.push(
                `${section.title} (Page ${section.pageNumber || "Unknown"})`
              );
            });
          }
        });

        if (relevantSections.length > 0) {
          context += "\nRelevant Sections for this query:\n";
          relevantSections.forEach((section) => {
            context += `- ${section}\n`;
          });
        }
      }

      // 添加PDF文本内容（如果可用）
      if (pdfTextContent && pdfTextContent.length > 0) {
        context += "\n\nDocument Content (First 5 pages):\n";
        // 限制文本内容长度，避免上下文过长
        const maxLength = 3000; // 限制在3000字符
        if (pdfTextContent.length > maxLength) {
          context +=
            pdfTextContent.substring(0, maxLength) +
            "\n... (content truncated)";
        } else {
          context += pdfTextContent;
        }
      }

      // 如果没有任何内容，提供基本信息
      if (!context.trim()) {
        context =
          "PDF document loaded but no outline or text content available yet. Please wait for the document to finish loading.";
      }

      console.log("Built context length:", context.length);
      console.log("Built context preview:", context.substring(0, 500) + "...");
      return context;
    },
    [pdfOutline, pdfTextContent]
  );

  // 发送消息到AI
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const context = buildContext(content);
      const systemPrompt = `You are an AI assistant helping to analyze and discuss a PDF document. 

Context from the document:
${context}

Instructions:
- Answer questions based on the document structure and content provided
- If asked about specific sections, refer to the page numbers when available
- Provide detailed, insightful responses about the document
- If information is not available in the context, clearly state this limitation
- Format your responses clearly with headings, bullet points, or numbered lists when appropriate`;

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 使用统一 AI 客户端流式调用
      for await (const chunk of aiChatStream({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        intent: "chat",
      })) {
        if (chunk.done) break;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: msg.content + chunk.content }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理快捷操作
  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  // 处理输入提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">
          AI Document Assistant
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Chat with AI to deeply understand document content
        </p>
      </div>

      {/* 快捷指令 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors",
                "bg-gray-100 hover:bg-gray-200 text-gray-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title={action.description}
            >
              {action.icon}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Start chatting with AI to explore document content</p>
            <p className="text-xs mt-1">
              Use quick actions above or ask directly
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                message.role === "user"
                  ? "text-white"
                  : "bg-gray-100 text-gray-800"
              )}
              style={
                message.role === "user" ? { backgroundColor: "#32AECA" } : {}
              }
            >
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div
                  className={cn(
                    "text-xs opacity-70",
                    message.role === "user" ? "text-white" : "text-gray-500"
                  )}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
                {message.role === "assistant" && onInsertToNotes && (
                  <button
                    onClick={() => onInsertToNotes(message.content)}
                    className="ml-2 p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800 transition-colors"
                    title="Insert to notes"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your question..."
            disabled={isLoading}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            rows={2}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
              "bg-blue-500 text-white hover:bg-blue-600",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
