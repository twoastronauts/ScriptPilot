import type { ExportPdfOptions, FileResult, ImportedPdfResult } from './ipc';
import type { ProductionReport } from './reports';
import type { ScriptDocument } from './types';

export interface FdxImporter {
  import(xml: string, sourcePath?: string): ScriptDocument;
}

export interface FdxExporter {
  export(document: ScriptDocument): string;
}

export interface PdfExporter {
  export(document: ScriptDocument, options?: ExportPdfOptions): Promise<FileResult<null>>;
}

export interface PdfTextImporter {
  importTextPdf(): Promise<ImportedPdfResult>;
}

export interface ReportExporter {
  productionReports(document: ScriptDocument): ProductionReport[];
  navigatorCsv(document: ScriptDocument): string;
}

export type CollabStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface CollabProvider {
  readonly status: CollabStatus;
  connect(documentId: string, endpoint?: string): Promise<void>;
  disconnect(): Promise<void>;
  encodeLocalState(document: ScriptDocument): Uint8Array;
  applyRemoteUpdate(document: ScriptDocument, update: Uint8Array): ScriptDocument;
  onStatusChange(listener: (status: CollabStatus) => void): () => void;
}
