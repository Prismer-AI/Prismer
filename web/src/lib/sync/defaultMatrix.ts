/**
 * Default Sync Control Matrix
 *
 * 默认同步控制矩阵配置
 * 定义所有内置数据类型的同步规则
 */

import type { SyncControlMatrix, SyncRule } from './types';
import { DATA_TYPES } from './types';
import { rule } from './SyncMatrixEngine';

// ============================================================
// Default Rules
// ============================================================

/**
 * 消息规则 - 聊天消息
 */
const messagesRule: SyncRule = rule(DATA_TYPES.MESSAGES, '聊天消息')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'readwrite')
  .endpoint('web', 'readwrite')
  .endpoint('agent', 'read')
  .persist('database', { table: 'workspace_messages' })
  .bidirectional('server_wins')
  .throttle(100)
  .interactions({
    canTrigger: ['desktop', 'mobile', 'web'],
    targetEndpoints: ['server'],
  })
  .build();

/**
 * 任务规则 - 任务列表
 */
const tasksRule: SyncRule = rule(DATA_TYPES.TASKS, '任务列表')
  .serverOwned()
  .endpoint('desktop', 'read')
  .endpoint('mobile', 'read')
  .endpoint('agent', 'readwrite')
  .persist('database', { table: 'workspace_tasks' })
  .broadcast()
  .build();

/**
 * 参与者规则 - 参与者列表
 */
const participantsRule: SyncRule = rule(DATA_TYPES.PARTICIPANTS, '参与者列表')
  .serverOwned()
  .endpoint('desktop', 'read')
  .endpoint('mobile', 'read')
  .persist('database', { table: 'workspace_participants' })
  .broadcast()
  .build();

/**
 * 已完成交互规则
 */
const completedInteractionsRule: SyncRule = rule(DATA_TYPES.COMPLETED_INTERACTIONS, '已完成的交互组件')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'readwrite')
  .persist('database')
  .bidirectional('merge')
  .interactions({
    canTrigger: ['desktop', 'mobile'],
    targetEndpoints: ['server'],
  })
  .build();

/**
 * 时间线规则 - 时间线事件历史
 */
const timelineRule: SyncRule = rule(DATA_TYPES.TIMELINE, '时间线事件历史')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'read')  // 移动端只读时间线
  .endpoint('agent', 'readwrite')
  .persist('database', { 
    table: 'timeline_events',
    maxItems: 1000,  // 限制时间线事件数量
  })
  .bidirectional('merge')
  .throttle(500)
  .build();

/**
 * 状态快照规则 - 用于时间线回放
 */
const stateSnapshotsRule: SyncRule = rule(DATA_TYPES.STATE_SNAPSHOTS, '状态快照（用于时间线回放）')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'partial', { 
    filter: ['latest_only'],  // 移动端只需最新快照
  })
  .endpoint('agent', 'read')
  .persist('database', { 
    table: 'state_snapshots',
    maxItems: 100,
    compression: true,  // 快照可能很大，启用压缩
  })
  .broadcast()
  .build();

/**
 * 组件状态规则 - UI 组件内部状态
 */
const componentStatesRule: SyncRule = rule(DATA_TYPES.COMPONENT_STATES, 'UI 组件内部状态（编辑器内容、滚动位置等）')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'partial', {
    filter: ['chat', 'task_panel'],  // 移动端只关心部分组件
  })
  .endpoint('agent', 'read')
  .persist('database', { table: 'component_states' })
  .bidirectional('latest_wins')
  .throttle(200)
  .build();

/**
 * 当前激活组件规则
 */
const activeComponentRule: SyncRule = rule(DATA_TYPES.ACTIVE_COMPONENT, '当前激活的组件（WindowViewer 显示哪个）')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'none')  // 移动端没有组件切换
  .persist('memory')
  .broadcast()
  .build();

/**
 * Agent 状态规则
 */
const agentStateRule: SyncRule = rule(DATA_TYPES.AGENT_STATE, 'Agent 运行状态')
  .serverOwned()
  .endpoint('desktop', 'read')
  .endpoint('mobile', 'read')
  .endpoint('agent', 'write')
  .persist('memory')
  .broadcast()
  .build();

/**
 * UI 指令规则
 */
const uiDirectiveRule: SyncRule = rule(DATA_TYPES.UI_DIRECTIVE, 'UI 控制指令')
  .serverOwned()
  .endpoint('desktop', 'partial', {
    filter: ['full_ui'],  // 需要 full_ui 能力
    requiredCapabilities: ['full_ui'],
  })
  .endpoint('mobile', 'partial', {
    filter: ['notifications'],  // 只执行通知类指令
    requiredCapabilities: ['notifications'],
  })
  .endpoint('agent', 'write')  // Agent 可以生成指令
  .persist('none')
  .broadcast()
  .build();

