"use client";

import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  FileType,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
  path: string;
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile?: (parentPath: string, name: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (path: string, newName: string) => void;
  className?: string;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onDeleteFile?: (path: string) => void;
}

// ============================================================
// File Icon Helper
// ============================================================

function getFileIcon(filename: string, isOpen?: boolean) {
  if (isOpen !== undefined) {
    // It's a directory
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-amber-400" />
    ) : (
      <Folder className="h-4 w-4 text-amber-400" />
    );
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    case "json":
      return <FileJson className="h-4 w-4 text-amber-400" />;
    case "css":
    case "scss":
      return <FileType className="h-4 w-4 text-pink-400" />;
    case "html":
      return <FileType className="h-4 w-4 text-orange-400" />;
    case "vue":
      return <FileCode className="h-4 w-4 text-emerald-400" />;
    case "md":
      return <FileText className="h-4 w-4 text-stone-400" />;
    default:
      return <FileCode className="h-4 w-4 text-stone-400" />;
  }
}

// ============================================================
// Tree Node Component
// ============================================================

function TreeNode({
  node,
  depth,
  selectedFile,
  expandedDirs,
  onToggleDir,
  onSelectFile,
  onDeleteFile,
}: TreeNodeProps) {
  const isDirectory = node.type === "directory";
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;

  const handleClick = () => {
    if (isDirectory) {
      onToggleDir(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteFile) {
      onDeleteFile(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`group flex items-center gap-1 px-2 py-1 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? "bg-indigo-100 text-indigo-600"
            : "hover:bg-stone-100 text-stone-700"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/Collapse Icon */}
        {isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-stone-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-stone-400" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* File/Folder Icon */}
        {getFileIcon(node.name, isDirectory ? isExpanded : undefined)}

        {/* Name */}
        <span className="flex-1 text-sm truncate">{node.name}</span>

        {/* Delete button */}
        {onDeleteFile && !isDirectory && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-opacity"
          >
            <Trash2 className="h-3 w-3 text-red-400" />
          </button>
        )}
      </div>

      {/* Children */}
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main FileTree Component
// ============================================================

export function FileTree({
  files,
  selectedFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  className = "",
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(["src", "."]) // Default expanded directories
  );

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
          Explorer
        </span>
        {onCreateFile && (
          <button
            onClick={() => {
              const name = prompt("Enter file name:");
              if (name) onCreateFile("", name);
            }}
            className="p-1 hover:bg-stone-200/60 rounded transition-colors"
            title="New File"
          >
            <Plus className="h-3.5 w-3.5 text-stone-500" />
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {files.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            expandedDirs={expandedDirs}
            onToggleDir={toggleDir}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Utility: Convert flat file map to tree structure
// ============================================================

export function buildFileTree(
  files: Record<string, { content: string; language?: string }>
): FileNode[] {
  // Use a map to store directory nodes by path for easy lookup
  const dirMap = new Map<string, FileNode>();
  const rootNodes: FileNode[] = [];

  // Sort paths to process shorter paths (parents) first
  const paths = Object.keys(files).sort();

  for (const filePath of paths) {
    const parts = filePath.split("/");
    
    // Create/get all parent directories
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join("/");
      
      if (!dirMap.has(dirPath)) {
        const dirNode: FileNode = {
          name: parts[i],
          type: "directory",
          path: dirPath,
          children: [],
        };
        dirMap.set(dirPath, dirNode);
        
        // Add to parent or root
        if (i === 0) {
          rootNodes.push(dirNode);
        } else {
          const parentPath = parts.slice(0, i).join("/");
          const parent = dirMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(dirNode);
          }
        }
      }
    }
    
    // Create the file node
    const fileName = parts[parts.length - 1];
    const fileNode: FileNode = {
      name: fileName,
      type: "file",
      path: filePath,
    };
    
    // Add file to parent directory or root
    if (parts.length === 1) {
      rootNodes.push(fileNode);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = dirMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(fileNode);
      }
    }
  }

  // Sort the tree
  sortFileTree(rootNodes);
  return rootNodes;
}

function sortFileTree(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    // Directories first
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });

  // Sort children recursively
  for (const node of nodes) {
    if (node.children) {
      sortFileTree(node.children);
    }
  }
}

export default FileTree;
