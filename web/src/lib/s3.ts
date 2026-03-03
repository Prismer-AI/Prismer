/**
 * AWS S3 客户端封装
 * 
 * 功能:
 * - S3 客户端单例
 * - 预签名 URL 生成
 * - CDN URL 生成
 */

import { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================
// 动态配置
// ============================================================

function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('[S3] AWS_S3_BUCKET is not configured. Set it in .env or environment variables.');
  }
  return bucket;
}

function getRegion() {
  return process.env.AWS_REGION || 'us-east-1';
}

function getCdnDomain() {
  return process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_DOMAIN || '';
}

// 导出配置 getter（向后兼容）
export const BUCKET = { toString: () => getBucket(), valueOf: () => getBucket() } as unknown as string;
export const REGION = { toString: () => getRegion(), valueOf: () => getRegion() } as unknown as string;
export const CDN_DOMAIN = { toString: () => getCdnDomain(), valueOf: () => getCdnDomain() } as unknown as string;

// ============================================================
// S3 客户端（懒加载，配置变化时重建）
// ============================================================

let _s3Client: S3Client | null = null;
let _s3ConfigKey: string | null = null;

function getS3ConfigKey() {
  return `${getRegion()}:${process.env.AWS_ACCESS_KEY_ID || ''}`;
}

function getS3Client(): S3Client {
  const configKey = getS3ConfigKey();
  
  // 配置变化时重建客户端
  if (_s3Client && _s3ConfigKey !== configKey) {
    console.log('[S3] Config changed, recreating client');
    _s3Client.destroy();
    _s3Client = null;
  }
  
  if (!_s3Client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('[S3] AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured.');
    }
    console.log(`[S3] Creating client for region: ${getRegion()}`);
    _s3Client = new S3Client({
      region: getRegion(),
      credentials: { accessKeyId, secretAccessKey },
    });
    _s3ConfigKey = configKey;
  }
  
  return _s3Client;
}

// 向后兼容导出
export const s3Client = new Proxy({} as S3Client, {
  get(_, prop) {
    const client = getS3Client();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// ============================================================
// 路径生成
// ============================================================

/**
 * S3 路径模板
 */
export const S3_PATHS = {
  /** 用户上传的 PDF */
  upload: (userId: string, uploadId: string, fileName: string) =>
    `uploads/${userId}/${uploadId}/${fileName}`,
  
  /** OCR 输出目录 */
  ocr: (docId: string) =>
    `ocr/v1/${docId}/`,
  
  /** OCR 输出的 Markdown */
  ocrMarkdown: (docId: string) =>
    `ocr/v1/${docId}/output.md`,
  
  /** OCR 输出的图片 */
  ocrImage: (docId: string, imageName: string) =>
    `ocr/v1/${docId}/images/${imageName}`,
  
  /** 导出文件 */
  export: (userId: string, jobId: string, fileName: string) =>
    `exports/${userId}/${jobId}/${fileName}`,
  
  /** 用户头像 */
  avatar: (userId: string, fileName: string) =>
    `avatars/${userId}/${fileName}`,
};

// ============================================================
// URL 生成
// ============================================================

/**
 * 生成 CDN URL
 */
export function getCdnUrl(s3Key: string): string {
  return `https://${getCdnDomain()}/${s3Key}`;
}

/**
 * 生成 S3 直接 URL
 */
export function getS3Url(s3Key: string): string {
  return `https://${getBucket()}.s3.${getRegion()}.amazonaws.com/${s3Key}`;
}

/**
 * 生成上传预签名 URL
 */
export async function getUploadUrl(
  s3Key: string,
  contentType: string = 'application/pdf',
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    ContentType: contentType,
  });
  
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * 生成下载预签名 URL
 */
export async function getDownloadUrl(
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

// ============================================================
// 文件操作
// ============================================================

/**
 * 列出目录内容
 */
export async function listObjects(prefix: string, maxKeys: number = 100) {
  const command = new ListObjectsV2Command({
    Bucket: getBucket(),
    Prefix: prefix,
    MaxKeys: maxKeys,
  });
  
  const result = await getS3Client().send(command);
  return result.Contents || [];
}

/**
 * 删除文件
 */
export async function deleteObject(s3Key: string) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  
  await getS3Client().send(command);
}

/**
 * 读取文件内容 (文本)
 */
export async function getObjectAsText(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  
  const result = await getS3Client().send(command);
  return await result.Body?.transformToString() || '';
}

/**
 * 读取 JSON 文件
 */
export async function getObjectAsJson<T = unknown>(s3Key: string): Promise<T> {
  const text = await getObjectAsText(s3Key);
  return JSON.parse(text) as T;
}

// ============================================================
// 额外导出
// ============================================================

export { getSignedUrl };
