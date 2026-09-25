/**
 * Entry point cho Module MindMap & Engineering Diagram Visualizer
 */

import './mindmap.css';
import { detectDiagramCategory } from './detectDiagramCategory.ts';
import { renderMemoryLayout } from './renderers/renderMemoryLayout.ts';
import { renderLayeredStack } from './renderers/renderLayeredStack.ts';
import { renderDecisionTree } from './renderers/renderDecisionTree.ts';
import { renderComparisonFlow } from './renderers/renderComparisonFlow.ts';
import { renderLifecycleFlow } from './renderers/renderLifecycleFlow.ts';
import { renderCleanBlueprint } from './renderers/renderCleanBlueprint.ts';

export * from './types.ts';
export * from './knowledgeBase.ts';
export * from './detectDiagramCategory.ts';
export * from './mindMapController.ts';
export {
  renderMemoryLayout,
  renderLayeredStack,
  renderDecisionTree,
  renderComparisonFlow,
  renderLifecycleFlow,
  renderCleanBlueprint,
};

/**
 * Hàm phân phối tổng quát: Tự động chọn parser trực quan phù hợp nhất
 */
export function renderSmartMindMapHtml(diagramText: string, title?: string): string {
  const category = detectDiagramCategory(diagramText, title);

  switch (category) {
    case 'memory-layout':
      return renderMemoryLayout(diagramText, title);
    case 'layered-stack':
      return renderLayeredStack(diagramText, title);
    case 'decision-tree':
      return renderDecisionTree(diagramText, title);
    case 'comparison':
      return renderComparisonFlow(diagramText, title);
    case 'lifecycle-flow':
      return renderLifecycleFlow(diagramText, title);
    case 'blueprint':
    default:
      return renderCleanBlueprint(diagramText, title);
  }
}
