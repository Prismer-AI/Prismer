/**
 * Sync Matrix Engine
 *
 * 同步控制矩阵运行时引擎
 * 负责规则管理、权限检查、消息路由
 */

import type {
  SyncControlMatrix,
  SyncRule,
  EndpointType,
  AccessMode,
  PersistenceConfig,
  SyncConfig,
  ClientInfo,
  EndpointAccessConfig,
} from './types';

// ============================================================
// Engine Implementation
// ============================================================

export class SyncMatrixEngine {
  private matrix: SyncControlMatrix;
  private ruleIndex: Map<string, SyncRule> = new Map();
  private debugMode: boolean;

  constructor(matrix: SyncControlMatrix) {
    this.matrix = matrix;
    this.debugMode = matrix.globalConfig?.enableDebugLogging ?? false;
    this.buildIndex();
  }

  // ==================== 规则管理 ====================

  /**
   * 注册新的数据类型规则（运行时扩展）
   */
  registerRule(rule: SyncRule): void {
    const existing = this.ruleIndex.get(rule.dataType);
    if (existing) {
      this.log(`Updated rule: ${rule.dataType}`);
    } else {
      this.log(`Registered new rule: ${rule.dataType}`);
    }
    
    // 更新索引
    this.ruleIndex.set(rule.dataType, rule);
    
    // 更新 matrix.rules 数组
    const existingIndex = this.matrix.rules.findIndex(r => r.dataType === rule.dataType);
    if (existingIndex >= 0) {
      this.matrix.rules[existingIndex] = rule;
    } else {
      this.matrix.rules.push(rule);
    }
  }

  /**
   * 移除规则
   */
  removeRule(dataType: string): boolean {
    const removed = this.ruleIndex.delete(dataType);
    if (removed) {
      this.matrix.rules = this.matrix.rules.filter(r => r.dataType !== dataType);
      this.log(`Removed rule: ${dataType}`);
    }
    return removed;
  }

  /**
   * 获取规则
   */
  getRule(dataType: string): SyncRule | undefined {
    return this.ruleIndex.get(dataType);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): SyncRule[] {
    return [...this.matrix.rules];
  }

  /**
   * 检查规则是否存在
   */
  hasRule(dataType: string): boolean {
    return this.ruleIndex.has(dataType);
  }

  // ==================== 权限检查 ====================

  /**
   * 检查端点是否可以访问某数据类型
   */
  canAccess(
    dataType: string,
    endpoint: EndpointType,
    mode: 'read' | 'write'
  ): boolean {
    const rule = this.getRule(dataType);
    if (!rule || rule.enabled === false) {
      return false;
    }

    const config = rule.endpoints[endpoint];
    if (!config) {
      return false;
    }

    return this.checkAccessMode(config.access, mode);
  }

  /**
   * 检查端点是否有指定能力
   */
  hasCapability(
    dataType: string,
    endpoint: EndpointType,
    capability: string
  ): boolean {
    const rule = this.getRule(dataType);
    if (!rule) return false;

    const config = rule.endpoints[endpoint];
    if (!config) return false;

    // 如果没有指定过滤器，默认有权限
    if (!config.filter || config.filter.length === 0) {
      return true;
    }

    return config.filter.includes(capability);
  }

  /**
   * 检查客户端是否可以执行指定数据类型的操作
   */
  canClientAccess(
    dataType: string,
    client: ClientInfo,
    mode: 'read' | 'write'
  ): boolean {
    const rule = this.getRule(dataType);
    if (!rule || rule.enabled === false) {
      return false;
    }

    const config = rule.endpoints[client.clientType];
    if (!config) {
      return false;
    }

    // 基础权限检查
    if (!this.checkAccessMode(config.access, mode)) {
      return false;
    }

    // 如果是 partial 模式，检查客户端能力
    if (config.access === 'partial' && config.requiredCapabilities) {
      const hasAllCapabilities = config.requiredCapabilities.every(
        cap => client.capabilities.includes(cap)
      );
      if (!hasAllCapabilities) {
        return false;
      }
    }

    return true;
  }

  // ==================== 端点路由 ====================

  /**
   * 获取数据应发送到的端点列表
   */
  getTargetEndpoints(
    dataType: string,
    sourceEndpoint: EndpointType
  ): EndpointType[] {
    const rule = this.getRule(dataType);
    if (!rule || rule.enabled === false) {
      return [];
    }

    const targets: EndpointType[] = [];

    for (const [endpoint, config] of Object.entries(rule.endpoints)) {
      // 排除源端点
      if (endpoint === sourceEndpoint) continue;
      
      // 检查是否可以接收数据
      if (config && this.canReceiveData(config.access)) {
        targets.push(endpoint as EndpointType);
      }
    }

    return targets;
  }

