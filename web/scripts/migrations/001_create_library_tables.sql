-- ==============================================================================
-- Prismer Library - 远程数据库迁移脚本
-- ==============================================================================
-- 
-- 目标数据库: prismer_info (MySQL)
-- 创建时间: 2026-01-13
-- 
-- ⚠️ 安全说明:
--   - 本脚本只创建新表，不修改现有表
--   - 所有表使用 `library_` 前缀
--   - 使用 IF NOT EXISTS 防止重复创建
-- 
-- 执行方式:
--   mysql -h <host> -u <user> -p prismer_info < 001_create_library_tables.sql
-- 
-- ==============================================================================

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ==============================================================================
-- 1. 用户表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_users (
  id VARCHAR(64) NOT NULL COMMENT '用户ID (来自认证服务)',
  email VARCHAR(255) NOT NULL COMMENT '邮箱',
  name VARCHAR(128) DEFAULT NULL COMMENT '显示名称',
  avatar VARCHAR(512) DEFAULT NULL COMMENT '头像URL',
  bio TEXT COMMENT '个人简介',
  organization VARCHAR(256) DEFAULT NULL COMMENT '组织/机构',
  
  -- OAuth 关联 (冗余存储，便于查询)
  google_id VARCHAR(128) DEFAULT NULL COMMENT 'Google OAuth ID',
  github_id VARCHAR(128) DEFAULT NULL COMMENT 'GitHub OAuth ID',
  
  -- 状态
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
  email_verified TINYINT(1) DEFAULT 0 COMMENT '邮箱已验证',
  
  -- 偏好设置
  preferences JSON COMMENT '用户偏好设置 (主题、语言等)',
  
  -- 时间戳
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_email (email),
  UNIQUE KEY uk_google_id (google_id),
  UNIQUE KEY uk_github_id (github_id),
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Library 用户表';

-- ==============================================================================
-- 2. 笔记本表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_notebooks (
  id VARCHAR(64) NOT NULL COMMENT '笔记本ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '所属用户ID',
  
  name VARCHAR(256) NOT NULL COMMENT '笔记本名称',
  description TEXT COMMENT '描述',
  color VARCHAR(32) DEFAULT NULL COMMENT '颜色标识',
  icon VARCHAR(64) DEFAULT NULL COMMENT '图标',
  is_public TINYINT(1) DEFAULT 0 COMMENT '是否公开',
  
  -- 排序
  sort_order INT DEFAULT 0 COMMENT '排序权重',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_user_sort (user_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户笔记本';

-- ==============================================================================
-- 3. 笔记表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_notes (
  id VARCHAR(64) NOT NULL COMMENT '笔记ID (CUID)',
  notebook_id VARCHAR(64) NOT NULL COMMENT '所属笔记本',
  user_id VARCHAR(64) NOT NULL COMMENT '所属用户',
  
  title VARCHAR(512) DEFAULT NULL COMMENT '标题',
  content LONGTEXT COMMENT '内容 (HTML/Markdown)',
  content_format ENUM('html', 'markdown', 'json') DEFAULT 'html' COMMENT '内容格式',
  
  -- 标签
  tags JSON COMMENT '标签列表',
  
  -- 元数据
  word_count INT DEFAULT 0 COMMENT '字数统计',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_notebook (notebook_id),
  KEY idx_user_id (user_id),
  KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户笔记';

-- ==============================================================================
-- 4. 笔记引用表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_note_citations (
  id VARCHAR(64) NOT NULL COMMENT '引用ID (CUID)',
  note_id VARCHAR(64) NOT NULL COMMENT '笔记ID',
  paper_arxiv_id VARCHAR(64) NOT NULL COMMENT '论文 ArXiv ID',
  
  page_number INT DEFAULT NULL COMMENT '引用页码',
  excerpt TEXT COMMENT '引用片段',
  citation_type ENUM('text', 'figure', 'table', 'equation') DEFAULT 'text',
  
  -- 位置信息 (可选)
  position_data JSON COMMENT '高亮位置信息',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_note (note_id),
  KEY idx_paper (paper_arxiv_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='笔记论文引用';

-- ==============================================================================
-- 5. 用户收藏表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_favorites (
  id VARCHAR(64) NOT NULL COMMENT '收藏ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) NOT NULL COMMENT '论文 ArXiv ID',
  
  -- 分组 (可选)
  folder VARCHAR(128) DEFAULT NULL COMMENT '收藏夹分组',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_paper (user_id, paper_arxiv_id),
  KEY idx_user (user_id),
  KEY idx_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户收藏';

-- ==============================================================================
-- 6. 用户点赞表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_likes (
  id VARCHAR(64) NOT NULL COMMENT '点赞ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) NOT NULL COMMENT '论文 ArXiv ID',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_paper (user_id, paper_arxiv_id),
  KEY idx_paper (paper_arxiv_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户点赞';

-- ==============================================================================
-- 7. 评论表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_comments (
  id VARCHAR(64) NOT NULL COMMENT '评论ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) NOT NULL COMMENT '论文 ArXiv ID',
  parent_id VARCHAR(64) DEFAULT NULL COMMENT '父评论ID (回复)',
  
  content TEXT NOT NULL COMMENT '评论内容',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  is_deleted TINYINT(1) DEFAULT 0 COMMENT '已删除',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_paper (paper_arxiv_id),
  KEY idx_user (user_id),
  KEY idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='论文评论';

-- ==============================================================================
-- 8. 用户活动日志表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_activities (
  id VARCHAR(64) NOT NULL COMMENT '活动ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) DEFAULT NULL COMMENT '相关论文',
  
  action ENUM('view', 'like', 'favorite', 'comment', 'download', 'search', 'share', 'export') NOT NULL COMMENT '行为类型',
  metadata JSON COMMENT '附加数据',
  
  -- 来源信息
  source VARCHAR(64) DEFAULT NULL COMMENT '来源 (web, mobile, api)',
  ip_address VARCHAR(64) DEFAULT NULL COMMENT 'IP地址',
  user_agent VARCHAR(512) DEFAULT NULL COMMENT 'User Agent',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_user_time (user_id, created_at),
  KEY idx_action (action),
  KEY idx_paper (paper_arxiv_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户活动日志';

-- ==============================================================================
-- 9. 用户论文状态表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_user_paper_states (
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) NOT NULL COMMENT '论文 ArXiv ID',
  
  is_favorite TINYINT(1) DEFAULT 0 COMMENT '已收藏',
  is_downloaded TINYINT(1) DEFAULT 0 COMMENT '已下载',
  
  -- 阅读进度
  reading_progress INT DEFAULT 0 COMMENT '阅读进度 (0-100)',
  last_read_page INT DEFAULT 0 COMMENT '最后阅读页码',
  total_read_time INT DEFAULT 0 COMMENT '总阅读时长 (秒)',
  last_read_at DATETIME DEFAULT NULL COMMENT '最后阅读时间',
  
  -- AI 分析缓存
  ai_summary TEXT COMMENT 'AI 生成的摘要',
  ai_insights JSON COMMENT 'AI 生成的洞察',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, paper_arxiv_id),
  KEY idx_user (user_id),
  KEY idx_last_read (user_id, last_read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户论文阅读状态';

-- ==============================================================================
-- 10. AI 会话表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_ai_sessions (
  id VARCHAR(64) NOT NULL COMMENT '会话ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  paper_arxiv_id VARCHAR(64) DEFAULT NULL COMMENT '关联论文 (可选)',
  
  title VARCHAR(256) DEFAULT NULL COMMENT '会话标题',
  session_type ENUM('paper_qa', 'general', 'research') DEFAULT 'paper_qa' COMMENT '会话类型',
  
  -- 会话上下文
  context JSON COMMENT '会话上下文 (论文列表、设置等)',
  
  -- 消息统计
  message_count INT DEFAULT 0 COMMENT '消息数量',
  
  -- 状态
  is_archived TINYINT(1) DEFAULT 0 COMMENT '已归档',
  is_pinned TINYINT(1) DEFAULT 0 COMMENT '已置顶',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_user (user_id),
  KEY idx_paper (paper_arxiv_id),
  KEY idx_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI 对话会话';

-- ==============================================================================
-- 11. AI 消息表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_ai_messages (
  id VARCHAR(64) NOT NULL COMMENT '消息ID (CUID)',
  session_id VARCHAR(64) NOT NULL COMMENT '会话ID',
  
  role ENUM('user', 'assistant', 'system') NOT NULL COMMENT '角色',
  content LONGTEXT NOT NULL COMMENT '消息内容',
  
  -- AI 元数据
  model VARCHAR(64) DEFAULT NULL COMMENT '使用的模型',
  tokens_used INT DEFAULT NULL COMMENT '使用的 Token 数',
  
  -- 引用
  citations JSON COMMENT '论文引用信息',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_session (session_id),
  KEY idx_session_time (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI 对话消息';

-- ==============================================================================
-- 12. 用户偏好分类表
-- ==============================================================================

CREATE TABLE IF NOT EXISTS library_user_categories (
  id VARCHAR(64) NOT NULL COMMENT 'ID (CUID)',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  
  category_id VARCHAR(64) NOT NULL COMMENT '分类ID',
  category_name VARCHAR(128) NOT NULL COMMENT '分类名称',
  category_color VARCHAR(32) DEFAULT NULL COMMENT '颜色',
  category_keywords JSON COMMENT '关键词 (自定义分类)',
  
  is_custom TINYINT(1) DEFAULT 0 COMMENT '是否自定义分类',
  is_visible TINYINT(1) DEFAULT 1 COMMENT '是否显示',
  sort_order INT DEFAULT 0 COMMENT '排序',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_category (user_id, category_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户自定义分类偏好';

-- ==============================================================================
-- 验证创建结果
-- ==============================================================================

SELECT 
  TABLE_NAME,
  TABLE_COMMENT,
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'prismer_info' 
  AND TABLE_NAME LIKE 'library_%'
ORDER BY CREATE_TIME;

-- ==============================================================================
-- 完成
-- ==============================================================================
-- 
-- 已创建 12 个 library_* 表:
--   1. library_users              - 用户
--   2. library_notebooks          - 笔记本
--   3. library_notes              - 笔记
--   4. library_note_citations     - 笔记引用
--   5. library_favorites          - 收藏
--   6. library_likes              - 点赞
--   7. library_comments           - 评论
--   8. library_activities         - 活动日志
--   9. library_user_paper_states  - 论文阅读状态
--  10. library_ai_sessions        - AI 会话
--  11. library_ai_messages        - AI 消息
--  12. library_user_categories    - 用户分类偏好
-- 
-- ==============================================================================
