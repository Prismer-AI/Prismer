-- ============================================================================
-- po_user_collections 表创建脚本
-- 
-- 用途: 存储用户的收藏夹/文件夹
-- 执行: mysql -h 34.207.64.245 -u root -p prismer_info < scripts/db/create_po_user_collections.sql
-- ============================================================================

-- 检查表是否已存在
SELECT 'Checking if po_user_collections exists...' AS status;
SELECT COUNT(*) AS table_exists FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_collections';

-- 创建表
CREATE TABLE IF NOT EXISTS po_user_collections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,              -- FK → users.id
  
  -- 收藏夹信息
  name VARCHAR(200) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#3B82F6',           -- 默认蓝色
  icon VARCHAR(50),                              -- 图标名称
  
  -- 排序
  sort_order INT NOT NULL DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  
  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_sort_order (user_id, sort_order),
  INDEX idx_is_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户收藏夹表';

-- 验证创建结果
SELECT 'po_user_collections table created successfully!' AS status;
DESCRIBE po_user_collections;
