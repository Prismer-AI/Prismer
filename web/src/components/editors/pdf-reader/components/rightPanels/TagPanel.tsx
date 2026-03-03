import React, { useState, useCallback } from "react";
import {
  MessageSquare,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Heart,
  FileText,
  Type,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 标签数据结构
interface SentenceTag {
  id: string;
  sentenceIds: number[];
  sentenceContent: string;
  pageNumber: number;
  position: { x: number; y: number };
  color: string;
  timestamp: number;
  comments: TagComment[];
  isVisible: boolean;
  likes: number;
  isLiked?: boolean;
}

interface TagComment {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  likes: number;
  isLiked?: boolean;
}

interface AnnotationCategory {
  id: string;
  name: string;
  color: string;
  aiRules: string;
  isDefault?: boolean;
}

interface TagPanelProps {
  tags?: SentenceTag[];
  onTagClick?: (tag: SentenceTag) => void;
  onTagVisibilityToggle?: (tagId: string) => void;
  onTagDelete?: (tagId: string) => void;
  onAddComment?: (tagId: string, content: string) => void;
  onLikeTag?: (tagId: string) => void;
  onLikeComment?: (tagId: string, commentId: string) => void;
  categories?: AnnotationCategory[];
  onToggleCategoriesManager?: () => void;
}

const defaultTags: SentenceTag[] = [
  {
    id: "1",
    sentenceIds: [1, 2],
    sentenceContent: "This is an important viewpoint about the future prospects of artificial intelligence...",
    pageNumber: 1,
    position: { x: 100, y: 200 },
    color: "#32AECA",
    timestamp: Date.now() - 1000 * 60 * 30, // 30分钟前
    isVisible: true,
    likes: 5,
    isLiked: true,
    comments: [
      {
        id: "c1",
        content: "Very insightful observation!",
        author: "Alice",
        timestamp: Date.now() - 1000 * 60 * 20,
        likes: 2,
        isLiked: false,
      },
      {
        id: "c2",
        content: "This argument needs more data support",
        author: "Bob",
        timestamp: Date.now() - 1000 * 60 * 10,
        likes: 1,
        isLiked: true,
      },
    ],
  },
  {
    id: "2",
    sentenceIds: [5],
    sentenceContent: "Complexity analysis of machine learning algorithms...",
    pageNumber: 2,
    position: { x: 150, y: 300 },
    color: "#FF6B6B",
    timestamp: Date.now() - 1000 * 60 * 60, // 1小时前
    isVisible: true,
    likes: 3,
    isLiked: false,
    comments: [],
  },
];

export const TagPanel: React.FC<TagPanelProps> = ({
  tags = defaultTags,
  onTagClick,
  onTagVisibilityToggle,
  onTagDelete,
  onAddComment,
  onLikeTag,
  onLikeComment,
  categories = [],
  onToggleCategoriesManager,
}) => {
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState<string>("");
  const [commentingTagId, setCommentingTagId] = useState<string | null>(null);

  // Find category name by color
  const getCategoryName = useCallback(
    (color: string) => {
      const category = categories.find((cat) => cat.color === color);
      return category?.name || "Uncategorized";
    },
    [categories]
  );

  // Format time
  const formatTime = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  // 处理标签点击
  const handleTagClick = useCallback(
    (tag: SentenceTag) => {
      onTagClick?.(tag);
    },
    [onTagClick]
  );

  // 处理标签展开/收起
  const handleToggleExpand = useCallback(
    (tagId: string) => {
      setExpandedTag(expandedTag === tagId ? null : tagId);
    },
    [expandedTag]
  );

  // 处理可见性切换
  const handleVisibilityToggle = useCallback(
    (tagId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onTagVisibilityToggle?.(tagId);
    },
    [onTagVisibilityToggle]
  );

  // 处理删除标签
  const handleDelete = useCallback(
    (tagId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onTagDelete?.(tagId);
    },
    [onTagDelete]
  );

  // 处理点赞标签
  const handleLikeTag = useCallback(
    (tagId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onLikeTag?.(tagId);
    },
    [onLikeTag]
  );

  // 处理添加评论
  const handleAddComment = useCallback(
    (tagId: string) => {
      if (newCommentContent.trim()) {
        onAddComment?.(tagId, newCommentContent.trim());
        setNewCommentContent("");
        setCommentingTagId(null);
      }
    },
    [newCommentContent, onAddComment]
  );

  // 处理点赞评论
  const handleLikeComment = useCallback(
    (tagId: string, commentId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onLikeComment?.(tagId, commentId);
    },
    [onLikeComment]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--stroke-nor)]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-2)]">
            Manage your highlights ({tags.length})
          </p>
          {onToggleCategoriesManager && (
            <button
              onClick={onToggleCategoriesManager}
              className="p-2 hover:bg-[var(--bg-box-nor)] rounded-lg transition-colors"
              title="Manage Categories"
            >
              <Settings className="w-4 h-4 text-[var(--text-3)]" />
            </button>
          )}
        </div>
      </div>

      {/* Tags List */}
      <div className="flex-1 overflow-y-auto">
        {tags.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-[var(--text-4)] mb-2">
              <MapPin className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-sm text-[var(--text-2)]">No tags yet</p>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Highlight text or sentences in PDF to create tags
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={cn(
                  "border rounded-lg transition-all duration-200 cursor-pointer",
                  "hover:shadow-md hover:border-[var(--stroke-act)]",
                  {
                    "bg-[var(--bg-box-nor)] border-[var(--stroke-nor)]":
                      !expandedTag || expandedTag !== tag.id,
                    "bg-[var(--bg-main)] border-[var(--main-color)] shadow-lg":
                      expandedTag === tag.id,
                    "opacity-60": !tag.isVisible,
                  }
                )}
                onClick={() => handleTagClick(tag)}
              >
                {/* 标签头部 */}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* 标签指示器和页码 */}
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {/* Category name */}
                        <span className="text-xs text-[var(--text-2)] font-medium">
                          {getCategoryName(tag.color)}
                        </span>
                        {/* Type icon */}
                        {(tag as any).type === "annotation" ? (
                          <div title="Text highlight">
                            <FileText className="w-3 h-3 text-[var(--text-3)]" />
                          </div>
                        ) : (
                          <div title="Sentence highlight">
                            <Type className="w-3 h-3 text-[var(--text-3)]" />
                          </div>
                        )}
                        <span className="text-xs text-[var(--text-2)]">
                          Page {tag.pageNumber}
                        </span>
                        <span className="text-xs text-[var(--text-3)]">
                          {formatTime(tag.timestamp)}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-sm text-[var(--text-1)] line-clamp-2 mb-2">
                        {tag.sentenceContent}
                      </p>

                      {/* Social info */}
                      {/* <div className="flex items-center gap-4 text-xs text-[var(--text-3)]">
                        <div className="flex items-center gap-1">
                          <Heart
                            className={cn("w-3 h-3", {
                              "fill-red-500 text-red-500": tag.isLiked,
                              "text-[var(--text-3)]": !tag.isLiked,
                            })}
                          />
                          <span>{tag.likes}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{tag.comments.length}</span>
                        </div>
                      </div> */}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      {/* <button
                        onClick={(e) => handleLikeTag(tag.id, e)}
                        className="p-1 rounded hover:bg-[var(--bg-box-nor)]"
                        title="Like"
                      >
                        <Heart
                          className={cn("w-4 h-4", {
                            "fill-red-500 text-red-500": tag.isLiked,
                            "text-[var(--text-3)]": !tag.isLiked,
                          })}
                        />
                      </button>
                      <button
                        onClick={(e) => handleVisibilityToggle(tag.id, e)}
                        className="p-1 rounded hover:bg-[var(--bg-box-nor)]"
                        title={tag.isVisible ? "Hide" : "Show"}
                      >
                        {tag.isVisible ? (
                          <Eye className="w-4 h-4 text-[var(--text-3)]" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-[var(--text-3)]" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleExpand(tag.id)}
                        className="p-1 rounded hover:bg-[var(--bg-box-nor)]"
                        title="View comments"
                      >
                        <MessageSquare className="w-4 h-4 text-[var(--text-3)]" />
                      </button> */}
                      <button
                        onClick={(e) => handleDelete(tag.id, e)}
                        className="p-1 rounded hover:bg-[var(--bg-box-nor)]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--text-3)]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded comments area */}
                {expandedTag === tag.id && (
                  <div className="border-t border-[var(--stroke-nor)] bg-[var(--bg-box-nor)]">
                    {/* Comments list */}
                    {tag.comments.length > 0 && (
                      <div className="p-3 space-y-3">
                        {tag.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-[var(--bg-main)] rounded-md p-2"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-medium text-[var(--text-1)]">
                                {comment.author}
                              </span>
                              <span className="text-xs text-[var(--text-3)]">
                                {formatTime(comment.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text-2)] mb-2">
                              {comment.content}
                            </p>
                            <div className="flex items-center justify-between">
                              <button
                                onClick={(e) =>
                                  handleLikeComment(tag.id, comment.id, e)
                                }
                                className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-red-500"
                              >
                                <Heart
                                  className={cn("w-3 h-3", {
                                    "fill-red-500 text-red-500":
                                      comment.isLiked,
                                    "text-[var(--text-3)]": !comment.isLiked,
                                  })}
                                />
                                <span>{comment.likes}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add comment */}
                    <div className="p-3 border-t border-[var(--stroke-nor)]">
                      {commentingTagId === tag.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={newCommentContent}
                            onChange={(e) =>
                              setNewCommentContent(e.target.value)
                            }
                            placeholder="Write your comment..."
                            className="w-full p-2 text-sm border border-[var(--stroke-nor)] rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddComment(tag.id)}
                              className="px-3 py-1 text-sm bg-[var(--main-color)] text-white rounded-md hover:bg-[var(--main-color)]/90"
                              disabled={!newCommentContent.trim()}
                            >
                              Post
                            </button>
                            <button
                              onClick={() => {
                                setCommentingTagId(null);
                                setNewCommentContent("");
                              }}
                              className="px-3 py-1 text-sm bg-[var(--bg-box-act)] text-[var(--text-1)] rounded-md hover:bg-[var(--stroke-nor)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCommentingTagId(tag.id)}
                          className="flex items-center gap-2 text-sm text-[var(--text-3)] hover:text-[var(--text-1)]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add comment</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom statistics */}
      {/* <div className="p-4 border-t border-[var(--stroke-nor)] bg-[var(--bg-box-nor)]">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-[var(--text-1)]">
              {tags.length}
            </div>
            <div className="text-xs text-[var(--text-3)]">Tags</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[var(--text-1)]">
              {tags.reduce((sum, tag) => sum + tag.comments.length, 0)}
            </div>
            <div className="text-xs text-[var(--text-3)]">Comments</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[var(--text-1)]">
              {tags.reduce((sum, tag) => sum + tag.likes, 0)}
            </div>
            <div className="text-xs text-[var(--text-3)]">Likes</div>
          </div>
        </div>
      </div> */}
    </div>
  );
};
