import { contextBridge, ipcRenderer } from 'electron';
import type { ExportPdfOptions, FileResult, ImportedPdfResult, RecentFilesResult } from '../src/shared/ipc';
import type { ScriptDocument } from '../src/shared/types';

const api = {
  openProject: (): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:open-project'),
  saveProject: (document: ScriptDocument, path?: string): Promise<FileResult<ScriptDocument>> =>
    ipcRenderer.invoke('file:save-project', document, path),
  openFdx: (): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:open-fdx'),
  saveFdx: (document: ScriptDocument, path?: string): Promise<FileResult<ScriptDocument>> =>
    ipcRenderer.invoke('file:save-fdx', document, path),
  exportPdf: (document: ScriptDocument, options?: ExportPdfOptions): Promise<FileResult<null>> =>
    ipcRenderer.invoke('file:export-pdf', document, options),
  importTextPdf: (): Promise<ImportedPdfResult> => ipcRenderer.invoke('file:import-text-pdf'),
  createBackup: (document: ScriptDocument, path?: string): Promise<FileResult<null>> =>
    ipcRenderer.invoke('file:create-backup', document, path),
  restoreBackup: (): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:restore-backup'),
  listRecentFiles: (): Promise<RecentFilesResult> => ipcRenderer.invoke('file:list-recent'),
  openRecentFile: (path: string): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:open-recent', path)
};

contextBridge.exposeInMainWorld('screenwriter', api);

export type ScreenwriterApi = typeof api;
