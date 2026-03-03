# LaTeX 模板系统设计方案

## 概述

本文档描述了 LaTeX 编辑器的模板搜索、下载和导入系统的设计方案，采用混合方案实现，结合预置模板目录、GitHub API 集成和用户自定义导入三种方式。

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        LaTeX Editor                              │
├─────────────────────────────────────────────────────────────────┤
│                    Template Manager UI                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 模板浏览  │  │ 模板搜索  │  │ 模板预览  │  │ 导入/下载按钮    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Template Service Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ 预置模板索引  │  │ GitHub API   │  │ 文件解析/导入服务      │ │
│  │ (JSON 配置)  │  │ 集成服务      │  │ (ZIP/单文件)          │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      Data Sources                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ 本地模板目录  │  │ GitHub Repos │  │ 用户上传文件           │ │
│  │ (内置)       │  │ (API 获取)   │  │ (ZIP/URL)             │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据结构设计

### 2.1 模板元数据 (TemplateMetadata)

```typescript
interface TemplateMetadata {
  id: string;                    // 唯一标识符
  name: string;                  // 模板名称
  description: string;           // 模板描述
  category: TemplateCategory;    // 分类
  tags: string[];               // 标签
  thumbnail?: string;           // 缩略图 URL
  
  // 来源信息
  source: TemplateSource;
  
  // 版本信息
  version?: string;
  lastUpdated?: string;
  
  // 元信息
  author?: string;
  license?: string;
  documentClass?: string;        // article, report, book, beamer 等
  
  // 统计
  downloads?: number;
  stars?: number;
}

type TemplateCategory = 
  | 'conference'      // 会议论文
  | 'journal'         // 期刊论文
  | 'thesis'          // 学位论文
  | 'cv'              // 简历
  | 'presentation'    // 演示文稿 (Beamer)
  | 'report'          // 报告
  | 'book'            // 书籍
  | 'letter'          // 信件
  | 'poster'          // 海报
  | 'other';          // 其他

interface TemplateSource {
  type: 'builtin' | 'github' | 'overleaf' | 'url' | 'local';
  
  // GitHub 来源
  github?: {
    owner: string;
    repo: string;
    branch?: string;           // 默认 main
    path?: string;             // 仓库内路径，默认根目录
    mainFile?: string;         // 主文件，默认 main.tex
  };
  
  // Overleaf 来源
  overleaf?: {
    templateId: string;        // 如 'rdtrwgypxxzb'
    templateSlug: string;      // 如 'cvpr-2026-submission-template'
    webUrl: string;            // 完整 URL
  };
  
  // 直接 URL
  url?: string;                // ZIP 文件 URL
}
```

### 2.2 模板文件结构 (TemplateFiles)

```typescript
interface TemplateFiles {
  mainFile: string;             // 主 .tex 文件名
  files: TemplateFile[];        // 所有文件
}

interface TemplateFile {
  path: string;                 // 相对路径
  name: string;                 // 文件名
  type: 'tex' | 'bib' | 'sty' | 'cls' | 'bst' | 'image' | 'other';
  content?: string;             // 文本内容（仅文本文件）
  binaryUrl?: string;           // 二进制文件 URL（图片等）
  size?: number;                // 文件大小
}
```

### 2.3 预置模板目录结构

```typescript
// templates-catalog.json
interface TemplateCatalog {
  version: string;
  lastUpdated: string;
  categories: CategoryInfo[];
  templates: TemplateMetadata[];
}

interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  icon: string;
  description: string;
  count?: number;
}
```

---

## 3. 预置模板目录

### 3.1 顶级会议模板

| 会议 | 领域 | GitHub 仓库 | 备注 |
|------|------|-------------|------|
| CVPR | CV | cvpr-org/author-kit | ICCV 同款 |
| NeurIPS | ML/AI | - | 每年更新 |
| ICML | ML | - | PMLR 格式 |
| ICLR | ML | - | OpenReview |
| ACL | NLP | acl-org/ACLPUB | EMNLP/NAACL 同款 |
| AAAI | AI | - | 官方模板 |
| IJCAI | AI | - | 官方模板 |
| ECCV | CV | - | 双年会议 |
| SIGGRAPH | Graphics | - | ACM 格式 |
| CHI | HCI | - | ACM 格式 |

