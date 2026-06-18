import type { ScriptDocument } from './types';
import type { RecentFile } from './types';
import type { CollabHostStatus, CollabInvite, CollabPermission, CollabSession } from './types';

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

export interface BackupInfo {
  path: string;
  directory: string;
  createdAt: string;
}

export interface BackupDirectoryResult {
  path: string;
}

export interface WindowTitlePayload {
  title: string;
  dirty: boolean;
}

export interface ClipboardResult {
  text: string;
}

export interface StartCollabHostOptions {
  userName?: string;
}

export interface JoinCollabRoomOptions {
  invite: string | CollabInvite;
  userName?: string;
}

export interface CreateCollabInviteOptions {
  roomId: string;
  permission: CollabPermission;
}

export interface CollabJoinResult extends FileResult<CollabSession> {}

export interface CollabHostResult extends FileResult<CollabHostStatus> {}

export interface CollabInviteResult extends FileResult<CollabInvite> {}
