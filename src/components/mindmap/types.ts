/**
 * Các kiểu dữ liệu và interface dùng chung cho hệ thống Mindmap & Sơ đồ kỹ thuật
 */

export type DiagramCategory =
  | 'memory-layout'
  | 'layered-stack'
  | 'decision-tree'
  | 'comparison'
  | 'lifecycle-flow'
  | 'blueprint';

export interface MindMapKnowledgeItem {
  id: string;
  tierNumber: string;
  tierTitle: string;
  tierColor: string;
  nodeTitle: string;
  icon: string;
  concept: string;
  specs: Array<{ label: string; value: string }>;
  codeSnippet: string;
  gotchas: string;
}

export interface ParsedDecisionBranch {
  condition: string;
  recommendation: string;
  badgeType: 'positive' | 'caution' | 'danger';
  badgeLabel: string;
  codeSnippet?: string;
  details?: string[];
}

export interface ParsedLayer {
  layerNumber: string;
  layerTitle: string;
  connectorText?: string;
  items: Array<{ title: string; subtitle?: string }>;
}

export interface ParsedFlowStep {
  stepNumber: number;
  title: string;
  subtitle?: string;
}
