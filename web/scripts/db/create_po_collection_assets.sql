-- ============================================================================
-- po_collection_assets 表创建脚本
-- 
-- 用途: 收藏夹与资产的多对多关联
-- 执行: mysql -h 34.207.64.245 -u root -p prismer_info < scripts/db/create_po_collection_assets.sql
-- ============================================================================

-- 检查表是否已存在
SELECT 'Checking if po_collection_assets exists...' AS status;
SELECT COUNT(*) AS table_exists FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_collection_assets';

-- 创建表
CREATE TABLE IF NOT EXISTS po_collection_assets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  collection_id BIGINT UNSIGNED NOT NULL,        -- FK → po_user_collections.id
  asset_id BIGINT UNSIGNED NOT NULL,             -- FK → po_user_assets.id
  
  -- 在收藏夹中的排序
  sort_order INT NOT NULL DEFAULT 0,
  
  -- 时间戳
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 唯一约束: 同一资产不能重复添加到同一收藏夹
  UNIQUE INDEX idx_collection_asset (collection_id, asset_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_sort_order (collection_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='收藏夹与资产的多对多关联表';

-- 验证创建结果
SELECT 'po_collection_assets table created successfully!' AS status;
DESCRIBE po_collection_assets;
