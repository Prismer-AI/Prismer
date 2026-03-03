/**
 * Paper Context Provider
 * 
 * 负责加载和管理论文上下文数据
 * 支持从文件、URL、ArXiv 等多种来源加载
 */

import {
  PDFSource,
  PaperContext,
  PaperMetadata,
  OCRResult,
  PageDetection,
  ImageAsset,
  IPaperContextProvider,
  createEmptyPaperContext,
} from '@/types/paperContext';

/**
 * OCR 数据的基础路径
 * 使用 API 路由，支持本地和远程数据源切换
 */
const OCR_DATA_BASE_PATH = '/api/ocr';

/**
 * Paper Context Provider 实现
 */
export class PaperContextProvider implements IPaperContextProvider {
  private basePath: string;

  constructor(basePath: string = OCR_DATA_BASE_PATH) {
    this.basePath = basePath;
  }

  /**
   * 从 PDF Source 加载完整上下文
   *
   * 三级回退链:
   * - L3 hires: detections + markdown + images (完整 overlay)
   * - L2 fast:  markdown 可用但无 detections (基础 AI 分析)
   * - L1 raw:   无 OCR 数据 (PDF.js 直接渲染)
   */
  async loadContext(source: PDFSource): Promise<PaperContext> {
    const context = createEmptyPaperContext(source);
    context.loadingState = 'loading_pdf';

    try {
      if (source.arxivId) {
        context.loadingState = 'loading_ocr';
        const ocrData = await this.loadOCRData(source.arxivId);

        if (ocrData && ocrData.detections.length > 0) {
          // L3 hires: full detection overlay + images
          context.metadata = ocrData.metadata;
          context.detections = ocrData.detections;
          context.hasOCRData = true;
          context.ocrLevel = 'L3_hires';

          if (ocrData.ocrResult) {
            context.markdown = ocrData.ocrResult.markdown_content;
            context.pages = ocrData.ocrResult.pages;
          }

          context.images = await this.loadImageAssets(source.arxivId, ocrData.detections);
        } else if (ocrData?.ocrResult?.markdown_content) {
          // L2 fast: markdown available but no detections
          context.metadata = ocrData.metadata;
          context.markdown = ocrData.ocrResult.markdown_content;
          context.pages = ocrData.ocrResult.pages;
          context.hasOCRData = true;
          context.ocrLevel = 'L2_fast';
        } else {
          // L2 fallback: try fetching just paper.md
          const mdFallback = await this.loadMarkdownFallback(source.arxivId);
          if (mdFallback) {
            context.metadata = ocrData?.metadata ?? null;
            context.markdown = mdFallback;
            context.hasOCRData = true;
            context.ocrLevel = 'L2_fast';
          }
          // else: L1 raw (default from createEmptyPaperContext)
        }
      }
      // No arxivId → stays L1_raw (default)

      context.loadingState = 'ready';
      return context;
    } catch (error) {
      context.loadingState = 'error';
      context.error = error instanceof Error ? error.message : 'Unknown error';
      return context;
    }
  }

  /**
   * 加载 OCR 预处理数据
   * 从 public/data/output 文件夹加载
   */
  async loadOCRData(arxivId: string): Promise<{
    metadata: PaperMetadata | null;
    ocrResult: OCRResult | null;
    detections: PageDetection[];
  } | null> {
    try {
      // 使用 API 路由格式：/api/ocr/{arxivId}/{file}
      const basePath = `${this.basePath}/${arxivId}`;

      // 并行加载所有数据文件
      const [metadataRes, ocrRes, detectionsRes] = await Promise.allSettled([
        fetch(`${basePath}/metadata.json`),
        fetch(`${basePath}/ocr_result.json`),
        fetch(`${basePath}/detections.json`),
      ]);

      let metadata: PaperMetadata | null = null;
      let ocrResult: OCRResult | null = null;
      let detections: PageDetection[] = [];

      // 解析 metadata
      if (metadataRes.status === 'fulfilled' && metadataRes.value.ok) {
        metadata = await metadataRes.value.json();
      }

      // 解析 OCR 结果
      if (ocrRes.status === 'fulfilled' && ocrRes.value.ok) {
        ocrResult = await ocrRes.value.json();
      }

      // 解析检测结果
      if (detectionsRes.status === 'fulfilled' && detectionsRes.value.ok) {
        detections = await detectionsRes.value.json();
      }

      // 如果没有任何数据，返回 null
      if (!metadata && !ocrResult && detections.length === 0) {
        return null;
      }

      return { metadata, ocrResult, detections };
    } catch (error) {
      console.error('Failed to load OCR data:', error);
      return null;
    }
  }

  /**
   * L2 回退: 单独加载 markdown 内容 (当完整 OCR 数据不可用时)
   */
  private async loadMarkdownFallback(arxivId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.basePath}/${arxivId}/paper.md`);
      if (res.ok) return await res.text();
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 检查是否有预处理数据
   */
  async hasPreprocessedData(arxivId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.basePath}/${arxivId}/metadata.json`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 加载图像资源列表
   * 从 public/data/output/{arxivId}/images 加载
   */
  private async loadImageAssets(
    arxivId: string,
    detections: PageDetection[]
  ): Promise<ImageAsset[]> {
    const images: ImageAsset[] = [];
    // 使用 API 路由格式：/api/ocr/{arxivId}/images/{filename}
    const basePath = `${this.basePath}/${arxivId}/images`;

    for (const page of detections) {
      const imageDetections = page.detections.filter(d => d.label === 'image');
      
      for (let i = 0; i < imageDetections.length; i++) {
        const detection = imageDetections[i];
        const filename = `page${page.page_number}_img${i}.jpg`;
        
        images.push({
          id: `${page.page_number}-${i}`,
          page: page.page_number,
          filename,
          path: `${basePath}/${filename}`,
          bbox: detection.boxes[0],
          caption: this.findCaption(page.detections, detection),
        });
      }
    }

    return images;
  }

  /**
   * 查找图像的说明文字
   */
  private findCaption(
    detections: PageDetection['detections'],
    imageDetection: PageDetection['detections'][0]
  ): string | undefined {
    // 查找紧随图像之后的 caption
    const imageBox = imageDetection.boxes[0];
    if (!imageBox) return undefined;

    const captions = detections.filter(d => d.label === 'image_caption');
    
    // 找到距离图像最近的 caption (在图像下方)
    let closestCaption: typeof captions[0] | undefined;
    let minDistance = Infinity;

    for (const caption of captions) {
      const captionBox = caption.boxes[0];
      if (!captionBox) continue;

      // caption 应该在图像下方
      if (captionBox.y1_px > imageBox.y2_px) {
        const distance = captionBox.y1_px - imageBox.y2_px;
        if (distance < minDistance && distance < 100) { // 100px 阈值
          minDistance = distance;
          closestCaption = caption;
        }
      }
    }

    return closestCaption?.raw_text;
  }
}

/**
 * 创建默认的 Provider 实例
 */
export function createPaperContextProvider(basePath?: string): IPaperContextProvider {
  return new PaperContextProvider(basePath);
}

/**
 * 单例实例
 */
let defaultProvider: IPaperContextProvider | null = null;

export function getDefaultPaperContextProvider(): IPaperContextProvider {
  if (!defaultProvider) {
    defaultProvider = new PaperContextProvider();
  }
  return defaultProvider;
}

