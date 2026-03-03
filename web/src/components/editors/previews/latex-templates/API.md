# LaTeX Template System - API 文档

## 概述

LaTeX 模板系统提供了完整的模板管理 API，包括 REST API 端点和前端服务类。

---

## REST API 端点

### 模板 API

#### GET /api/templates

获取模板列表，支持搜索和筛选。

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `q` | string | 搜索关键词（名称、描述、标签） |
| `category` | string | 分类筛选（conference, journal, thesis 等） |
| `tags` | string | 标签筛选（逗号分隔） |
| `source` | string | 来源类型（github, overleaf） |
| `featured` | boolean | 获取精选模板 |
| `recent` | boolean | 获取最近更新模板 |
| `limit` | number | 限制返回数量（默认 20） |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": "cvpr-2026",
      "name": "CVPR 2026",
      "description": "...",
      "category": "conference",
      "tags": ["computer-vision", "cvpr"],
      "source": {
        "type": "github",
        "github": {
          "owner": "cvpr-org",
          "repo": "author-kit"
        }
      },
      "stars": 690
    }
  ],
  "total": 42
}
```

---

#### GET /api/templates/[id]

获取单个模板详情。

**响应：**

```json
{
  "success": true,
  "data": {
    "id": "cvpr-2026",
    "name": "CVPR 2026",
    "description": "IEEE/CVF Conference on Computer Vision...",
    "category": "conference",
    "tags": ["computer-vision", "cvpr", "ieee"],
    "source": { ... },
    "author": "CVPR Organization",
    "license": "CC BY 4.0",
    "documentClass": "article",
    "stars": 690
  }
}
```

---

#### POST /api/templates/[id]

下载模板文件。

**响应：**

```json
{
  "success": true,
  "data": {
    "mainFile": "main.tex",
    "files": [
      {
        "path": "main.tex",
        "name": "main.tex",
        "type": "tex",
        "content": "\\documentclass{article}...",
        "size": 2048
      },
      {
        "path": "references.bib",
        "name": "references.bib",
        "type": "bib",
        "content": "@article{...}",
        "size": 1024
      }
    ]
  },
  "message": "Successfully downloaded 5 files"
}
```

---

#### GET /api/templates/categories

获取所有分类及数量。

**响应：**

```json
{
  "success": true,
  "data": [
    { "id": "conference", "name": "Conference Papers", "icon": "🎯", "count": 15 },
    { "id": "journal", "name": "Journal Articles", "icon": "📰", "count": 8 },
    { "id": "thesis", "name": "Thesis & Dissertation", "icon": "🎓", "count": 5 }
  ]
}
```

---

### GitHub API

#### GET /api/github

搜索 GitHub 上的 LaTeX 模板仓库。

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `q` | string | 搜索关键词（必需） |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": "github-user-repo",
      "name": "latex-template",
      "description": "A LaTeX template",
      "category": "other",
      "tags": ["latex", "template"],
      "source": {
        "type": "github",
        "github": {
          "owner": "user",
          "repo": "latex-template",
          "branch": "main"
        }
      },
      "stars": 100
    }
  ]
}
```

---

#### POST /api/github/import

从 GitHub URL 导入模板。

**请求体：**

```json
{
  "url": "https://github.com/cvpr-org/author-kit",
  "options": {
    "branch": "main",
    "path": "",
    "mainFile": "main.tex"
  }
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "success": true,
    "files": {
      "mainFile": "main.tex",
      "files": [...]
    }
  },
  "message": "Imported 8 files from cvpr-org/author-kit"
}
```

---

## 前端服务 API

### TemplateService

模板管理服务的主要接口。

```typescript
import { templateService } from "@/components/editors/previews/latex-templates";

// 获取所有模板
const templates = templateService.getAllTemplates();

// 搜索模板
const results = templateService.searchTemplates({
  query: "CVPR",
  category: "conference",
  tags: ["computer-vision"],
});

// 下载模板（自动缓存）
const response = await templateService.downloadTemplate("cvpr-2026");
if (response.success) {
  console.log(response.data.files);
}

// 从 GitHub URL 导入
const importResult = await templateService.importFromGitHub(
  "https://github.com/cvpr-org/author-kit"
);

// 获取分类
const categories = templateService.getCategories();

// 获取精选模板
const featured = templateService.getFeaturedTemplates(8);

// 清除缓存
templateService.clearCache();

// 获取缓存统计
const stats = templateService.getCacheStats();
```

---

### GitHubService

GitHub API 集成服务。

