-- ============================================================================
-- po_ 表删除脚本 (谨慎使用!)
-- 
-- 用途: 删除所有 po_ 前缀表 (仅在需要重建时使用)
-- 执行: mysql -h 34.207.64.245 -u root -p prismer_info < scripts/db/drop_po_tables.sql
-- ============================================================================

-- ⚠️ 警告: 此操作不可逆，会删除所有数据!

SELECT '⚠️ WARNING: This will DROP all po_ tables!' AS '';
SELECT 'Tables to be dropped:' AS '';
SHOW TABLES LIKE 'po_%';

-- 按依赖顺序删除 (先删关联表)
DROP TABLE IF EXISTS po_collection_assets;
DROP TABLE IF EXISTS po_user_collections;
DROP TABLE IF EXISTS po_user_assets;

SELECT '✅ All po_ tables dropped.' AS '';
SHOW TABLES LIKE 'po_%';
