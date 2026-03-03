'use client';

/**
 * VariableInspector - 变量检查器
 * 
 * 显示当前 Kernel 中的变量列表
 * 支持查看变量详情、类型、值预览
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  Search,
  Database,
  Code2,
  List,
  Hash,
  Type,
  Box,
  Image as ImageIcon,
  Table2,
  Loader2,
} from 'lucide-react';
import type { JupyterService } from '../services/JupyterService';

// ============================================================
// 类型定义
// ============================================================

export interface Variable {
  name: string;
  type: string;
  value: string;
  size?: string;
  shape?: string;
  dtype?: string;
  isExpandable?: boolean;
  children?: Variable[];
}

interface VariableInspectorProps {
  jupyterService: JupyterService | null;
  isConnected: boolean;
  onInspectVariable?: (name: string) => void;
}

// 获取变量信息的 Python 代码
const INSPECT_VARIABLES_CODE = `
import json
import sys

def _get_variable_info():
    result = []
    user_ns = get_ipython().user_ns if 'get_ipython' in dir() else globals()
    
    for name, value in user_ns.items():
        if name.startswith('_') or name in ['In', 'Out', 'exit', 'quit', 'get_ipython']:
            continue
        
        var_info = {
            'name': name,
            'type': type(value).__name__,
            'value': '',
            'size': '',
            'shape': '',
            'dtype': '',
        }
        
        try:
            # Size
            var_info['size'] = str(sys.getsizeof(value))
            
            # Type-specific info
            if hasattr(value, 'shape'):
                var_info['shape'] = str(value.shape)
            if hasattr(value, 'dtype'):
                var_info['dtype'] = str(value.dtype)
            
            # Value preview
            if isinstance(value, (int, float, bool, str)):
                var_info['value'] = repr(value)[:100]
            elif hasattr(value, '__len__'):
                var_info['value'] = f"len={len(value)}"
            else:
                var_info['value'] = repr(value)[:50]
        except:
            var_info['value'] = '<error>'
        
        result.append(var_info)
    
    return result

print(json.dumps(_get_variable_info()))
`;

// ============================================================
// VariableInspector 组件
// ============================================================

export const VariableInspector = memo(function VariableInspector({
  jupyterService,
  isConnected,
  onInspectVariable,
}: VariableInspectorProps) {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  // 刷新变量列表
  const refreshVariables = useCallback(async () => {
    if (!jupyterService || !isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      const handle = jupyterService.execute('__inspect__', INSPECT_VARIABLES_CODE);
      let output = '';

      handle.onOutput((o) => {
        if (o.type === 'stream' && o.name === 'stdout') {
          output += o.text;
        }
      });

      const result = await handle.done;

      if (result.status === 'ok' && output) {
        try {
          const parsed = JSON.parse(output.trim());
          setVariables(parsed);
        } catch {
          setError('Failed to parse variable data');
        }
      } else if (result.status === 'error') {
        setError(`${result.ename}: ${result.evalue}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect variables');
    } finally {
      setIsLoading(false);
    }
  }, [jupyterService, isConnected]);

  // 连接时自动刷新
  useEffect(() => {
    if (isConnected) {
      refreshVariables();
    } else {
      setVariables([]);
    }
  }, [isConnected, refreshVariables]);

  // 过滤变量
  const filteredVariables = variables.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 切换展开
  const toggleExpand = useCallback((name: string) => {
    setExpandedVars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  }, []);

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    const iconProps = { size: 14, className: 'text-stone-500' };
    
    switch (type.toLowerCase()) {
      case 'dataframe':
        return <Table2 {...iconProps} className="text-green-400" />;
      case 'series':
        return <List {...iconProps} className="text-green-400" />;
      case 'ndarray':
        return <Box {...iconProps} className="text-blue-400" />;
      case 'list':
      case 'tuple':
        return <List {...iconProps} className="text-yellow-400" />;
      case 'dict':
        return <Database {...iconProps} className="text-purple-400" />;
      case 'int':
      case 'float':
        return <Hash {...iconProps} className="text-cyan-400" />;
      case 'str':
        return <Type {...iconProps} className="text-orange-400" />;
      case 'figure':
        return <ImageIcon {...iconProps} className="text-pink-400" />;
      default:
        return <Code2 {...iconProps} />;
    }
  };

  // 格式化大小
  const formatSize = (bytes: string) => {
    const num = parseInt(bytes);
    if (isNaN(num)) return '';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-stone-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-stone-600" />
          <span className="text-sm font-medium text-stone-700">Variables</span>
          <span className="text-xs text-stone-500">({variables.length})</span>
        </div>
        <button
          onClick={refreshVariables}
          disabled={!isConnected || isLoading}
          className="p-1 hover:bg-stone-200/60 rounded text-stone-600 hover:text-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-stone-200">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter variables..."
            className="w-full pl-7 pr-3 py-1.5 bg-stone-100 border border-stone-200 rounded text-sm text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!isConnected && (
          <div className="p-4 text-center text-stone-500 text-sm">
            Connect to Kernel to view variables
          </div>
        )}

        {isConnected && isLoading && (
          <div className="p-4 flex items-center justify-center gap-2 text-stone-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-4 text-red-600 text-sm">
            Error: {error}
          </div>
        )}

        {isConnected && !isLoading && filteredVariables.length === 0 && (
          <div className="p-4 text-center text-stone-500 text-sm">
            {searchQuery ? 'No matching variables' : 'No variables defined'}
          </div>
        )}

        {filteredVariables.length > 0 && (
          <div className="divide-y divide-stone-200">
            {filteredVariables.map((variable) => (
              <VariableItem
                key={variable.name}
                variable={variable}
                isExpanded={expandedVars.has(variable.name)}
                isSelected={selectedVar === variable.name}
                onToggle={() => toggleExpand(variable.name)}
                onSelect={() => {
                  setSelectedVar(variable.name);
                  onInspectVariable?.(variable.name);
                }}
                getTypeIcon={getTypeIcon}
                formatSize={formatSize}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================
// VariableItem 组件
// ============================================================

interface VariableItemProps {
  variable: Variable;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  getTypeIcon: (type: string) => React.ReactNode;
  formatSize: (bytes: string) => string;
}

const VariableItem = memo(function VariableItem({
  variable,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  getTypeIcon,
  formatSize,
}: VariableItemProps) {
  const hasDetails = variable.shape || variable.dtype || variable.size;

  return (
    <div
      className={`group ${isSelected ? 'bg-indigo-50' : 'hover:bg-stone-50'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer">
        {/* Expand Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 hover:bg-stone-200/60 rounded"
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-stone-500" />
          ) : (
            <ChevronRight size={12} className="text-stone-500" />
          )}
        </button>

        {/* Type Icon */}
        {getTypeIcon(variable.type)}

        {/* Name */}
        <span className="text-sm text-stone-700 font-mono flex-1 truncate">
          {variable.name}
        </span>

        {/* Type */}
        <span className="text-xs text-stone-500 font-mono">
          {variable.type}
        </span>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-2 pl-10 space-y-1">
          {/* Value */}
          <div className="text-xs">
            <span className="text-stone-500">Value: </span>
            <span className="text-stone-700 font-mono">{variable.value}</span>
          </div>

          {/* Shape */}
          {variable.shape && (
            <div className="text-xs">
              <span className="text-stone-500">Shape: </span>
              <span className="text-stone-700 font-mono">{variable.shape}</span>
            </div>
          )}

          {/* Dtype */}
          {variable.dtype && (
            <div className="text-xs">
              <span className="text-stone-500">Dtype: </span>
              <span className="text-stone-700 font-mono">{variable.dtype}</span>
            </div>
          )}

          {/* Size */}
          {variable.size && (
            <div className="text-xs">
              <span className="text-stone-500">Size: </span>
              <span className="text-stone-700 font-mono">{formatSize(variable.size)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default VariableInspector;