```typescript
import { githubService } from "@/components/editors/previews/latex-templates";

// 搜索仓库
const searchResult = await githubService.searchRepositories("latex template");

// 获取仓库信息
const repo = await githubService.getRepository("cvpr-org", "author-kit");

// 获取仓库内容
const contents = await githubService.getContents("cvpr-org", "author-kit");

// 获取文件内容
const content = await githubService.getFileContent(
  "cvpr-org", 
  "author-kit", 
  "main.tex"
);

// 导入模板
const files = await githubService.importTemplate("cvpr-org", "author-kit", {
  branch: "main",
  mainFile: "main.tex",
});

// 解析 GitHub URL
const parsed = GitHubService.parseGitHubUrl(
  "https://github.com/cvpr-org/author-kit"
);
// { owner: "cvpr-org", repo: "author-kit" }
```

---

### CacheService

模板缓存服务。

```typescript
import { cacheService } from "@/components/editors/previews/latex-templates";

// 缓存模板文件
cacheService.setTemplateFiles("cvpr-2026", files);

// 获取缓存的模板
const cached = cacheService.getTemplateFiles("cvpr-2026");

// 缓存 GitHub 导入
cacheService.setGitHubImport("cvpr-org", "author-kit", files);

// 检查缓存是否存在
const exists = cacheService.has("files:cvpr-2026");

// 清除缓存
cacheService.clear();

// 清理过期缓存
const removed = cacheService.cleanup();

// 获取统计信息
const stats = cacheService.getStats();
```

---

## React Hooks

### useTemplates

模板管理 Hook。

```typescript
import { useTemplates } from "@/components/editors/previews/latex-templates";

function MyComponent() {
  const {
    templates,           // 过滤后的模板列表
    categories,          // 分类列表
    featuredTemplates,   // 精选模板
    isLoading,           // 加载状态
    error,               // 错误信息
    filters,             // 当前筛选条件
    setSearchQuery,      // 设置搜索词
    setCategory,         // 设置分类
    clearFilters,        // 清除筛选
    downloadTemplate,    // 下载模板
    importFromGitHub,    // GitHub 导入
    searchGitHub,        // 搜索 GitHub
  } = useTemplates();

  return (
    <div>
      <input onChange={(e) => setSearchQuery(e.target.value)} />
      {templates.map(t => <div key={t.id}>{t.name}</div>)}
    </div>
  );
}
```

---

### useDownloadProgress

下载进度管理 Hook。

```typescript
import { useDownloadProgress } from "@/components/editors/previews/latex-templates";

function DownloadButton() {
  const {
    state,              // 下载状态
    startDownload,      // 开始下载
    updateProgress,     // 更新进度
    setProcessing,      // 设置处理中
    setSuccess,         // 设置成功
    setError,           // 设置错误
    reset,              // 重置状态
  } = useDownloadProgress();

  const handleDownload = async () => {
    startDownload(10);
    try {
      // 下载逻辑...
      updateProgress(50, "main.tex", 5);
      setSuccess("Download complete!", 10);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <button onClick={handleDownload}>Download</button>
      <DownloadProgress state={state} />
    </>
  );
}
```

---

## 数据类型

### TemplateMetadata

```typescript
interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  thumbnail?: string;
  source: TemplateSource;
  version?: string;
  lastUpdated?: string;
  author?: string;
  license?: string;
  documentClass?: string;
  downloads?: number;
  stars?: number;
}
```

### TemplateCategory

```typescript
type TemplateCategory =
  | "conference"      // 会议论文
  | "journal"         // 期刊论文
  | "thesis"          // 学位论文
  | "cv"              // 简历
  | "presentation"    // 演示文稿
  | "report"          // 报告
  | "book"            // 书籍
  | "letter"          // 信件
  | "poster"          // 海报
  | "other";          // 其他
```

### TemplateSource

```typescript
interface TemplateSource {
  type: "builtin" | "github" | "overleaf" | "url" | "local";
  github?: {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
    mainFile?: string;
  };
  overleaf?: {
    templateId: string;
    templateSlug: string;
    webUrl: string;
  };
  url?: string;
}
```

### TemplateFiles

```typescript
interface TemplateFiles {
  mainFile: string;
  files: TemplateFile[];
}

interface TemplateFile {
  path: string;
  name: string;
  type: "tex" | "bib" | "sty" | "cls" | "bst" | "image" | "other";
  content?: string;
  binaryUrl?: string;
  size?: number;
}
```

### ServiceResponse

```typescript
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## 错误处理

所有 API 返回统一的错误格式：

```json
{
  "success": false,
  "error": "Error message here",
  "message": "Optional additional info"
}
```

常见错误码：
- 400 - 请求参数错误
- 404 - 模板不存在
- 500 - 服务器内部错误

---

## 缓存策略

- **模板文件缓存**: 24 小时 TTL
- **GitHub 导入缓存**: 1 小时 TTL
- **存储位置**: localStorage
- **最大条目**: 50 个

缓存键格式：
- 模板文件: `files:{templateId}`
- GitHub 导入: `github:{owner}/{repo}`
- 元数据: `meta:{templateId}`

---

*文档版本: 1.0*
*更新日期: 2026-01-18*
