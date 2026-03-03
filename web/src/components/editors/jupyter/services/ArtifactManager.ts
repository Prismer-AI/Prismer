/**
 * ArtifactManager - 产物管理服务
 * 
 * 负责：
 * - 自动检测输出中的产物（图片、DataFrame、图表）
 * - 产物元数据管理
 * - 手动持久化（上传到存储）
 * - 导出功能（ZIP 打包）
 */

import type { Output, Artifact, ArtifactType, MimeBundle } from '../types';

// ============================================================
// 类型定义
// ============================================================

export interface DetectedArtifact {
  id: string;
  name?: string;
  cellId: string;
  outputIndex: number;
  type: ArtifactType;
  mimeType: string;
  data: unknown;
  size: number;
  thumbnail?: string;
  metadata: ArtifactMetadata;
  createdAt: string;
}

export interface ArtifactMetadata {
  width?: number;
  height?: number;
  rows?: number;
  columns?: number;
  columnNames?: string[];
  chartType?: string;
  title?: string;
}

export interface ArtifactManagerConfig {
  autoDetect: boolean;
  generateThumbnails: boolean;
  thumbnailMaxSize: number;
  maxArtifactSize: number;  // 字节
  supportedTypes: ArtifactType[];
}

export interface PersistenceOptions {
  uploadUrl: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export interface ExportOptions {
  format: 'zip' | 'json';
  includeData: boolean;
  includeThumbnails: boolean;
}

// ============================================================
// MIME 类型映射
// ============================================================

const MIME_TO_ARTIFACT_TYPE: Record<string, ArtifactType> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/svg+xml': 'image',
  'image/gif': 'image',
  'text/html': 'dataframe',  // pandas DataFrame HTML
  'application/vnd.plotly.v1+json': 'chart',
  'application/vnd.vegalite.v4+json': 'chart',
  'application/vnd.vega.v5+json': 'chart',
};

const ARTIFACT_EXTENSIONS: Partial<Record<ArtifactType, string>> = {
  image: 'png',
  dataframe: 'html',
  chart: 'json',
  file: 'bin',
};

function getArtifactExtension(type: ArtifactType): string {
  return ARTIFACT_EXTENSIONS[type] || 'bin';
}

// ============================================================
// ArtifactManager 类
// ============================================================

export class ArtifactManager {
  private config: ArtifactManagerConfig;
  private artifacts: Map<string, DetectedArtifact> = new Map();

  constructor(config?: Partial<ArtifactManagerConfig>) {
    this.config = {
      autoDetect: true,
      generateThumbnails: true,
      thumbnailMaxSize: 200,
      maxArtifactSize: 50 * 1024 * 1024,  // 50MB
      supportedTypes: ['image', 'dataframe', 'chart'],
      ...config,
    };
  }

  /**
   * 从输出中检测产物
   */
  detectArtifacts(cellId: string, outputs: Output[]): DetectedArtifact[] {
    if (!this.config.autoDetect) return [];

    const detected: DetectedArtifact[] = [];

    outputs.forEach((output, index) => {
      if (output.type === 'display_data' || output.type === 'execute_result') {
        const data = output.data as MimeBundle;
        const artifacts = this.extractArtifactsFromMimeBundle(cellId, index, data);
        detected.push(...artifacts);
      }
    });

    // 存储检测到的产物
    detected.forEach(artifact => {
      this.artifacts.set(artifact.id, artifact);
    });

    return detected;
  }

  /**
   * 从 MIME bundle 提取产物
   */
  private extractArtifactsFromMimeBundle(
    cellId: string,
    outputIndex: number,
    data: MimeBundle
  ): DetectedArtifact[] {
    const artifacts: DetectedArtifact[] = [];

    for (const [mimeType, content] of Object.entries(data)) {
      const artifactType = MIME_TO_ARTIFACT_TYPE[mimeType];
      
      if (!artifactType || !this.config.supportedTypes.includes(artifactType)) {
        continue;
      }

      // 特殊处理：检查 HTML 是否是 DataFrame
      if (mimeType === 'text/html' && typeof content === 'string') {
        if (!this.isDataFrameHtml(content)) {
          continue;  // 跳过非 DataFrame HTML
        }
      }

      const size = this.calculateSize(content);
      if (size > this.config.maxArtifactSize) {
        console.warn(`Artifact too large (${size} bytes), skipping`);
        continue;
      }

      const artifact: DetectedArtifact = {
        id: crypto.randomUUID(),
        cellId,
        outputIndex,
        type: artifactType,
        mimeType,
        data: content,
        size,
        metadata: this.extractMetadata(artifactType, mimeType, content),
        createdAt: new Date().toISOString(),
      };

      // 生成缩略图
      if (this.config.generateThumbnails && artifactType === 'image') {
        artifact.thumbnail = this.generateThumbnail(mimeType, content as string);
      }

      artifacts.push(artifact);
    }

    return artifacts;
  }

