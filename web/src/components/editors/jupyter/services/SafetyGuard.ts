/**
 * SafetyGuard - Agent 安全护栏
 * 
 * 负责：
 * - 危险代码模式检测
 * - 执行限制（次数、时间）
 * - 敏感操作确认
 * - 执行记录追踪
 */

import type { AgentMode } from '../types';

// ============================================================
// 类型定义
// ============================================================

export interface SafetyConfig {
  mode: AgentMode;
  
  // 执行限制
  maxConsecutiveExecutions: number;  // 连续执行最大次数
  maxTotalExecutionTime: number;     // 总执行时间限制（毫秒）
  maxRetryAttempts: number;          // 错误重试最大次数
  
  // 安全检查
  blockDangerousPatterns: boolean;   // 是否阻止危险代码
  requireConfirmation: string[];     // 需要确认的操作类型
  
  // 资源限制
  maxOutputSize: number;             // 输出大小限制（字节）
}

export interface SafetyCheckResult {
  safe: boolean;
  blocked: boolean;
  warnings: string[];
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  reason?: string;
  detectedPatterns: DetectedPattern[];
}

export interface DetectedPattern {
  pattern: string;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  description: string;
  line?: number;
}

export interface ExecutionRecord {
  id: string;
  cellId: string;
  code: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  retryCount: number;
}

// ============================================================
// 危险模式定义
// ============================================================

