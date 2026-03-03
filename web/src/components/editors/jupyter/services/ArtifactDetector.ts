/**
 * ArtifactDetector - 从 Cell 输出中检测和提取 Artifacts
 * 
 * 支持检测：
 * - 图片 (PNG, JPEG, SVG, GIF)
 * - DataFrame (HTML 表格)
 * - Plotly 图表
 * - Matplotlib 图表
 * - 文件引用
 */

import type { Output, MimeBundle } from '../types';
import type { DetectedArtifact, ArtifactType, ArtifactMetadata } from '../store/artifactStore';

// ============================================================
// 类型定义
// ============================================================

export interface DetectionResult {
  artifacts: DetectedArtifact[];
  hasArtifacts: boolean;
}

// ============================================================
// ArtifactDetector
// ============================================================

export class ArtifactDetector {
  private idCounter = 0;

  /**
   * 从单个 Output 中检测 Artifacts
   */
  detect(cellId: string, output: Output, outputIndex: number): DetectedArtifact[] {
    const artifacts: DetectedArtifact[] = [];

    if (output.type === 'display_data' || output.type === 'execute_result') {
      const data = output.data as MimeBundle;

      // 检测 PNG 图片
      if (data['image/png']) {
        const artifact = this.createImageArtifact(
          cellId, outputIndex, 'image/png', data['image/png'] as string
        );
        if (artifact) artifacts.push(artifact);
      }

      // 检测 JPEG 图片
      if (data['image/jpeg']) {
        const artifact = this.createImageArtifact(
          cellId, outputIndex, 'image/jpeg', data['image/jpeg'] as string
        );
        if (artifact) artifacts.push(artifact);
      }

      // 检测 SVG 图片
      if (data['image/svg+xml']) {
        const artifact = this.createSVGArtifact(
          cellId, outputIndex, data['image/svg+xml'] as string
        );
        if (artifact) artifacts.push(artifact);
      }

      // 检测 GIF 图片
      if (data['image/gif']) {
        const artifact = this.createImageArtifact(
          cellId, outputIndex, 'image/gif', data['image/gif'] as string
        );
        if (artifact) artifacts.push(artifact);
      }

      // 检测 Plotly 图表
      if (data['application/vnd.plotly.v1+json']) {
        const artifact = this.createPlotlyArtifact(
          cellId, outputIndex, data['application/vnd.plotly.v1+json'] as object
        );
        if (artifact) artifacts.push(artifact);
      }

      // 检测 DataFrame (HTML 表格)
      if (data['text/html']) {
        const html = data['text/html'] as string;
        if (this.isDataFrame(html)) {
          const artifact = this.createDataFrameArtifact(
            cellId, outputIndex, html
          );
          if (artifact) artifacts.push(artifact);
        }
      }
    }

    return artifacts;
  }

  /**
   * 从多个 Outputs 中检测所有 Artifacts
   */
  detectAll(cellId: string, outputs: Output[]): DetectionResult {
    const artifacts: DetectedArtifact[] = [];

    outputs.forEach((output, index) => {
      const detected = this.detect(cellId, output, index);
      artifacts.push(...detected);
    });

    return {
      artifacts,
      hasArtifacts: artifacts.length > 0,
    };
  }