/**
 * 布局状态规则 - 本地状态，不同步
 */
const layoutStateRule: SyncRule = rule(DATA_TYPES.LAYOUT_STATE, '布局状态（chatExpanded, taskPanelHeight 等）')
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'readwrite')
  .persist('none')
  .build();

// ============================================================
// Default Matrix
// ============================================================

/**
 * 研究笔记规则 (示例扩展数据类型)
 */
const researchNotesRule: SyncRule = rule('researchNotes', '研究笔记卡片')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'readwrite')
  .endpoint('web', 'readwrite')
  .endpoint('agent', 'read')
  .persist('database', { table: 'research_notes' })
  .bidirectional('merge')
  .throttle(1000)
  .interactions({
    canTrigger: ['desktop', 'mobile', 'web'],
    targetEndpoints: ['server', 'agent'],
    signalTypes: ['note_created', 'note_updated', 'note_deleted', 'note_linked'],
  })
  .build();

/**
 * 默认同步控制矩阵
 */
export const defaultSyncMatrix: SyncControlMatrix = {
  version: '1.0.0',
  rules: [
    // 核心会话数据
    messagesRule,
    tasksRule,
    participantsRule,
    completedInteractionsRule,
    
    // 时间线数据
    timelineRule,
    stateSnapshotsRule,
    
    // 组件状态
    componentStatesRule,
    activeComponentRule,
    
    // Agent 状态
    agentStateRule,
    
    // UI 指令
    uiDirectiveRule,
    
    // 本地状态
    layoutStateRule,
    
    // 扩展数据类型（示例）
    researchNotesRule,
  ],
  globalConfig: {
    defaultThrottleMs: 100,
    defaultTimeout: 30000,
    enableDebugLogging: process.env.NODE_ENV === 'development',
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 获取默认矩阵的副本
 */
export function getDefaultMatrix(): SyncControlMatrix {
  return JSON.parse(JSON.stringify(defaultSyncMatrix));
}

/**
 * 获取所有数据库持久化的表名
 */
export function getDatabaseTables(): string[] {
  return defaultSyncMatrix.rules
    .filter(r => r.persistence.strategy === 'database' && r.persistence.table)
    .map(r => r.persistence.table as string);
}

/**
 * 获取桌面端可读写的数据类型
 */
export function getDesktopWritableTypes(): string[] {
  return defaultSyncMatrix.rules
    .filter(r => {
      const config = r.endpoints.desktop;
      return config && (config.access === 'readwrite' || config.access === 'write');
    })
    .map(r => r.dataType);
}

/**
 * 获取移动端可读取的数据类型
 */
export function getMobileReadableTypes(): string[] {
  return defaultSyncMatrix.rules
    .filter(r => {
      const config = r.endpoints.mobile;
      return config && config.access !== 'none';
    })
    .map(r => r.dataType);
}

// ============================================================
// Predefined Rule Templates
// ============================================================

/**
 * 创建研究笔记规则模板
 * 示例：如何添加新的数据类型
 */
export function createResearchNotesRule(): SyncRule {
  return rule('researchNotes', '研究笔记卡片')
    .serverOwned()
    .endpoint('desktop', 'readwrite')
    .endpoint('mobile', 'readwrite')
    .endpoint('agent', 'read')
    .persist('database', { table: 'research_notes' })
    .bidirectional('merge')
    .throttle(1000)
    .interactions({
      canTrigger: ['desktop', 'mobile'],
      targetEndpoints: ['server', 'agent'],
      signalTypes: ['note_created', 'note_updated', 'note_deleted'],
    })
    .build();
}

/**
 * 创建协作白板规则模板
 */
export function createWhiteboardRule(): SyncRule {
  return rule('whiteboard', '协作白板状态')
    .serverOwned()
    .endpoint('desktop', 'readwrite')
    .endpoint('mobile', 'readwrite')
    .endpoint('web', 'readwrite')
    .persist('database', { table: 'whiteboard_state' })
    .bidirectional('merge')
    .throttle(50)  // 实时协作需要低延迟
    .build();
}

/**
 * 创建论文引用规则模板
 */
export function createPaperCitationsRule(): SyncRule {
  return rule('paperCitations', '论文引用收藏')
    .serverOwned()
    .endpoint('desktop', 'readwrite')
    .endpoint('mobile', 'read')  // 移动端只读
    .endpoint('agent', 'readwrite')
    .persist('database', { table: 'paper_citations' })
    .bidirectional('merge')
    .interactions({
      canTrigger: ['desktop', 'agent'],
      targetEndpoints: ['server'],
      signalTypes: ['citation_added', 'citation_analyzed'],
    })
    .build();
}
