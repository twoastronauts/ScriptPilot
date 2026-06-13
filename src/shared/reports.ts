import { computeWritingStats } from './stats';
import type { ProductionTag, ScriptDocument } from './types';

export interface ProductionReport {
  category: ProductionTag['category'];
  label: string;
  count: number;
  scenes: string[];
}

export function buildProductionReports(document: ScriptDocument): ProductionReport[] {
  const reports = new Map<string, ProductionReport>();
  let currentScene = 'Unscened';

  for (const element of document.elements) {
    if (element.type === 'scene-heading') currentScene = element.text;

    for (const tag of element.productionTags) {
      const key = `${tag.category}:${tag.label}`;
      if (!reports.has(key)) {
        reports.set(key, {
          category: tag.category,
          label: tag.label,
          count: 0,
          scenes: []
        });
      }
      const report = reports.get(key)!;
      report.count += 1;
      if (!report.scenes.includes(currentScene)) report.scenes.push(currentScene);
    }
  }

  return Array.from(reports.values()).sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

export function exportNavigatorCsv(document: ScriptDocument): string {
  const stats = computeWritingStats(document);
  const rows = [
    ['Scene', 'Page', 'Characters', 'Tags', 'Notes'],
    ...stats.scenesList.map((scene) => [
      scene.heading,
      String(scene.page),
      scene.characters.join('; '),
      String(scene.productionTagCount),
      String(scene.noteCount)
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
