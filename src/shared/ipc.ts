import type { ScriptDocument } from './types';
import type { RecentFile } from './types';

export interface FileResult<T> {
  canceled: boolean;
  path?: string;
  data: T;
}

export interface ExportPdfOptions {
  includeTitlePage?: boolean;
  includeStructureLines?: boolean;
  includeWatermark?: boolean;
  watermarkText?: string;
  matchDisplayColors?: boolean;
}

export interface ImportedPdfResult extends FileResult<ScriptDocument> {
  warning?: string;
}

export interface RecentFilesResult {
  files: RecentFile[];
}