### 3.2 顶级期刊模板

| 期刊 | 领域 | 来源 |
|------|------|------|
| IEEE Transactions | 多领域 | IEEE 官方 |
| ACM Journals | CS | ACM 官方 |
| Nature | 综合 | 官方模板 |
| Science | 综合 | 官方模板 |
| PNAS | 综合 | 官方模板 |
| JMLR | ML | 官方模板 |
| TPAMI | CV | IEEE |
| TIP | Image | IEEE |

### 3.3 其他常用模板

- 学位论文（各大学模板）
- 简历/CV 模板
- Beamer 演示模板
- 书籍模板
- 信件模板

---

## 4. API 设计

### 4.1 模板服务接口

```typescript
// services/TemplateService.ts

interface TemplateService {
  // 获取模板目录
  getCatalog(): Promise<TemplateCatalog>;
  
  // 搜索模板
  searchTemplates(query: string, filters?: TemplateFilters): Promise<TemplateMetadata[]>;
  
  // 获取模板详情
  getTemplateDetails(id: string): Promise<TemplateMetadata>;
  
  // 下载模板文件
  downloadTemplate(id: string): Promise<TemplateFiles>;
  
  // 从 GitHub 导入
  importFromGitHub(owner: string, repo: string, options?: GitHubImportOptions): Promise<TemplateFiles>;
  
  // 从 URL 导入
  importFromUrl(url: string): Promise<TemplateFiles>;
  
  // 从本地文件导入
  importFromFile(file: File): Promise<TemplateFiles>;
}

interface TemplateFilters {
  category?: TemplateCategory;
  tags?: string[];
  source?: TemplateSource['type'];
  documentClass?: string;
}

interface GitHubImportOptions {
  branch?: string;
  path?: string;
  mainFile?: string;
}
```

### 4.2 GitHub API 集成

```typescript
// services/GitHubService.ts

interface GitHubService {
  // 搜索 LaTeX 模板仓库
  searchRepositories(query: string): Promise<GitHubRepo[]>;
  
  // 获取仓库内容
  getRepositoryContents(owner: string, repo: string, path?: string): Promise<GitHubContent[]>;
  
  // 获取文件内容
  getFileContent(owner: string, repo: string, path: string): Promise<string>;
  
  // 下载整个仓库（ZIP）
  downloadRepository(owner: string, repo: string, ref?: string): Promise<Blob>;
  
  // 获取仓库信息
  getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepo>;
}

interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  updatedAt: string;
  defaultBranch: string;
  topics: string[];
  htmlUrl: string;
}

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  downloadUrl?: string;
}
```

### 4.3 Next.js API Routes

```typescript
// app/api/templates/route.ts
GET /api/templates                    // 获取模板目录
GET /api/templates/search?q=xxx       // 搜索模板
GET /api/templates/[id]               // 获取模板详情
POST /api/templates/[id]/download     // 下载模板

// app/api/github/route.ts
GET /api/github/search?q=xxx          // 搜索 GitHub 仓库
GET /api/github/repos/[owner]/[repo]  // 获取仓库信息
GET /api/github/repos/[owner]/[repo]/contents  // 获取仓库内容
POST /api/github/import               // 导入 GitHub 模板
```

---

## 5. UI 组件设计

### 5.1 组件结构

```
TemplateManager/
├── index.ts                    # 导出
├── TemplateManager.tsx         # 主容器组件
├── components/
│   ├── TemplateGallery.tsx     # 模板画廊/网格视图
│   ├── TemplateCard.tsx        # 单个模板卡片
│   ├── TemplateSearch.tsx      # 搜索栏
│   ├── TemplateFilters.tsx     # 分类/筛选器
│   ├── TemplatePreview.tsx     # 模板预览弹窗
│   ├── TemplateImporter.tsx    # 导入对话框
│   └── GitHubImporter.tsx      # GitHub URL 导入
├── hooks/
│   ├── useTemplates.ts         # 模板数据 hook
│   └── useGitHubImport.ts      # GitHub 导入 hook
└── data/
    └── catalog.json            # 预置模板目录
```

