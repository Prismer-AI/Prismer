// ============================================================
// LaTeX Templates Module - Main Export
// ============================================================
//
// 这是 LaTeX 模板系统的统一入口文件。
// 
// 使用示例:
// ```typescript
// import { 
//   templateService,      // 模板管理服务
//   TemplateManager,      // 模板管理器组件
//   useTemplates,         // 模板数据 Hook
// } from "@/components/editors/previews/latex-templates";
// ```
//
// 详细 API 文档请参阅: ./API.md
// 设计文档请参阅: ./TEMPLATE_SYSTEM_DESIGN.md
// ============================================================

// Types - 类型定义
export * from "./types";

// Services - 服务层
export { GitHubService, githubService } from "./services/GitHubService";
export { TemplateService, templateService } from "./services/TemplateService";
export { CacheService, cacheService } from "./services/CacheService";

// Components - UI 组件
export {
  // 基础组件
  TemplateCard,
  TemplateSearch,
  TemplateFilters,
  
  // 核心组件
  TemplatePreview,
  GitHubImporter,
  TemplateManager,
  
  // 辅助组件
  DownloadProgress,
  useDownloadProgress,
  ToastProvider,
  useToast,
  StandaloneToast,
} from "./components";

// Component Types
export type { DownloadState, Toast, ToastType } from "./components";

// Hooks - React Hooks
export { useTemplates } from "./hooks";

// Data - 预置数据
export { default as catalogData } from "./data/catalog.json";
