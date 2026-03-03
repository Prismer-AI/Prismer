-- ============================================================================
-- po_ 表验证脚本
-- 
-- 用途: 验证所有 po_ 前缀表是否创建成功
-- 执行: mysql -h 34.207.64.245 -u root -p prismer_info < scripts/db/verify_po_tables.sql
-- ============================================================================

SELECT '========== PO Tables Verification ==========' AS '';

-- 1. 列出所有 po_ 表
SELECT 'Step 1: Listing all po_ tables...' AS status;
SHOW TABLES LIKE 'po_%';

-- 2. 验证 po_user_assets
SELECT '\n========== po_user_assets ==========' AS '';
SELECT 
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_assets') AS table_exists;
SELECT COUNT(*) AS row_count FROM po_user_assets;

-- 3. 验证 po_user_collections
SELECT '\n========== po_user_collections ==========' AS '';
SELECT 
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_collections') AS table_exists;
SELECT COUNT(*) AS row_count FROM po_user_collections;

-- 4. 验证 po_collection_assets
SELECT '\n========== po_collection_assets ==========' AS '';
SELECT 
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_collection_assets') AS table_exists;
SELECT COUNT(*) AS row_count FROM po_collection_assets;

-- 5. 显示各表结构
SELECT '\n========== Table Structures ==========' AS '';

SELECT 'po_user_assets columns:' AS '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_assets'
ORDER BY ORDINAL_POSITION;

SELECT '\npo_user_collections columns:' AS '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_user_collections'
ORDER BY ORDINAL_POSITION;

SELECT '\npo_collection_assets columns:' AS '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'po_collection_assets'
ORDER BY ORDINAL_POSITION;

SELECT '\n========== Verification Complete ==========' AS '';