  /**
   * 检查 HTML 是否是 DataFrame
   */
  private isDataFrameHtml(html: string): boolean {
    return html.includes('dataframe') || 
           html.includes('class="dataframe"') ||
           (html.includes('<table') && html.includes('<thead'));
  }

  /**
   * 提取元数据
   */
  private extractMetadata(
    type: ArtifactType,
    mimeType: string,
    content: unknown
  ): ArtifactMetadata {
    const metadata: ArtifactMetadata = {};

    if (type === 'dataframe' && typeof content === 'string') {
      // 从 HTML 表格提取行列信息
      const rowMatch = content.match(/<tr>/g);
      const colMatch = content.match(/<th[^>]*>/g);
      
      if (rowMatch) {
        metadata.rows = rowMatch.length - 1;  // 减去表头
      }
      if (colMatch) {
        metadata.columns = colMatch.length;
      }

      // 提取列名
      const headerMatch = content.match(/<th[^>]*>([^<]+)<\/th>/g);
      if (headerMatch) {
        metadata.columnNames = headerMatch
          .map(h => h.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
      }
    }

    if (type === 'chart' && typeof content === 'object') {
      const chartData = content as { layout?: { title?: { text?: string } } };
      metadata.chartType = 'plotly';
      metadata.title = chartData.layout?.title?.text;
    }

    return metadata;
  }

  /**
   * 生成缩略图（base64）
   */
  private generateThumbnail(mimeType: string, base64Data: string): string {
    // 简化实现：直接返回原数据的前缀作为标识
    // 实际应用中应该使用 canvas 压缩
    return base64Data.slice(0, 100);
  }

  /**
   * 计算数据大小
   */
  private calculateSize(content: unknown): number {
    if (typeof content === 'string') {
      return new Blob([content]).size;
    }
    return new Blob([JSON.stringify(content)]).size;
  }

  /**
   * 获取所有产物
   */
  getAllArtifacts(): DetectedArtifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * 获取指定 Cell 的产物
   */
  getArtifactsByCell(cellId: string): DetectedArtifact[] {
    return Array.from(this.artifacts.values())
      .filter(a => a.cellId === cellId);
  }

  /**
   * 获取指定类型的产物
   */
  getArtifactsByType(type: ArtifactType): DetectedArtifact[] {
    return Array.from(this.artifacts.values())
      .filter(a => a.type === type);
  }

  /**
   * 删除产物
   */
  removeArtifact(id: string): boolean {
    return this.artifacts.delete(id);
  }

  /**
   * 清空所有产物
   */
  clearAll(): void {
    this.artifacts.clear();
  }

  /**
   * 持久化产物（上传）
   */
  async persistArtifact(
    id: string,
    options: PersistenceOptions
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const artifact = this.artifacts.get(id);
    if (!artifact) {
      return { success: false, error: 'Artifact not found' };
    }

    try {
      const formData = new FormData();
      
      // 创建 Blob
      let blob: Blob;
      if (typeof artifact.data === 'string') {
        if (artifact.mimeType.startsWith('image/')) {
          // Base64 图片
          const binary = atob(artifact.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: artifact.mimeType });
        } else {
          blob = new Blob([artifact.data], { type: artifact.mimeType });
        }
      } else {
        blob = new Blob([JSON.stringify(artifact.data)], { type: 'application/json' });
      }

      const extension = getArtifactExtension(artifact.type);
      const filename = `artifact_${artifact.id.slice(0, 8)}.${extension}`;
      formData.append('file', blob, filename);
      formData.append('metadata', JSON.stringify({
        id: artifact.id,
        cellId: artifact.cellId,
        type: artifact.type,
        mimeType: artifact.mimeType,
        metadata: artifact.metadata,
        createdAt: artifact.createdAt,
      }));

      const response = await fetch(options.uploadUrl, {
        method: 'POST',
        headers: options.headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, url: result.url };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * 导出产物为 ZIP
   * 需要安装 jszip: npm install jszip
   */
  async exportAsZip(
    artifactIds?: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: Partial<ExportOptions>
  ): Promise<Blob> {
    // 动态导入 jszip（可选依赖）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let JSZipClass: new () => { file: (name: string, data: unknown, options?: Record<string, unknown>) => void; generateAsync: (options: Record<string, unknown>) => Promise<Blob> };
    try {
      // @ts-ignore - jszip is an optional dependency
      const module = await import(/* webpackIgnore: true */ 'jszip');
      JSZipClass = module.default || module;
    } catch {
      throw new Error('jszip not installed. Run: npm install jszip');
    }
    const zip = new JSZipClass();

    const artifacts = artifactIds
      ? artifactIds.map(id => this.artifacts.get(id)).filter(Boolean) as DetectedArtifact[]
      : this.getAllArtifacts();

    // 添加产物到 ZIP
    artifacts.forEach((artifact, index) => {
      const extension = getArtifactExtension(artifact.type);
      const filename = `${artifact.type}_${index + 1}.${extension}`;

      if (typeof artifact.data === 'string') {
        if (artifact.mimeType.startsWith('image/')) {
          // Base64 图片 -> 二进制
          zip.file(filename, artifact.data, { base64: true });
        } else {
          zip.file(filename, artifact.data);
        }
      } else {
        zip.file(filename, JSON.stringify(artifact.data, null, 2));
      }
    });

    // 添加元数据清单
    const manifest = artifacts.map(a => ({
      id: a.id,
      cellId: a.cellId,
      type: a.type,
      mimeType: a.mimeType,
      size: a.size,
      metadata: a.metadata,
      createdAt: a.createdAt,
    }));
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * 下载单个产物
   */
  downloadArtifact(id: string, filename?: string): void {
    const artifact = this.artifacts.get(id);
    if (!artifact) return;

    let blob: Blob;
    if (typeof artifact.data === 'string') {
      if (artifact.mimeType.startsWith('image/')) {
        const binary = atob(artifact.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: artifact.mimeType });
      } else {
        blob = new Blob([artifact.data], { type: artifact.mimeType });
      }
    } else {
      blob = new Blob([JSON.stringify(artifact.data, null, 2)], { type: 'application/json' });
    }

    const extension = ARTIFACT_EXTENSIONS[artifact.type] || 'bin';
    const defaultFilename = `artifact_${artifact.id.slice(0, 8)}.${extension}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 获取产物摘要（用于 Agent 上下文）
   */
  getArtifactSummaries(): Array<{
    id: string;
    cellId: string;
    type: ArtifactType;
    summary: string;
  }> {
    return Array.from(this.artifacts.values()).map(a => ({
      id: a.id,
      cellId: a.cellId,
      type: a.type,
      summary: this.formatArtifactSummary(a),
    }));
  }

  /**
   * 格式化产物摘要
   */
  private formatArtifactSummary(artifact: DetectedArtifact): string {
    switch (artifact.type) {
      case 'image':
        return `Image (${artifact.mimeType}, ${this.formatSize(artifact.size)})`;
      case 'dataframe':
        const { rows, columns } = artifact.metadata;
        return `DataFrame (${rows || '?'} rows × ${columns || '?'} columns)`;
      case 'chart':
        return `Chart: ${artifact.metadata.title || 'Untitled'} (${artifact.metadata.chartType || 'unknown'})`;
      default:
        return `${artifact.type} (${this.formatSize(artifact.size)})`;
    }
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * 创建 ArtifactManager 实例
 */
export function createArtifactManager(
  config?: Partial<ArtifactManagerConfig>
): ArtifactManager {
  return new ArtifactManager(config);
}

export default ArtifactManager;
