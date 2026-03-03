/**
 * Agent Service Factory
 *
 * @description
 * Phase 3A: Agent 服务工厂
 * 根据配置创建适当的 Agent 服务实例
 */

import type {
  AgentService,
  AgentServiceFactoryConfig,
  CreateServiceOptions,
} from './types';
import { DemoAgentService } from './DemoAgentService';
import { OpenClawAgentService, type OpenClawConfig } from './OpenClawAgentService';

// ============================================================
// Factory Implementation
// ============================================================

/**
 * Agent 服务工厂
 *
 * @description
 * 根据配置创建 DemoAgentService 或 OpenClawAgentService 实例。
 * 支持单例模式和按需创建。
 */
export class AgentServiceFactory {
  private static instance: AgentServiceFactory | null = null;
  private config: AgentServiceFactoryConfig;
  private services: Map<string, AgentService> = new Map();

  private constructor(config: AgentServiceFactoryConfig) {
    this.config = config;
  }

  /**
   * 获取工厂单例
   */
  static getInstance(config?: AgentServiceFactoryConfig): AgentServiceFactory {
    if (!AgentServiceFactory.instance) {
      if (!config) {
        // 默认配置
        config = {
          defaultType: 'demo',
          demo: {
            simulatedDelay: 1000,
            enableDemoFlow: true,
          },
        };
      }
      AgentServiceFactory.instance = new AgentServiceFactory(config);
    }
    return AgentServiceFactory.instance;
  }

  /**
   * 重置工厂（用于测试）
   */
  static reset(): void {
    if (AgentServiceFactory.instance) {
      AgentServiceFactory.instance.disposeAll();
      AgentServiceFactory.instance = null;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentServiceFactoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 创建服务实例
   */
  createService(options: CreateServiceOptions): AgentService {
    const serviceType = options.type ?? this.config.defaultType;
    const serviceKey = `${serviceType}-${options.agentId}`;

    // 检查是否已有实例
    const existing = this.services.get(serviceKey);
    if (existing) {
      return existing;
    }

    // 创建新实例
    let service: AgentService;

    if (serviceType === 'demo') {
      service = new DemoAgentService(this.config.demo);
    } else if (serviceType === 'openclaw') {
      const gatewayUrl = options.gatewayUrl ?? this.config.openclaw?.gatewayUrl;
      if (!gatewayUrl) {
        throw new Error('Gateway URL required for OpenClaw service');
      }

      service = new OpenClawAgentService({
        gatewayUrl,
        authToken: this.config.openclaw?.authToken,
        timeout: this.config.openclaw?.timeout,
        retryCount: this.config.openclaw?.retryCount,
      });
    } else {
      throw new Error(`Unknown service type: ${serviceType}`);
    }

    this.services.set(serviceKey, service);
    return service;
  }

  /**
   * 获取已有服务实例
   */
  getService(agentId: string, type?: 'demo' | 'openclaw'): AgentService | null {
    const serviceType = type ?? this.config.defaultType;
    return this.services.get(`${serviceType}-${agentId}`) ?? null;
  }

  /**
   * 获取或创建服务实例
   */
  getOrCreateService(options: CreateServiceOptions): AgentService {
    const existing = this.getService(options.agentId, options.type);
    if (existing) {
      return existing;
    }
    return this.createService(options);
  }

  /**
   * 移除服务实例
   */
  removeService(agentId: string, type?: 'demo' | 'openclaw'): void {
    const serviceType = type ?? this.config.defaultType;
    const serviceKey = `${serviceType}-${agentId}`;
    const service = this.services.get(serviceKey);

    if (service && 'dispose' in service) {
      (service as { dispose: () => void }).dispose();
    }

    this.services.delete(serviceKey);
  }

  /**
   * 清理所有服务
   */
  disposeAll(): void {
    for (const service of this.services.values()) {
      if ('dispose' in service) {
        (service as { dispose: () => void }).dispose();
      }
    }
    this.services.clear();
  }

  /**
   * 获取所有活跃服务
   */
  getActiveServices(): { agentId: string; type: string; service: AgentService }[] {
    const result: { agentId: string; type: string; service: AgentService }[] = [];

    for (const [key, service] of this.services) {
      const [type, agentId] = key.split('-');
      result.push({ agentId, type, service });
    }

    return result;
  }

  /**
   * 健康检查所有服务
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [key, service] of this.services) {
      try {
        const healthy = await service.healthCheck();
        results.set(key, healthy);
      } catch {
        results.set(key, false);
      }
    }

    return results;
  }
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * 获取默认 Agent 服务
 */
export function getAgentService(options: CreateServiceOptions): AgentService {
  return AgentServiceFactory.getInstance().getOrCreateService(options);
}

/**
 * 创建 Demo Agent 服务
 */
export function createDemoService(
  agentId: string,
  config?: { simulatedDelay?: number; enableDemoFlow?: boolean }
): AgentService {
  return AgentServiceFactory.getInstance().createService({
    type: 'demo',
    agentId,
  });
}

/**
 * 创建 OpenClaw Agent 服务
 */
export function createOpenClawService(
  agentId: string,
  gatewayUrl: string,
  config?: Partial<OpenClawConfig>
): AgentService {
  const factory = AgentServiceFactory.getInstance();
  factory.updateConfig({
    openclaw: {
      gatewayUrl,
      ...config,
    },
  });

  return factory.createService({
    type: 'openclaw',
    agentId,
    gatewayUrl,
  });
}

/**
 * 根据环境自动选择服务类型
 */
export function createAgentService(
  agentId: string,
  gatewayUrl?: string
): AgentService {
  // 如果提供了 Gateway URL，使用 OpenClaw
  if (gatewayUrl) {
    return createOpenClawService(agentId, gatewayUrl);
  }

  // 检查环境变量
  const envGatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  if (envGatewayUrl) {
    return createOpenClawService(agentId, envGatewayUrl);
  }

  // 默认使用 Demo 服务
  return createDemoService(agentId);
}
