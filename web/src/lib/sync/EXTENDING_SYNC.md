# 同步系统扩展指南

本指南介绍如何向同步系统添加新的数据类型，实现多端同步和持久化。

## 目录

1. [概述](#概述)
2. [快速开始](#快速开始)
3. [详细步骤](#详细步骤)
4. [同步规则配置](#同步规则配置)
5. [最佳实践](#最佳实践)
6. [示例：研究笔记](#示例研究笔记)

---

## 概述

同步系统基于**同步控制矩阵 (Sync Control Matrix)** 设计，支持：

- ✅ 多端同步（桌面端、移动端、Web、CLI）
- ✅ 可配置的同步方向（单向广播、双向同步）
- ✅ 灵活的持久化策略（数据库、内存、缓存）
- ✅ 客户端能力过滤
- ✅ 冲突解决策略
- ✅ 交互信号路由

---

## 快速开始

添加新数据类型的最小步骤：

```typescript
// 1. 创建同步规则
import { rule } from '@/lib/sync';

const myDataRule = rule('myData', '我的数据类型')
  .serverOwned()
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'read')
  .persist('database', { table: 'my_data' })
  .bidirectional('merge')
  .build();

// 2. 注册到矩阵
import { SyncMatrixEngine, defaultSyncMatrix } from '@/lib/sync';

const engine = new SyncMatrixEngine(defaultSyncMatrix);
engine.registerRule(myDataRule);
```

---

## 详细步骤

### Step 1: 定义数据类型

```typescript
// src/lib/sync/examples/myData.ts

/** 数据接口 */
export interface MyDataItem {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/** 状态接口 */
export interface MyDataState {
  items: MyDataItem[];
  activeItemId: string | null;
}
```

### Step 2: 创建同步规则

```typescript
import { rule, SyncRule } from '@/lib/sync';

export const myDataSyncRule: SyncRule = rule('myData', '我的数据')
  // 权威源
  .serverOwned()
  
  // 端点权限
  .endpoint('desktop', 'readwrite')
  .endpoint('mobile', 'read')      // 移动端只读
  .endpoint('agent', 'readwrite')
  
  // 持久化
  .persist('database', { 
    table: 'my_data',
    maxItems: 1000,
  })
  
  // 同步策略
  .bidirectional('merge')
  .throttle(500)
  
  // 交互信号
  .interactions({
    canTrigger: ['desktop'],
    targetEndpoints: ['server', 'agent'],
    signalTypes: ['item_created', 'item_updated'],
  })
  
  .build();
```

### Step 3: 添加 Store Actions

```typescript
// 在 workspaceStore.ts 或单独的 slice 文件中

export interface MyDataActions {
  // 批量设置 (FULL_STATE)
  setMyData: (items: MyDataItem[]) => void;
  
  // 增量更新 (STATE_DELTA)
  addMyDataItem: (item: MyDataItem) => void;
  updateMyDataItem: (id: string, changes: Partial<MyDataItem>) => void;
  deleteMyDataItem: (id: string) => void;
}

// 在 Store 中实现
const myDataSlice = {
  items: [],
  activeItemId: null,

  setMyData: (items) => set({ items }),

  addMyDataItem: (item) => {
    set((state) => {
      // ID 去重
      if (state.items.some(i => i.id === item.id)) {
        return state;
      }
      return { items: [...state.items, item] };
    });
  },

  updateMyDataItem: (id, changes) => {
    set((state) => ({
      items: state.items.map(i =>
        i.id === id ? { ...i, ...changes, updatedAt: Date.now() } : i
      ),
    }));
  },

  deleteMyDataItem: (id) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== id),
    }));
  },
};
```

### Step 4: 注册规则

```typescript
// 方式 1: 静态注册（在 defaultMatrix.ts 中添加）
export const defaultSyncMatrix = {
  rules: [
    // ... 现有规则
    myDataSyncRule,
  ],
};

// 方式 2: 动态注册（运行时）
import { SyncMatrixEngine, defaultSyncMatrix } from '@/lib/sync';

const engine = new SyncMatrixEngine(defaultSyncMatrix);
engine.registerRule(myDataSyncRule);
```

### Step 5: 更新服务端

```typescript
// scripts/agent-server.ts

// 在 SessionStore 中添加字段
interface SessionState {
  // ... 现有字段
  myData: MyDataItem[];
}

// 处理增量更新
if (delta.myData?.added) {
  delta.myData.added.forEach(item => {
    session.myData.push(item);
  });
  sessionStore.persist(sessionId);
}
```

### Step 6: 更新客户端 Hook

```typescript
// src/lib/sync/useAgentStore.ts

const handleFullState = (state: SessionState) => {
  // ... 现有处理
  if (state.myData?.length) {
    storeActions.setMyData(state.myData);
  }
};

const handleStateDelta = (delta: StateDelta) => {
  // ... 现有处理
  if (delta.myData?.added) {
    delta.myData.added.forEach(item => {
      storeActions.addMyDataItem(item);
    });
  }
};
```

---

## 同步规则配置

### 端点权限

| 权限 | 说明 |
|------|------|
| `owner` | 权威源，负责生成和管理 |
| `read` | 只读 |
| `write` | 只写 |
| `readwrite` | 读写 |
| `partial` | 部分（按能力/配置过滤） |
| `none` | 不参与 |

### 持久化策略

| 策略 | 说明 |
|------|------|
| `database` | 持久化到数据库 |
| `memory` | 仅内存（服务端重启丢失） |
| `cache` | 缓存（Redis 等） |
| `none` | 不持久化 |

### 同步方向

| 方向 | 说明 |
|------|------|
| `broadcast` | 服务端 → 所有客户端 |
| `request` | 客户端 → 服务端 |
| `bidirectional` | 双向 |
| `none` | 不同步 |

### 冲突策略

| 策略 | 说明 |
|------|------|
| `server_wins` | 服务端优先 |
| `latest_wins` | 时间戳最新优先 |
| `merge` | 尝试合并 |
| `ask_user` | 询问用户 |

---

## 最佳实践

### 1. ID 生成

使用可预测且唯一的 ID 格式：

```typescript
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

### 2. 去重

在所有增量操作中检查 ID 重复：

```typescript
addItem: (item) => {
  set((state) => {
    if (state.items.some(i => i.id === item.id)) {
      return state;  // 已存在，跳过
    }
    return { items: [...state.items, item] };
  });
},
```

### 3. 时间戳

始终包含 `createdAt` 和 `updatedAt`：

```typescript
const newItem = {
  id: generateId('item'),
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 更新时
updateItem: (id, changes) => {
  set((state) => ({
    items: state.items.map(i =>
      i.id === id ? { ...i, ...changes, updatedAt: Date.now() } : i
    ),
  }));
},
```

### 4. 节流

对于频繁更新的数据，使用适当的节流：

```typescript
// 实时协作
.throttle(50)

// 普通笔记
.throttle(1000)

// 静态数据
// 不设置 throttle
```

### 5. 移动端优化

考虑移动端的限制：

```typescript
// 移动端只读
.endpoint('mobile', 'read')

// 移动端只获取最新数据
.endpoint('mobile', 'partial', {
  filter: ['latest_only'],
})
```

### 6. 交互信号

定义清晰的信号类型：

```typescript
.interactions({
  canTrigger: ['desktop', 'mobile'],
  targetEndpoints: ['server', 'agent'],
  signalTypes: [
    'item_created',
    'item_updated',
    'item_deleted',
    'item_shared',
  ],
})
```

---

## 示例：研究笔记

完整示例请参考：

```
src/lib/sync/examples/researchNotes.ts
```

该示例包含：

- ✅ 数据类型定义
- ✅ 同步规则
- ✅ Store Slice
- ✅ 辅助函数
- ✅ 过滤和排序

### 使用方式

```typescript
import {
  ResearchNote,
  createResearchNote,
  createResearchNotesSlice,
  researchNotesSyncRule,
} from '@/lib/sync/examples/researchNotes';

// 创建笔记
const note = createResearchNote('我的笔记', '# 内容\n...');

// 添加标签
note.tags = ['重要', '待处理'];

// 链接到消息
note.linkedMessageIds = ['msg-123'];
```

---

## 调试

### 启用调试日志

```typescript
// 在 defaultMatrix.ts
globalConfig: {
  enableDebugLogging: true,
},

// 或在 useAgentConnection
useAgentConnection({
  debug: true,
});
```

### 检查规则

```typescript
import { SyncMatrixEngine, defaultSyncMatrix } from '@/lib/sync';

const engine = new SyncMatrixEngine(defaultSyncMatrix);

// 检查权限
console.log(engine.canAccess('myData', 'mobile', 'write')); // false

// 获取目标端点
console.log(engine.getTargetEndpoints('myData', 'desktop'));
// ['server', 'mobile']
```

---

## 常见问题

### Q: 数据不同步？

1. 检查规则是否正确注册
2. 检查端点权限配置
3. 检查 Store action 是否正确实现
4. 查看服务端日志

### Q: 数据重复？

确保所有增量操作都有 ID 去重检查。

### Q: 移动端收不到数据？

检查移动端的 `access` 权限和 `filter` 配置。

### Q: 冲突如何处理？

配置 `conflictStrategy`，默认使用 `server_wins`。

---

## 相关文件

- `src/lib/sync/types.ts` - 类型定义
- `src/lib/sync/SyncMatrixEngine.ts` - 矩阵引擎
- `src/lib/sync/defaultMatrix.ts` - 默认规则
- `src/lib/sync/useAgentConnection.ts` - 连接 Hook
- `src/lib/sync/useAgentStore.ts` - Store 集成
- `scripts/agent-server.ts` - 服务端实现