  /**
   * 获取需要接收某数据类型的客户端列表
   */
  filterClientsForDataType(
    dataType: string,
    clients: ClientInfo[],
    sourceClientId?: string
  ): ClientInfo[] {
    const rule = this.getRule(dataType);
    if (!rule || rule.enabled === false) {
      return [];
    }

    return clients.filter(client => {
      // 排除源客户端
      if (sourceClientId && client.clientId === sourceClientId) {
        return false;
      }

      // 检查端点访问权限
      const config = rule.endpoints[client.clientType];
      if (!config || !this.canReceiveData(config.access)) {
        return false;
      }

      // 如果是 partial 模式，检查能力过滤
      if (config.access === 'partial' && config.filter) {
        const hasAnyFilterCapability = config.filter.some(
          cap => client.capabilities.includes(cap)
        );
        if (!hasAnyFilterCapability) {
          return false;
        }
      }

      return true;
    });
  }

  // ==================== 交互信号 ====================

  /**
   * 检查端点是否可以触发交互信号
   */
  canTriggerInteraction(dataType: string, endpoint: EndpointType): boolean {
    const rule = this.getRule(dataType);
    if (!rule?.interactionSignals) {
      return false;
    }
    return rule.interactionSignals.canTrigger.includes(endpoint);
  }

  /**
   * 获取交互信号的目标端点
   */
  getInteractionTargets(dataType: string): EndpointType[] {
    const rule = this.getRule(dataType);
    return rule?.interactionSignals?.targetEndpoints ?? [];
  }

  /**
   * 获取支持的信号类型
   */
  getSupportedSignalTypes(dataType: string): string[] {
    const rule = this.getRule(dataType);
    return rule?.interactionSignals?.signalTypes ?? [];
  }

  // ==================== 持久化配置 ====================

  /**
   * 获取持久化配置
   */
  getPersistenceConfig(dataType: string): PersistenceConfig | undefined {
    return this.getRule(dataType)?.persistence;
  }

  /**
   * 检查是否需要持久化
   */
  shouldPersist(dataType: string): boolean {
    const config = this.getPersistenceConfig(dataType);
    return config !== undefined && config.strategy !== 'none';
  }

  /**
   * 获取所有需要持久化的数据类型
   */
  getPersistentDataTypes(): string[] {
    return this.matrix.rules
      .filter(r => r.persistence.strategy !== 'none' && r.enabled !== false)
      .map(r => r.dataType);
  }

  // ==================== 同步配置 ====================

  /**
   * 获取同步配置
   */
  getSyncConfig(dataType: string): SyncConfig | undefined {
    return this.getRule(dataType)?.sync;
  }

  /**
   * 获取节流时间
   */
  getThrottleMs(dataType: string): number {
    const config = this.getSyncConfig(dataType);
    return config?.throttleMs ?? this.matrix.globalConfig?.defaultThrottleMs ?? 100;
  }

  /**
   * 检查是否是广播类型
   */
  isBroadcast(dataType: string): boolean {
    const config = this.getSyncConfig(dataType);
    return config?.direction === 'broadcast';
  }

  /**
   * 检查是否是双向同步
   */
  isBidirectional(dataType: string): boolean {
    const config = this.getSyncConfig(dataType);
    return config?.direction === 'bidirectional';
  }

  // ==================== 数据转换 ====================

  /**
   * 获取数据转换器名称
   */
  getTransformer(dataType: string, endpoint: EndpointType): string | undefined {
    const rule = this.getRule(dataType);
    return rule?.endpoints[endpoint]?.transform;
  }

  /**
   * 过滤数据（用于 partial 模式）
   */
  filterDataForEndpoint<T extends Record<string, unknown>>(
    dataType: string,
    endpoint: EndpointType,
    data: T,
    clientCapabilities: string[]
  ): Partial<T> {
    const rule = this.getRule(dataType);
    if (!rule) return data;

    const config = rule.endpoints[endpoint];
    if (!config || config.access !== 'partial' || !config.filter) {
      return data;
    }

    // 只返回客户端有能力处理的字段
    const filtered: Partial<T> = {};
    for (const key of Object.keys(data)) {
      // 如果过滤器包含该字段名或客户端有对应能力
      if (
        config.filter.includes(key) ||
        config.filter.some(f => clientCapabilities.includes(f))
      ) {
        (filtered as Record<string, unknown>)[key] = data[key];
      }
    }

    return filtered;
  }

