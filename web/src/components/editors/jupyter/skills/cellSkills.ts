/**
 * Jupyter Cell Agent Skills
 *
 * Defines Jupyter cell operations as agent-invocable skills.
 * These skills can be triggered by the workspace agent via UIDirectives
 * or by direct function call from the AI copilot.
 *
 * Skill Categories:
 * - Cell Management: create, delete, move, change type
 * - Execution: run cell, run all, interrupt
 * - Content: update source, clear outputs
 * - Analysis: inspect variables, explain output
 */

import type { UIDirectiveType } from '@/lib/sync/types';

// ============================================================
// Types
// ============================================================

export interface CellSkill {
  /** Unique skill identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description for the agent */
  description: string;
  /** Maps to UIDirective type */
  directiveType: UIDirectiveType | string;
  /** Required parameters */
  params: SkillParam[];
  /** Skill category */
  category: 'cell-management' | 'execution' | 'content' | 'analysis';
}

export interface SkillParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description: string;
}

// ============================================================
// Skill Definitions
// ============================================================

export const jupyterCellSkills: CellSkill[] = [
  // ── Cell Management ──
  {
    id: 'jupyter.cell.create',
    name: 'Create Cell',
    description: 'Add a new code or markdown cell to the notebook',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'cell-management',
    params: [
      { name: 'type', type: 'string', required: true, description: 'Cell type: "code" or "markdown"' },
      { name: 'source', type: 'string', required: false, description: 'Initial cell source content' },
      { name: 'afterCellId', type: 'string', required: false, description: 'Insert after this cell ID' },
    ],
  },
  {
    id: 'jupyter.cell.delete',
    name: 'Delete Cell',
    description: 'Remove a cell from the notebook',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'cell-management',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'ID of the cell to delete' },
    ],
  },
  {
    id: 'jupyter.cell.move',
    name: 'Move Cell',
    description: 'Move a cell up or down in the notebook',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'cell-management',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'ID of the cell to move' },
      { name: 'direction', type: 'string', required: true, description: '"up" or "down"' },
    ],
  },
  {
    id: 'jupyter.cell.changeType',
    name: 'Change Cell Type',
    description: 'Convert a cell between code and markdown types',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'cell-management',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'ID of the cell to change' },
      { name: 'newType', type: 'string', required: true, description: '"code" or "markdown"' },
    ],
  },

  // ── Execution ──
  {
    id: 'jupyter.cell.execute',
    name: 'Execute Cell',
    description: 'Run a specific cell in the kernel',
    directiveType: 'EXECUTE_CELL',
    category: 'execution',
    params: [
      { name: 'cellId', type: 'string', required: false, description: 'Cell ID (defaults to active cell)' },
      { name: 'cellIndex', type: 'number', required: false, description: 'Cell index (alternative to cellId)' },
    ],
  },
  {
    id: 'jupyter.cell.executeAll',
    name: 'Execute All Cells',
    description: 'Run all cells in the notebook sequentially',
    directiveType: 'EXECUTE_CELL',
    category: 'execution',
    params: [
      { name: 'all', type: 'boolean', required: true, description: 'Must be true' },
    ],
  },
  {
    id: 'jupyter.cell.createAndRun',
    name: 'Create and Run Cell',
    description: 'Create a new code cell with content and immediately execute it',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'execution',
    params: [
      { name: 'source', type: 'string', required: true, description: 'Python code to execute' },
      { name: 'execute', type: 'boolean', required: true, description: 'Must be true' },
    ],
  },

  // ── Content ──
  {
    id: 'jupyter.cell.updateSource',
    name: 'Update Cell Source',
    description: 'Modify the source content of a cell',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'content',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'Cell to update' },
      { name: 'source', type: 'string', required: true, description: 'New source content' },
    ],
  },
  {
    id: 'jupyter.cell.clearOutputs',
    name: 'Clear All Outputs',
    description: 'Remove all cell execution outputs',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'content',
    params: [],
  },

  // ── Analysis ──
  {
    id: 'jupyter.cell.explainOutput',
    name: 'Explain Cell Output',
    description: 'Use AI to explain the output of a cell',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'analysis',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'Cell whose output to explain' },
    ],
  },
  {
    id: 'jupyter.cell.suggestFix',
    name: 'Suggest Fix for Error',
    description: 'Analyze an error output and suggest code fixes',
    directiveType: 'UPDATE_NOTEBOOK',
    category: 'analysis',
    params: [
      { name: 'cellId', type: 'string', required: true, description: 'Cell with error output' },
    ],
  },
];

// ============================================================
// Skill Registry
// ============================================================

const skillMap = new Map(jupyterCellSkills.map(s => [s.id, s]));

/** Get a skill definition by ID */
export function getCellSkill(skillId: string): CellSkill | undefined {
  return skillMap.get(skillId);
}

/** Get all skills in a category */
export function getCellSkillsByCategory(category: CellSkill['category']): CellSkill[] {
  return jupyterCellSkills.filter(s => s.category === category);
}

/** Format skills as a tool description for the agent */
export function formatSkillsForAgent(): string {
  const groups = {
    'cell-management': 'Cell Management',
    'execution': 'Execution',
    'content': 'Content',
    'analysis': 'Analysis',
  };

  let output = '## Available Jupyter Skills\n\n';

  for (const [category, label] of Object.entries(groups)) {
    const skills = getCellSkillsByCategory(category as CellSkill['category']);
    if (skills.length === 0) continue;

    output += `### ${label}\n`;
    for (const skill of skills) {
      output += `- **${skill.id}**: ${skill.description}\n`;
      if (skill.params.length > 0) {
        output += `  Params: ${skill.params.map(p => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')}\n`;
      }
    }
    output += '\n';
  }

  return output;
}
