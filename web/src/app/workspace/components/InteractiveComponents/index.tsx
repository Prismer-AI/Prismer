'use client';

/**
 * InteractiveComponents
 * 
 * 交互组件渲染器 - 根据组件类型动态渲染对应的交互组件
 */

import React, { memo, useCallback } from 'react';
import type { InteractiveComponent, InteractionEvent } from '../../types';
import { ButtonGroup } from './ButtonGroup';
import { ChoiceCard } from './ChoiceCard';
import { SummaryCard } from './SummaryCard';
import { ProgressCard } from './ProgressCard';
import { CodeBlock } from './CodeBlock';

interface InteractiveComponentRendererProps {
  components: InteractiveComponent[];
  messageId: string;
  onInteraction: (event: InteractionEvent) => void;
  disabled?: boolean;
  /** Force vertical layout for all button groups */
  layout?: 'horizontal' | 'vertical';
}

/**
 * 交互组件渲染器
 * 接收组件配置数组，动态渲染对应的组件
 */
export const InteractiveComponentRenderer = memo(function InteractiveComponentRenderer({
  components,
  messageId,
  onInteraction,
  disabled = false,
  layout,
}: InteractiveComponentRendererProps) {
  const handleAction = useCallback((componentId: string, actionId: string, data?: unknown) => {
    onInteraction({
      componentId,
      actionId,
      data,
      timestamp: Date.now(),
    });
  }, [onInteraction]);

  if (!components || components.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {components.map((component) => {
        switch (component.type) {
          case 'button-group':
            // Override layout if provided from parent
            const buttonGroupConfig = layout 
              ? { ...component, layout } 
              : component;
            return (
              <ButtonGroup
                key={component.id}
                config={buttonGroupConfig}
                onAction={(actionId) => handleAction(component.id, actionId)}
                disabled={disabled}
              />
            );

          case 'choice-card':
            return (
              <ChoiceCard
                key={component.id}
                config={component}
                onAction={(actionId, data) => handleAction(component.id, actionId, data)}
                disabled={disabled}
              />
            );

          case 'summary-card':
            return (
              <SummaryCard
                key={component.id}
                config={component}
                onAction={(actionId) => handleAction(component.id, actionId)}
              />
            );

          case 'progress-card':
            return (
              <ProgressCard
                key={component.id}
                config={component}
                onAction={(actionId) => handleAction(component.id, actionId)}
              />
            );

          case 'code-block':
            // Code blocks should NOT be rendered inline in chat
            // They should be displayed in the WindowViewer (Code Playground)
            // Just skip rendering here
            return null;

          default:
            // 未知类型，返回 null
            console.warn(`Unknown interactive component type: ${(component as InteractiveComponent).type}`);
            return null;
        }
      })}
    </div>
  );
});

// 导出所有组件
export { ButtonGroup } from './ButtonGroup';
export { ChoiceCard } from './ChoiceCard';
export { SummaryCard } from './SummaryCard';
export { ProgressCard } from './ProgressCard';
export { CodeBlock } from './CodeBlock';

export default InteractiveComponentRenderer;
