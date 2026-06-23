import { createProductionPaginationPlan, type ProductionPaginationPlan } from '../shared/formattingV2';
import { runScriptDoctor, type ScriptDoctorReport } from '../shared/scriptDoctor';
import { computeWritingStats, type WritingStats } from '../shared/stats';
import type { ScriptDocument } from '../shared/types';

export interface ScriptDoctorWorkerRequest {
  requestId: number;
  document: ScriptDocument;
}

export interface ScriptDoctorWorkerResult {
  requestId: number;
  report: ScriptDoctorReport;
  stats: WritingStats;
  pagination: ProductionPaginationPlan;
}

export interface ScriptDoctorWorkerError {
  requestId: number;
  error: string;
}

self.addEventListener('message', (event: MessageEvent<ScriptDoctorWorkerRequest>) => {
  const { requestId, document } = event.data;
  try {
    const leanDocument = {
      ...document,
      elements: document.elements.map((element) => ({
        ...element,
        fdx: undefined
      })),
      fdxShadow: document.fdxShadow
        ? {
            ...document.fdxShadow,
            originalXml: '',
            rawRoot: undefined
          }
        : undefined
    };
    const result: ScriptDoctorWorkerResult = {
      requestId,
      report: runScriptDoctor(leanDocument, { maxElements: 900, maxSpellingElements: 320 }),
      stats: computeWritingStats(leanDocument),
      pagination: createProductionPaginationPlan(leanDocument.elements, leanDocument.settings.pageNumberStart)
    };
    self.postMessage(result);
  } catch (error) {
    const result: ScriptDoctorWorkerError = {
      requestId,
      error: error instanceof Error ? error.message : 'Script Doctor failed.'
    };
    self.postMessage(result);
  }
});