  // ==================== 调试和信息 ====================

  /**
   * 获取矩阵版本
   */
  getVersion(): string {
    return this.matrix.version;
  }

  /**
   * 获取规则统计
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    persistentRules: number;
    bidirectionalRules: number;
  } {
    const rules = this.matrix.rules;
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled !== false).length,
      persistentRules: rules.filter(r => r.persistence.strategy !== 'none').length,
      bidirectionalRules: rules.filter(r => r.sync.direction === 'bidirectional').length,
    };
  }

  /**
   * 导出矩阵配置
   */
  export(): SyncControlMatrix {
    return { ...this.matrix };
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  // ==================== 私有方法 ====================

  private buildIndex(): void {
    this.ruleIndex.clear();
    for (const rule of this.matrix.rules) {
      this.ruleIndex.set(rule.dataType, rule);
    }
    this.log(`Built index for ${this.ruleIndex.size} rules`);
  }

  private checkAccessMode(access: AccessMode, mode: 'read' | 'write'): boolean {
    switch (access) {
      case 'owner':
      case 'readwrite':
        return true;
      case 'read':
        return mode === 'read';
      case 'write':
        return mode === 'write';
      case 'partial':
        return true; // 需要进一步检查 filter
      case 'none':
        return false;
      default:
        return false;
    }
  }

  private canReceiveData(access: AccessMode): boolean {
    return access === 'owner' || access === 'read' || access === 'readwrite' || access === 'partial';
  }

  private log(message: string): void {
    if (this.debugMode) {
      console.log(`[SyncMatrix] ${message}`);
    }
  }
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * 创建同步矩阵引擎
 */
export function createSyncMatrixEngine(matrix: SyncControlMatrix): SyncMatrixEngine {
  return new SyncMatrixEngine(matrix);
}

/**
 * 创建空的同步矩阵
 */
export function createEmptyMatrix(version: string = '1.0.0'): SyncControlMatrix {
  return {
    version,
    rules: [],
    globalConfig: {
      defaultThrottleMs: 100,
      defaultTimeout: 30000,
      enableDebugLogging: false,
    },
  };
}

// ============================================================
// Rule Builder Helper
// ============================================================

/**
 * 规则构建器 - 链式调用创建规则
 */
export class SyncRuleBuilder {
  private rule: SyncRule;

  constructor(dataType: string, description: string) {
    this.rule = {
      dataType,
      description,
      endpoints: {},
      persistence: { strategy: 'none' },
      sync: { direction: 'none', conflictStrategy: 'server_wins' },
      enabled: true,
    };
  }

  /** 设置服务端为 Owner */
  serverOwned(): this {
    this.rule.endpoints.server = { access: 'owner' };
    return this;
  }

  /** 设置端点访问权限 */
  endpoint(
    type: EndpointType,
    access: AccessMode,
    options?: Partial<EndpointAccessConfig>
  ): this {
    this.rule.endpoints[type] = { access, ...options };
    return this;
  }

  /** 设置持久化策略 */
  persist(
    strategy: PersistenceConfig['strategy'],
    options?: Omit<PersistenceConfig, 'strategy'>
  ): this {
    this.rule.persistence = { strategy, ...options };
    return this;
  }

  /** 设置同步为广播模式 */
  broadcast(): this {
    this.rule.sync.direction = 'broadcast';
    return this;
  }

  /** 设置同步为双向模式 */
  bidirectional(conflictStrategy: SyncRule['sync']['conflictStrategy'] = 'server_wins'): this {
    this.rule.sync.direction = 'bidirectional';
    this.rule.sync.conflictStrategy = conflictStrategy;
    return this;
  }

  /** 设置节流 */
  throttle(ms: number): this {
    this.rule.sync.throttleMs = ms;
    return this;
  }

  /** 设置交互信号 */
  interactions(config: SyncRule['interactionSignals']): this {
    this.rule.interactionSignals = config;
    return this;
  }

  /** 构建规则 */
  build(): SyncRule {
    return { ...this.rule };
  }
}

/**
 * 创建规则构建器
 */
export function rule(dataType: string, description: string): SyncRuleBuilder {
  return new SyncRuleBuilder(dataType, description);
}
