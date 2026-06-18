import { contextBridge, ipcRenderer } from 'electron';
import type {
  BackupDirectoryResult,
  BackupInfo,
  CollabHostResult,
  CollabInviteResult,
  CollabJoinResult,
  ClipboardResult,
  CreateCollabInviteOptions,
  ExportPdfOptions,
  FileResult,
  ImportedPdfResult,
  JoinCollabRoomOptions,
  RecentFilesResult,
  StartCollabHostOptions,
  WindowTitlePayload
} from '../src/shared/ipc';
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
  createBackup: (document: ScriptDocument, path?: string): Promise<FileResult<BackupInfo>> =>
    ipcRenderer.invoke('file:create-backup', document, path),
  restoreBackup: (): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:restore-backup'),
  getBackupDirectory: (): Promise<FileResult<BackupDirectoryResult>> => ipcRenderer.invoke('file:get-backup-directory'),
  openBackupDirectory: (): Promise<FileResult<BackupDirectoryResult>> => ipcRenderer.invoke('file:open-backup-directory'),
  listRecentFiles: (): Promise<RecentFilesResult> => ipcRenderer.invoke('file:list-recent'),
  openRecentFile: (path: string): Promise<FileResult<ScriptDocument>> => ipcRenderer.invoke('file:open-recent', path),
  setWindowTitle: (payload: WindowTitlePayload): Promise<void> => ipcRenderer.invoke('window:set-title', payload),
  copyToClipboard: (text: string): Promise<FileResult<ClipboardResult>> => ipcRenderer.invoke('clipboard:copy', text),
  startCollabHost: (document: ScriptDocument, options?: StartCollabHostOptions): Promise<CollabHostResult> =>
    ipcRenderer.invoke('collab:start-host', document, options),
  stopCollabHost: (roomId: string): Promise<FileResult<null>> => ipcRenderer.invoke('collab:stop-host', roomId),
  joinCollabRoom: (options: JoinCollabRoomOptions): Promise<CollabJoinResult> => ipcRenderer.invoke('collab:join-room', options),
  createCollabInvite: (options: CreateCollabInviteOptions): Promise<CollabInviteResult> => ipcRenderer.invoke('collab:create-invite', options),
  getCollabStatus: (): Promise<CollabHostResult | FileResult<null>> => ipcRenderer.invoke('collab:get-status')
};

contextBridge.exposeInMainWorld('screenwriter', api);

export type ScreenwriterApi = typeof api;