### 5.2 TemplateManager 主组件

```tsx
// 功能特性：
// 1. 分类浏览 - 按会议/期刊/类型分类
// 2. 搜索功能 - 名称、描述、标签搜索
// 3. 筛选功能 - 按来源、文档类型筛选
// 4. 模板预览 - 显示文件列表和主文件预览
// 5. 一键导入 - 下载并导入到编辑器
// 6. GitHub 导入 - 输入 GitHub URL 直接导入
// 7. 文件上传 - 支持 ZIP 文件上传

interface TemplateManagerProps {
  onImport: (files: TemplateFiles) => void;  // 导入回调
  onClose: () => void;                        // 关闭回调
}
```

### 5.3 UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Gallery                                          [X]   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search templates...                    [Filter ▼] [+ URL]│ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ │ All │ Conference │ Journal │ Thesis │ CV │ Presentation │    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │
│ │ │ Preview │ │ │ │ Preview │ │ │ │ Preview │ │ │ │ Preview │ │ │
│ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │
│ │ CVPR 2026   │ │ NeurIPS     │ │ ACL 2025    │ │ IEEE Trans  │ │
│ │ ⭐ 690 │ GH │ │ ⭐ 450 │ GH │ │ ⭐ 320 │ GH │ │ ⭐ 890 │ GH │ │
│ │ [Import]    │ │ [Import]    │ │ [Import]    │ │ [Import]    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                                  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ ...         │ │ ...         │ │ ...         │ │ ...         │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Showing 24 of 156 templates                      [Load More]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 实现计划

### Phase 1: 基础架构（预计 2-3 天）✅ 已完成

#### Step 1.1: 数据结构和类型定义
- [x] 创建 `types.ts` 定义所有类型
- [x] 创建 `data/catalog.json` 预置模板目录（40+ 模板）

#### Step 1.2: 服务层实现
- [x] 创建 `services/TemplateService.ts`
- [x] 创建 `services/GitHubService.ts`
- [x] 实现 GitHub API 调用（使用 fetch）

#### Step 1.3: API Routes
- [x] 创建 `/api/templates` 系列接口
- [x] 创建 `/api/github` 系列接口
- [x] 处理 CORS 和错误处理

### Phase 2: UI 组件（预计 2-3 天）✅ 已完成

#### Step 2.1: 基础组件
- [x] `TemplateCard.tsx` - 模板卡片（网格/列表模式）
- [x] `TemplateSearch.tsx` - 搜索框（防抖）
- [x] `TemplateFilters.tsx` - 分类标签

#### Step 2.2: 核心组件
- [x] `TemplatePreview.tsx` - 预览弹窗
- [x] `TemplateManager.tsx` - 主容器

#### Step 2.3: 导入功能
- [x] `GitHubImporter.tsx` - GitHub URL 输入
- [x] `useTemplates.ts` - 模板数据 Hook

### Phase 3: 集成和优化（预计 1-2 天）✅ 已完成

#### Step 3.1: 集成到 LaTeX 编辑器
- [x] 在 `LatexEditorPreview.tsx` 添加模板按钮
- [x] 实现导入后文件加载逻辑
- [x] 处理多文件项目

#### Step 3.2: 优化和缓存
- [x] 添加模板目录缓存 (`CacheService.ts`)
- [x] 添加下载进度显示 (`DownloadProgress.tsx`)
- [x] 错误处理和用户提示 (`Toast.tsx`)

#### Step 3.3: 扩展模板目录
- [x] 添加更多会议/期刊模板
- [x] 添加学位论文模板 (Stanford, Oxford)
- [x] 添加简历/演示模板
- [x] 添加报告、书籍、信件、海报模板

---

## 7. 预置模板目录初始数据

### 7.1 顶级会议（首批）

