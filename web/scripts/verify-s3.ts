/**
 * S3 连接验证脚本
 * 运行: npx tsx scripts/verify-s3.ts
 */

import 'dotenv/config';
import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';

async function verifyS3Connection() {
  console.log('🔍 验证 S3 连接...\n');
  
  // 检查环境变量
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  console.log('📋 配置检查:');
  console.log(`   Bucket: ${bucket || '❌ 未配置'}`);
  console.log(`   Region: ${region || '❌ 未配置'}`);
  console.log(`   AccessKeyId: ${accessKeyId ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   SecretAccessKey: ${secretAccessKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');
  
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    console.error('❌ 缺少必要的环境变量');
    process.exit(1);
  }
  
  // 创建 S3 客户端
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  
  try {
    // 测试 1: 验证 Bucket 访问权限
    console.log('🧪 测试 1: 验证 Bucket 访问权限...');
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`   ✅ Bucket "${bucket}" 可访问\n`);
    
    // 测试 2: 列出对象
    console.log('🧪 测试 2: 列出 Bucket 内容...');
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 5,
      Prefix: 'ocr/',
    }));
    
    console.log(`   ✅ 找到 ${listResult.KeyCount || 0} 个对象 (显示前 5 个):`);
    if (listResult.Contents) {
      listResult.Contents.slice(0, 5).forEach((obj, i) => {
        console.log(`      ${i + 1}. ${obj.Key}`);
      });
    }
    console.log('');
    
    console.log('🎉 S3 连接验证成功！');
    console.log(`   CDN URL 示例: https://${process.env.CDN_DOMAIN}/ocr/...`);
    
  } catch (error: any) {
    console.error('❌ S3 连接失败:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error('   Bucket 不存在');
    } else if (error.name === 'AccessDenied') {
      console.error('   访问被拒绝，请检查 IAM 权限');
    } else if (error.name === 'CredentialsProviderError') {
      console.error('   凭证无效');
    }
    
    process.exit(1);
  }
}

verifyS3Connection();
