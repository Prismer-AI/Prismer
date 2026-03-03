-- ============================================================================
-- po_user_assets 表创建脚本
-- 
-- 用途: 存储用户的 Paper Card 和 Note 资产
-- 执行: mysql -h 34.207.64.245 -u root -p prismer_info < scripts/db/create_po_user_assets.sql
-- ============================================================================

-- 检查表是否已存在
SELECT 'Checking if po_user_assets exists...' AS status;
SELECT COUNT(*) AS table_exists FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_assets';

-- 创建表
CREATE TABLE IF NOT EXISTS po_user_assets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,              -- FK → users.id
  
  -- 资产类型 (当前只实现 paper 和 note)
  asset_type ENUM('paper', 'note') NOT NULL DEFAULT 'paper',
  
  -- 基本信息
  title VARCHAR(1000) NOT NULL,
  description TEXT,
  
  -- =====================================================
  -- Paper 特有字段
  -- =====================================================
  
  -- 来源信息
  source ENUM('documents', 'upload') DEFAULT 'upload',
  document_id BIGINT UNSIGNED,                   -- FK → documents.id (如果来自公共库)
  source_id VARCHAR(100),                        -- 来源唯一 ID (如 arxivId)
  
  -- 元数据 (JSON) - 与 documents 表字段对齐
  metadata JSON COMMENT '{"title":"...","authors":["..."],"abstract":"...","published_at":"2025-01-01T00:00:00Z","categories":["cs.AI"],"doi":"...","venue":"..."}',
  
  -- OCR 处理状态
  ocr_status ENUM('none', 'pending', 'processing', 'completed', 'failed') DEFAULT 'none',
  ocr_task_id VARCHAR(100),                      -- Parser API 返回的 task_id
  ocr_progress TINYINT UNSIGNED DEFAULT 0,       -- 处理进度 0-100
  ocr_started_at DATETIME,
  ocr_completed_at DATETIME,
  ocr_error TEXT,
  
  -- 存储路径
  pdf_s3_key VARCHAR(255),                       -- S3 存储的 PDF 路径
  cdn_base_path VARCHAR(255),                    -- CDN 存储前缀
  cdn_domain VARCHAR(100) DEFAULT 'cdn.prismer.ai',
  
  -- OCR 结果统计 (与 documents 表对齐)
  page_count INT UNSIGNED DEFAULT 0,
  image_count INT UNSIGNED DEFAULT 0,
  table_count INT UNSIGNED DEFAULT 0,
  equation_count INT UNSIGNED DEFAULT 0,
  detection_count INT UNSIGNED DEFAULT 0,
  reference_count INT UNSIGNED DEFAULT 0,
  char_count INT UNSIGNED DEFAULT 0,
  
  -- =====================================================
  -- Note 特有字段
  -- =====================================================
  
  -- 关联的 Paper (仅 note 类型使用)
  paper_asset_id BIGINT UNSIGNED,                -- FK → po_user_assets.id
  
  -- Note 内容
  content TEXT,                                  -- Markdown 格式内容
  note_type ENUM('highlight', 'summary', 'comment', 'extract'),
  
  -- 来源位置 (JSON)
  source_location JSON COMMENT '{"page_number":1,"detection_id":"p1_text_0","bbox":{"x1":0,"y1":0,"x2":100,"y2":100}}',
  
  -- =====================================================
  -- 通用字段
  -- =====================================================
  
  tags JSON,                                      -- 标签列表 (默认 NULL，应用层处理为 [])
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  
  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_asset_type (asset_type),
  INDEX idx_ocr_status (ocr_status),
  INDEX idx_document_id (document_id),
  INDEX idx_source_id (source_id),
  INDEX idx_paper_asset_id (paper_asset_id),
  UNIQUE INDEX idx_user_document (user_id, document_id),
  INDEX idx_created_at (created_at),
  INDEX idx_is_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户资产表 - Paper Card 和 Note';

-- 验证创建结果
SELECT 'po_user_assets table created successfully!' AS status;
DESCRIBE po_user_assets;