  /**
   * 创建图片 Artifact
   */
  private createImageArtifact(
    cellId: string,
    outputIndex: number,
    mimeType: string,
    base64Data: string
  ): DetectedArtifact | null {
    if (!base64Data) return null;

    const id = this.generateId();
    const size = this.estimateBase64Size(base64Data);
    const dimensions = this.extractImageDimensions(base64Data, mimeType);

    return {
      id,
      name: `Image ${id.slice(-4)}`,
      cellId,
      outputIndex,
      type: 'image',
      mimeType,
      data: `data:${mimeType};base64,${base64Data}`,
      size,
      thumbnail: this.createThumbnail(base64Data, mimeType),
      metadata: {
        width: dimensions.width,
        height: dimensions.height,
        format: mimeType.split('/')[1].toUpperCase(),
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 创建 SVG Artifact
   */
  private createSVGArtifact(
    cellId: string,
    outputIndex: number,
    svgContent: string
  ): DetectedArtifact | null {
    if (!svgContent) return null;

    const id = this.generateId();
    const dimensions = this.extractSVGDimensions(svgContent);

    return {
      id,
      name: `SVG ${id.slice(-4)}`,
      cellId,
      outputIndex,
      type: 'image',
      mimeType: 'image/svg+xml',
      data: svgContent,
      size: new Blob([svgContent]).size,
      metadata: {
        width: dimensions.width,
        height: dimensions.height,
        format: 'SVG',
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 创建 Plotly 图表 Artifact
   */
  private createPlotlyArtifact(
    cellId: string,
    outputIndex: number,
    plotlyData: object
  ): DetectedArtifact | null {
    if (!plotlyData) return null;

    const id = this.generateId();
    const dataStr = JSON.stringify(plotlyData);

    return {
      id,
      name: `Chart ${id.slice(-4)}`,
      cellId,
      outputIndex,
      type: 'chart',
      mimeType: 'application/vnd.plotly.v1+json',
      data: plotlyData,
      size: new Blob([dataStr]).size,
      metadata: {
        format: 'Plotly',
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 创建 DataFrame Artifact
   */
  private createDataFrameArtifact(
    cellId: string,
    outputIndex: number,
    html: string
  ): DetectedArtifact | null {
    if (!html) return null;

    const id = this.generateId();
    const dimensions = this.extractTableDimensions(html);

    return {
      id,
      name: `DataFrame ${id.slice(-4)}`,
      cellId,
      outputIndex,
      type: 'dataframe',
      mimeType: 'text/html',
      data: html,
      size: new Blob([html]).size,
      metadata: {
        rows: dimensions.rows,
        columns: dimensions.columns,
        format: 'DataFrame',
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 检测是否是 DataFrame HTML
   */
  private isDataFrame(html: string): boolean {
    // pandas DataFrame 特征
    if (html.includes('dataframe') || html.includes('DataFrame')) {
      return true;
    }
    // 通用表格检测
    if (html.includes('<table') && html.includes('<thead') && html.includes('<tbody')) {
      return true;
    }
    return false;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    this.idCounter++;
    return `artifact_${Date.now()}_${this.idCounter}`;
  }

  /**
   * 估算 Base64 数据大小
   */
  private estimateBase64Size(base64: string): number {
    // Base64 编码约增加 33% 大小
    return Math.floor((base64.length * 3) / 4);
  }

  /**
   * 提取图片尺寸 (简化实现)
   */
  private extractImageDimensions(base64: string, mimeType: string): { width?: number; height?: number } {
    // 对于 PNG，可以从 header 中提取
    // 这里简化处理，返回未知
    return {};
  }

  /**
   * 提取 SVG 尺寸
   */
  private extractSVGDimensions(svg: string): { width?: number; height?: number } {
    const widthMatch = svg.match(/width="(\d+)/);
    const heightMatch = svg.match(/height="(\d+)/);
    
    return {
      width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
      height: heightMatch ? parseInt(heightMatch[1], 10) : undefined,
    };
  }

  /**
   * 提取表格尺寸
   */
  private extractTableDimensions(html: string): { rows?: number; columns?: number } {
    const rowMatches = html.match(/<tr/g);
    const headerMatches = html.match(/<th/g);
    
    return {
      rows: rowMatches ? Math.max(0, rowMatches.length - 1) : undefined, // 减去 header 行
      columns: headerMatches ? headerMatches.length : undefined,
    };
  }

  /**
   * 创建缩略图 (简化实现)
   */
  private createThumbnail(base64: string, mimeType: string): string | undefined {
    // 直接使用原图作为缩略图
    // 生产环境可以使用 canvas 缩放
    return `data:${mimeType};base64,${base64}`;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const artifactDetector = new ArtifactDetector();

export function detectArtifacts(cellId: string, output: Output, outputIndex: number): DetectedArtifact[] {
  return artifactDetector.detect(cellId, output, outputIndex);
}

export function detectAllArtifacts(cellId: string, outputs: Output[]): DetectionResult {
  return artifactDetector.detectAll(cellId, outputs);
}