```json
{
  "templates": [
    {
      "id": "cvpr-2026",
      "name": "CVPR 2026",
      "description": "IEEE/CVF Conference on Computer Vision and Pattern Recognition 2026 submission template",
      "category": "conference",
      "tags": ["computer-vision", "cvpr", "ieee", "2026"],
      "source": {
        "type": "github",
        "github": {
          "owner": "cvpr-org",
          "repo": "author-kit",
          "mainFile": "main.tex"
        }
      },
      "author": "CVPR Organization",
      "license": "CC BY 4.0",
      "documentClass": "article"
    },
    {
      "id": "neurips-2025",
      "name": "NeurIPS 2025",
      "description": "Neural Information Processing Systems 2025 submission template",
      "category": "conference",
      "tags": ["machine-learning", "neurips", "ai", "2025"],
      "source": {
        "type": "github",
        "github": {
          "owner": "neurips-org",
          "repo": "paper-template"
        }
      }
    },
    {
      "id": "acl-2025",
      "name": "ACL 2025",
      "description": "Association for Computational Linguistics 2025 submission template",
      "category": "conference",
      "tags": ["nlp", "acl", "linguistics", "2025"],
      "source": {
        "type": "github",
        "github": {
          "owner": "acl-org",
          "repo": "acl-style-files"
        }
      }
    }
  ]
}
```

---

## 8. 技术注意事项

### 8.1 GitHub API 限制

- **未认证请求**: 60 次/小时
- **认证请求**: 5000 次/小时
- **建议**: 
  - 缓存模板目录和仓库信息
  - 提供可选的 GitHub Token 配置
  - 使用 raw.githubusercontent.com 直接下载文件

### 8.2 文件处理

- **文本文件**: .tex, .bib, .sty, .cls, .bst, .txt, .md
- **二进制文件**: .pdf, .png, .jpg, .eps（存储为 URL 或 Base64）
- **ZIP 解析**: 使用 JSZip 库

### 8.3 安全考虑

- 验证 GitHub URL 格式
- 限制下载文件大小（建议 < 50MB）
- 过滤可执行文件
- 清理文件名（防止路径遍历）

---

## 9. 后续扩展

### 9.1 用户系统集成
- 用户收藏模板
- 自定义模板上传
- 模板使用历史

### 9.2 模板增强
- 模板预览 PDF
- 实时编辑预览
- 模板变量替换

### 9.3 社区功能
- 模板评分和评论
- 模板分享
- 热门模板排行

---

## 10. 文件清单

实现后的文件结构：

```
src/components/editors/previews/
├── LatexEditorPreview.tsx          # 主编辑器（已有，需修改）
└── latex-templates/
    ├── TEMPLATE_SYSTEM_DESIGN.md   # 本设计文档
    ├── types.ts                    # 类型定义
    ├── data/
    │   └── catalog.json            # 预置模板目录
    ├── services/
    │   ├── TemplateService.ts      # 模板服务
    │   └── GitHubService.ts        # GitHub API 服务
    ├── components/
    │   ├── TemplateManager.tsx     # 模板管理器主组件
    │   ├── TemplateGallery.tsx     # 模板画廊
    │   ├── TemplateCard.tsx        # 模板卡片
    │   ├── TemplateSearch.tsx      # 搜索组件
    │   ├── TemplateFilters.tsx     # 筛选组件
    │   ├── TemplatePreview.tsx     # 预览弹窗
    │   └── GitHubImporter.tsx      # GitHub 导入
    ├── hooks/
    │   ├── useTemplates.ts         # 模板数据 hook
    │   └── useGitHubImport.ts      # GitHub 导入 hook
    └── index.ts                    # 导出

src/app/api/
├── templates/
│   ├── route.ts                    # GET /api/templates
│   └── [id]/
│       └── route.ts                # GET/POST /api/templates/[id]
└── github/
    ├── route.ts                    # GitHub 搜索
    └── repos/
        └── [...path]/
            └── route.ts            # GitHub 仓库操作
```

---

## 附录 A: 参考资源

- [GitHub REST API 文档](https://docs.github.com/en/rest)
- [Overleaf 模板库](https://www.overleaf.com/latex/templates)
- [CVPR Author Kit](https://github.com/cvpr-org/author-kit)
- [JSZip 库](https://stuk.github.io/jszip/)

---

*文档版本: 1.0*
*创建日期: 2026-01-18*
*作者: Pisa OS Team*