interface DangerousPattern {
  pattern: RegExp;
  severity: 'warning' | 'danger' | 'critical';
  description: string;
  blockInAutonomous: boolean;
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // 系统命令执行 - Critical
  { 
    pattern: /os\.system\s*\(/i, 
    severity: 'critical',
    description: 'System command execution',
    blockInAutonomous: true,
  },
  { 
    pattern: /subprocess\.(run|call|Popen|check_output)/i, 
    severity: 'critical',
    description: 'Subprocess execution',
    blockInAutonomous: true,
  },
  { 
    pattern: /exec\s*\(/i, 
    severity: 'critical',
    description: 'Dynamic code execution with exec()',
    blockInAutonomous: true,
  },
  { 
    pattern: /eval\s*\(/i, 
    severity: 'critical',
    description: 'Dynamic code evaluation with eval()',
    blockInAutonomous: true,
  },
  { 
    pattern: /__import__\s*\(/i, 
    severity: 'danger',
    description: 'Dynamic module import',
    blockInAutonomous: true,
  },
  
  // 文件系统操作 - Danger
  { 
    pattern: /shutil\.rmtree/i, 
    severity: 'critical',
    description: 'Recursive directory deletion',
    blockInAutonomous: true,
  },
  { 
    pattern: /os\.remove|os\.unlink/i, 
    severity: 'danger',
    description: 'File deletion',
    blockInAutonomous: true,
  },
  { 
    pattern: /open\s*\([^)]*['"][wa]['"]/, 
    severity: 'warning',
    description: 'File write operation',
    blockInAutonomous: false,
  },
  { 
    pattern: /pathlib\.Path\([^)]*\)\.unlink/i, 
    severity: 'danger',
    description: 'File deletion via pathlib',
    blockInAutonomous: true,
  },
  
  // Shell 命令 - Danger
  { 
    pattern: /!rm\s+-rf/i, 
    severity: 'critical',
    description: 'Shell recursive deletion',
    blockInAutonomous: true,
  },
  { 
    pattern: /!sudo/i, 
    severity: 'critical',
    description: 'Sudo command execution',
    blockInAutonomous: true,
  },
  { 
    pattern: /!chmod|!chown/i, 
    severity: 'danger',
    description: 'Permission modification',
    blockInAutonomous: true,
  },
  
  // 网络操作 - Warning
  { 
    pattern: /requests\.(get|post|put|delete|patch)\s*\(/i, 
    severity: 'warning',
    description: 'HTTP network request',
    blockInAutonomous: false,
  },
  { 
    pattern: /urllib\.request/i, 
    severity: 'warning',
    description: 'URL request',
    blockInAutonomous: false,
  },
  { 
    pattern: /socket\./i, 
    severity: 'warning',
    description: 'Socket operation',
    blockInAutonomous: false,
  },
  
  // 数据库操作 - Warning
  { 
    pattern: /\.execute\s*\([^)]*(?:DROP|DELETE|TRUNCATE|ALTER)/i, 
    severity: 'danger',
    description: 'Destructive SQL operation',
    blockInAutonomous: true,
  },
  { 
    pattern: /\.to_sql\s*\(/i, 
    severity: 'warning',
    description: 'Database write operation',
    blockInAutonomous: false,
  },
  
  // 包管理 - Warning
  { 
    pattern: /!pip\s+install/i, 
    severity: 'warning',
    description: 'Package installation',
    blockInAutonomous: false,
  },
  { 
    pattern: /!pip\s+uninstall/i, 
    severity: 'danger',
    description: 'Package uninstallation',
    blockInAutonomous: true,
  },
  
  // 环境变量 - Warning
  { 
    pattern: /os\.environ\s*\[/i, 
    severity: 'warning',
    description: 'Environment variable access',
    blockInAutonomous: false,
  },
];

// 需要确认的操作类型
const CONFIRMATION_REQUIRED_PATTERNS: RegExp[] = [
  /\.drop\s*\(/i,           // DataFrame drop
  /\.to_csv\s*\(/i,         // CSV write
  /\.to_excel\s*\(/i,       // Excel write
  /\.to_parquet\s*\(/i,     // Parquet write
  /\.to_json\s*\(/i,        // JSON write
  /plt\.savefig\s*\(/i,     // Save figure
];

// ============================================================
// SafetyGuard 类
// ============================================================

export class SafetyGuard {
  private config: SafetyConfig;
  private executionRecords: ExecutionRecord[] = [];
  private consecutiveExecutions = 0;
  private totalExecutionTime = 0;
  private sessionStartTime = Date.now();

  constructor(config?: Partial<SafetyConfig>) {
    this.config = {
      mode: 'interactive',
      maxConsecutiveExecutions: 10,
      maxTotalExecutionTime: 5 * 60 * 1000, // 5 minutes
      maxRetryAttempts: 3,
      blockDangerousPatterns: true,
      requireConfirmation: ['file_write', 'network', 'database'],
      maxOutputSize: 10 * 1024 * 1024, // 10MB
      ...config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置模式
   */
  setMode(mode: AgentMode): void {
    this.config.mode = mode;
  }

  /**
   * 检查代码安全性
   */
  checkCode(code: string): SafetyCheckResult {
    const detectedPatterns: DetectedPattern[] = [];
    const warnings: string[] = [];
    let blocked = false;
    let reason: string | undefined;
    let requiresConfirmation = false;
    let confirmationMessage: string | undefined;

    // 检测危险模式
    for (const { pattern, severity, description, blockInAutonomous } of DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        // 找到匹配的行号
        const lines = code.split('\n');
        let lineNumber: number | undefined;
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            lineNumber = i + 1;
            break;
          }
        }

        detectedPatterns.push({
          pattern: pattern.source,
          severity,
          description,
          line: lineNumber,
        });

        if (severity === 'critical' || severity === 'danger') {
          warnings.push(description);
        }

        // 自主模式下阻止危险代码
        if (this.config.mode === 'autonomous' && blockInAutonomous && this.config.blockDangerousPatterns) {
          blocked = true;
          reason = description;
        }
      }
    }

    // 检查需要确认的操作
    if (this.config.mode === 'interactive') {
      for (const pattern of CONFIRMATION_REQUIRED_PATTERNS) {
        if (pattern.test(code)) {
          requiresConfirmation = true;
          confirmationMessage = 'This code performs file or data operations. Please confirm execution.';
          break;
        }
      }
    }

    return {
      safe: detectedPatterns.length === 0,
      blocked,
      warnings,
      requiresConfirmation,
      confirmationMessage,
      reason,
      detectedPatterns,
    };
  }

  /**
   * 检查是否可以执行（执行限制）
   */
  canExecute(): { allowed: boolean; reason?: string } {
    // 检查连续执行次数
    if (this.consecutiveExecutions >= this.config.maxConsecutiveExecutions) {
      return {
        allowed: false,
        reason: `Exceeded maximum consecutive executions (${this.config.maxConsecutiveExecutions})`,
      };
    }

    // 检查总执行时间
    if (this.totalExecutionTime >= this.config.maxTotalExecutionTime) {
      return {
        allowed: false,
        reason: `Exceeded maximum total execution time (${this.config.maxTotalExecutionTime / 1000}s)`,
      };
    }

    return { allowed: true };
  }

  /**
   * 检查重试次数
   */
  canRetry(cellId: string): { allowed: boolean; retryCount: number } {
    const records = this.executionRecords.filter(
      r => r.cellId === cellId && !r.success
    );
    const retryCount = records.length;
    
    return {
      allowed: retryCount < this.config.maxRetryAttempts,
      retryCount,
    };
  }

  /**
   * 记录执行开始
   */
  recordExecutionStart(cellId: string, code: string): string {
    const id = crypto.randomUUID();
    const record: ExecutionRecord = {
      id,
      cellId,
      code,
      startTime: Date.now(),
      success: false,
      retryCount: this.executionRecords.filter(
        r => r.cellId === cellId && !r.success
      ).length,
    };
    
    this.executionRecords.push(record);
    this.consecutiveExecutions++;
    
    return id;
  }

  /**
   * 记录执行完成
   */
  recordExecutionEnd(recordId: string, success: boolean, error?: string): void {
    const record = this.executionRecords.find(r => r.id === recordId);
    if (record) {
      record.endTime = Date.now();
      record.success = success;
      record.error = error;
      
      const duration = record.endTime - record.startTime;
      this.totalExecutionTime += duration;
      
      // 成功执行后重置连续计数
      if (success) {
        this.consecutiveExecutions = 0;
      }
    }
  }

  /**
   * 重置会话统计
   */
  resetSession(): void {
    this.consecutiveExecutions = 0;
    this.totalExecutionTime = 0;
    this.sessionStartTime = Date.now();
    this.executionRecords = [];
  }

  /**
   * 获取会话统计
   */
  getSessionStats(): {
    consecutiveExecutions: number;
    totalExecutionTime: number;
    totalExecutions: number;
    successRate: number;
    sessionDuration: number;
  } {
    const total = this.executionRecords.length;
    const successful = this.executionRecords.filter(r => r.success).length;
    
    return {
      consecutiveExecutions: this.consecutiveExecutions,
      totalExecutionTime: this.totalExecutionTime,
      totalExecutions: total,
      successRate: total > 0 ? successful / total : 0,
      sessionDuration: Date.now() - this.sessionStartTime,
    };
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionRecords];
  }

  /**
   * 格式化安全报告
   */
  formatSafetyReport(result: SafetyCheckResult): string {
    if (result.safe) {
      return '✅ Code appears safe';
    }

    const lines: string[] = [];
    
    if (result.blocked) {
      lines.push(`🚫 BLOCKED: ${result.reason}`);
    }

    if (result.warnings.length > 0) {
      lines.push('⚠️ Warnings:');
      result.warnings.forEach(w => lines.push(`  - ${w}`));
    }

    if (result.detectedPatterns.length > 0) {
      lines.push('');
      lines.push('Detected patterns:');
      result.detectedPatterns.forEach(p => {
        const lineInfo = p.line ? ` (line ${p.line})` : '';
        const icon = p.severity === 'critical' ? '🔴' : 
                     p.severity === 'danger' ? '🟠' : 
                     p.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`  ${icon} ${p.description}${lineInfo}`);
      });
    }

    return lines.join('\n');
  }
}

/**
 * 创建 SafetyGuard 实例
 */
export function createSafetyGuard(config?: Partial<SafetyConfig>): SafetyGuard {
  return new SafetyGuard(config);
}

/**
 * 默认导出
 */
export default SafetyGuard;
