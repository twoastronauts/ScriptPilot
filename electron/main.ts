import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell, systemPreferences } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { importFdx, exportFdx } from '../src/shared/fdx';
import { createDocumentFromPlainText } from '../src/shared/defaultDocument';
import { createPrintableHtml } from '../src/shared/pdf';
import { serializeProject, parseProject } from '../src/shared/projectFile';
import { computeWritingStats } from '../src/shared/stats';
import { backupBaseName, documentWithTitleFromSavePath } from '../src/shared/fileSafety';
import { documentToYDoc } from '../src/shared/collaboration';
import type {
  BackupDirectoryResult,
  BackupInfo,
  ClipboardResult,
  CollabHostResult,
  CollabInviteResult,
  CollabJoinResult,
  CreateCollabInviteOptions,
  ExportPdfOptions,
  FileResult,
  ImportedPdfResult,
  JoinCollabRoomOptions,
  RecentFilesResult,
  StartCollabHostOptions,
  WindowTitlePayload
} from '../src/shared/ipc';
import type { CollabHostStatus, CollabInvite, CollabPermission, CollabSession, RecentFile, ScriptDocument } from '../src/shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const APP_DISPLAY_NAME = 'Script Pilot V02';
const PROJECT_EXTENSIONS = ['spx', 'spx2', 'astrostory', 'json'];
const COLLAB_HOST_ADDRESS = '0.0.0.0';

app.setName(APP_DISPLAY_NAME);
app.setPath('userData', path.join(app.getPath('appData'), APP_DISPLAY_NAME));

let mainWindow: BrowserWindow | null = null;

interface CollabHostRecord {
  server: Server;
  status: CollabHostStatus;
  tokens: Map<string, CollabPermission>;
  storagePath: string;
}

const collabHosts = new Map<string, CollabHostRecord>();

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: APP_DISPLAY_NAME,
    backgroundColor: '#f2f0eb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  nativeTheme.themeSource = 'system';

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  installMediaPermissions(mainWindow);
  installSpellcheckMenu(mainWindow);
}

function installMediaPermissions(window: BrowserWindow): void {
  const session = window.webContents.session;
  if (process.platform === 'darwin') {
    void systemPreferences.askForMediaAccess('microphone').catch(() => false);
  }
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
}

function installSpellcheckMenu(window: BrowserWindow): void {
  window.webContents.session.setSpellCheckerLanguages(['en-US']);
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable || !params.misspelledWord) return;

    const suggestions = params.dictionarySuggestions.slice(0, 7);
    const template = suggestions.length
      ? suggestions.map((suggestion) => ({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion)
        }))
      : [{ label: 'No spelling suggestions', enabled: false }];

    Menu.buildFromTemplate([
      ...template,
      { type: 'separator' },
      {
        label: `Add "${params.misspelledWord}" to dictionary`,
        click: () => window.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }
    ]).popup({ window });
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function canceled<T>(fallback: T): FileResult<T> {
  return { canceled: true, data: fallback };
}

function windowTitle(payload: WindowTitlePayload): string {
  const title = payload.title.trim() || 'Untitled Script';
  return `${APP_DISPLAY_NAME} - ${title}${payload.dirty ? ' *' : ''}`;
}

function setMainWindowTitle(payload: WindowTitlePayload): void {
  mainWindow?.setTitle(windowTitle(payload));
}

async function ensureBackupsDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'backups');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensureCollabDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'collab-rooms');
  await mkdir(dir, { recursive: true });
  return dir;
}

function getLanAddress(): string {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

function createCollabToken(): string {
  return randomUUID().replace(/-/g, '');
}

function createInvite(status: CollabHostStatus, token: string, permission: CollabPermission): CollabInvite {
  const appUrl = `scriptpilot://collab/join?host=${encodeURIComponent(status.host)}&port=${status.port}&room=${encodeURIComponent(status.roomId)}&token=${encodeURIComponent(token)}&permission=${permission}`;
  const manualCode = JSON.stringify({
    host: status.host,
    port: status.port,
    roomId: status.roomId,
    roomName: status.roomName,
    token,
    permission
  });
  return {
    roomId: status.roomId,
    roomName: status.roomName,
    url: status.url,
    host: status.host,
    port: status.port,
    token,
    permission,
    appUrl,
    manualCode
  };
}

function parseInvite(invite: string | CollabInvite): CollabInvite {
  if (typeof invite !== 'string') return invite;
  const trimmed = invite.trim();
  if (trimmed.startsWith('scriptpilot://')) {
    const parsed = new URL(trimmed);
    const host = parsed.searchParams.get('host') || '127.0.0.1';
    const port = Number(parsed.searchParams.get('port') || '0');
    const roomId = parsed.searchParams.get('room') || '';
    const token = parsed.searchParams.get('token') || '';
    const permission = (parsed.searchParams.get('permission') || 'edit') as CollabPermission;
    const roomName = parsed.searchParams.get('name') || roomId;
    const url = `ws://${host}:${port}`;
    return { roomId, roomName, url, host, port, token, permission, appUrl: trimmed, manualCode: trimmed };
  }

  const parsed = JSON.parse(trimmed) as Partial<CollabInvite> & { room?: string };
  const roomId = parsed.roomId ?? parsed.room ?? '';
  const host = parsed.host ?? '127.0.0.1';
  const port = Number(parsed.port ?? 0);
  const url = parsed.url ?? `ws://${host}:${port}`;
  const permission = (parsed.permission ?? 'edit') as CollabPermission;
  const token = parsed.token ?? '';
  return {
    roomId,
    roomName: parsed.roomName ?? roomId,
    url,
    host,
    port,
    token,
    permission,
    appUrl: parsed.appUrl ?? `scriptpilot://collab/join?host=${encodeURIComponent(host)}&port=${port}&room=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}&permission=${permission}`,
    manualCode: trimmed
  };
}

function recentFilesPath(): string {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

async function readRecentFiles(): Promise<RecentFile[]> {
  try {
    const text = await readFile(recentFilesPath(), 'utf8');
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RecentFile => typeof item === 'object' && item !== null && 'path' in item);
  } catch {
    return [];
  }
}

async function writeRecentFiles(files: RecentFile[]): Promise<void> {
  await mkdir(path.dirname(recentFilesPath()), { recursive: true });
  await writeFile(recentFilesPath(), JSON.stringify(files.slice(0, 18), null, 2), 'utf8');
}

async function rememberRecentFile(filePath: string, document: ScriptDocument, type: RecentFile['type'], event: 'open' | 'save' = 'open'): Promise<void> {
  const files = await readRecentFiles();
  const stats = computeWritingStats(document);
  const existing = files.find((item) => item.path === filePath);
  const timestamp = new Date().toISOString();
  const color = document.revisions.find((revision) => revision.active)?.color ?? document.structureRanges[0]?.color ?? '#55b8c7';
  const entry: RecentFile = {
    path: filePath,
    title: document.title || path.basename(filePath, path.extname(filePath)),
    type,
    color,
    lastOpenedAt: existing?.lastOpenedAt ?? timestamp,
    lastSavedAt: event === 'save' ? timestamp : existing?.lastSavedAt,
    metadata: {
      format: document.format,
      pages: stats.pages,
      scenes: stats.scenes,
      characters: stats.characters.length,
      revisions: document.elements.filter((element) => element.revisionColor).length,
      words: stats.words
    }
  };

  if (event === 'open') entry.lastOpenedAt = timestamp;
  await writeRecentFiles([entry, ...files.filter((item) => item.path !== filePath)]);
}

async function openFilePath(filePath: string): Promise<FileResult<ScriptDocument>> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.fdx') {
    const xml = await readFile(filePath, 'utf8');
    const document = importFdx(xml, filePath);
    await rememberRecentFile(filePath, document, 'fdx', 'open');
    return { canceled: false, path: filePath, data: document };
  }

  const text = await readFile(filePath, 'utf8');
  const document = ext === '.spx2' || ext === '.spx' || ext === '.astrostory' || ext === '.json' ? parseProject(text) : createDocumentFromPlainText(path.basename(filePath, ext), text);
  await rememberRecentFile(filePath, document, ext === '.txt' ? 'text' : 'project', 'open');
  return { canceled: false, path: filePath, data: document };
}

ipcMain.handle('file:open-project', async (): Promise<FileResult<ScriptDocument>> => {
  const result = await dialog.showOpenDialog({
    title: 'Open Script Pilot project',
    filters: [{ name: 'Script Pilot Project', extensions: PROJECT_EXTENSIONS }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return canceled(createDocumentFromPlainText('Untitled', ''));

  const filePath = result.filePaths[0];
  const text = await readFile(filePath, 'utf8');
  const document = parseProject(text);
  await rememberRecentFile(filePath, document, 'project', 'open');
  return { canceled: false, path: filePath, data: document };
});

ipcMain.handle('file:save-project', async (_event, document: ScriptDocument, existingPath?: string): Promise<FileResult<ScriptDocument>> => {
  let filePath = existingPath;
  const firstSave = !filePath;
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save Script Pilot V02 project',
      defaultPath: `${document.title || 'Untitled'}.spx`,
      filters: [{ name: 'Script Pilot Project', extensions: ['spx'] }]
    });
    if (result.canceled || !result.filePath) return canceled(document);
    filePath = result.filePath;
  }

  const savedDocument = firstSave ? documentWithTitleFromSavePath(document, filePath) : document;
  await writeFile(filePath, serializeProject(savedDocument), 'utf8');
  await rememberRecentFile(filePath, savedDocument, 'project', 'save');
  setMainWindowTitle({ title: savedDocument.title, dirty: false });
  return { canceled: false, path: filePath, data: savedDocument };
});

ipcMain.handle('file:open-fdx', async (): Promise<FileResult<ScriptDocument>> => {
  const result = await dialog.showOpenDialog({
    title: 'Open FDX screenplay',
    filters: [{ name: 'Final Draft XML', extensions: ['fdx'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return canceled(createDocumentFromPlainText('Untitled', ''));

  const filePath = result.filePaths[0];
  const xml = await readFile(filePath, 'utf8');
  const document = importFdx(xml, filePath);
  await rememberRecentFile(filePath, document, 'fdx', 'open');
  return { canceled: false, path: filePath, data: document };
});

ipcMain.handle('file:save-fdx', async (_event, document: ScriptDocument, existingPath?: string): Promise<FileResult<ScriptDocument>> => {
  let filePath = existingPath;
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save FDX screenplay',
      defaultPath: `${document.title || 'Untitled'}.fdx`,
      filters: [{ name: 'Final Draft XML', extensions: ['fdx'] }]
    });
    if (result.canceled || !result.filePath) return canceled(document);
    filePath = result.filePath;
  }

  await writeFile(filePath, exportFdx(document), 'utf8');
  await rememberRecentFile(filePath, document, 'fdx', 'save');
  setMainWindowTitle({ title: document.title, dirty: false });
  return { canceled: false, path: filePath, data: document };
});

ipcMain.handle('file:export-pdf', async (_event, document: ScriptDocument, options?: ExportPdfOptions): Promise<FileResult<null>> => {
  const exportOptions: ExportPdfOptions = {
    ...options,
    matchDisplayColors: false
  };

  if (options?.promptForNolanMode) {
    const choice = await dialog.showMessageBox({
      type: 'question',
      title: 'Export PDF',
      message: 'Export PDF options',
      detail: 'Normal exports use white pages with black screenplay text.',
      buttons: ['Continue', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: 'Nolan proof style: red background with black text',
      checkboxChecked: Boolean(options.nolanMode)
    });

    if (choice.response === 1) return canceled(null);
    exportOptions.nolanMode = Boolean(choice.checkboxChecked);
  }

  const result = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: `${document.title || 'Untitled'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return canceled(null);

  const html = createPrintableHtml(document, exportOptions);
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await printWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'Letter',
    margins: {
      marginType: 'custom',
      top: 0.5,
      bottom: 0.5,
      left: 0.5,
      right: 0.5
    }
  });
  await writeFile(result.filePath, pdf);
  printWindow.destroy();
  if (exportOptions.openAfterExport ?? true) {
    shell.showItemInFolder(result.filePath);
  }

  return { canceled: false, path: result.filePath, data: null };
});

ipcMain.handle('file:import-text-pdf', async (): Promise<ImportedPdfResult> => {
  const result = await dialog.showOpenDialog({
    title: 'Import text-based PDF or plain text',
    filters: [
      { name: 'Text or PDF', extensions: ['txt', 'pdf'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'PDF', extensions: ['pdf'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true, data: createDocumentFromPlainText('Untitled', '') };
  }

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return {
      canceled: false,
      path: filePath,
      warning: 'PDF text extraction is staged behind the adapter boundary; import plain text for this build.',
      data: createDocumentFromPlainText(path.basename(filePath, ext), '')
    };
  }

  const text = await readFile(filePath, 'utf8');
  const document = createDocumentFromPlainText(path.basename(filePath, ext), text);
  await rememberRecentFile(filePath, document, 'text', 'open');
  return { canceled: false, path: filePath, data: document };
});

ipcMain.handle('file:list-recent', async (): Promise<RecentFilesResult> => ({
  files: await readRecentFiles()
}));

ipcMain.handle('file:open-recent', async (_event, filePath: string): Promise<FileResult<ScriptDocument>> => {
  if (!existsSync(filePath)) {
    const files = await readRecentFiles();
    await writeRecentFiles(files.filter((item) => item.path !== filePath));
    return canceled(createDocumentFromPlainText('Missing file', ''));
  }

  return openFilePath(filePath);
});

ipcMain.handle('file:get-backup-directory', async (): Promise<FileResult<BackupDirectoryResult>> => {
  const dir = await ensureBackupsDir();
  return { canceled: false, path: dir, data: { path: dir } };
});

ipcMain.handle('file:open-backup-directory', async (): Promise<FileResult<BackupDirectoryResult>> => {
  const dir = await ensureBackupsDir();
  await shell.openPath(dir);
  return { canceled: false, path: dir, data: { path: dir } };
});

ipcMain.handle('file:create-backup', async (_event, document: ScriptDocument, currentPath?: string): Promise<FileResult<BackupInfo>> => {
  const dir = await ensureBackupsDir();
  const baseName = backupBaseName(document, currentPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const createdAt = new Date().toISOString();
  const backupPath = path.join(dir, `${baseName}.${stamp}.spx`);
  await writeFile(backupPath, serializeProject(document), 'utf8');
  return { canceled: false, path: backupPath, data: { path: backupPath, directory: dir, createdAt } };
});

ipcMain.handle('file:restore-backup', async (): Promise<FileResult<ScriptDocument>> => {
  const dir = await ensureBackupsDir();
  const result = await dialog.showOpenDialog({
    title: 'Restore backup',
    defaultPath: existsSync(dir) ? dir : app.getPath('documents'),
    filters: [{ name: 'Script Pilot Project', extensions: PROJECT_EXTENSIONS }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return canceled(createDocumentFromPlainText('Untitled', ''));
  const text = await readFile(result.filePaths[0], 'utf8');
  return { canceled: false, path: result.filePaths[0], data: parseProject(text) };
});

ipcMain.handle('window:set-title', async (_event, payload: WindowTitlePayload): Promise<void> => {
  setMainWindowTitle(payload);
});

ipcMain.handle('clipboard:copy', async (_event, text: string): Promise<FileResult<ClipboardResult>> => {
  clipboard.writeText(text);
  return { canceled: false, data: { text: clipboard.readText() } };
});

ipcMain.handle('collab:start-host', async (_event, document: ScriptDocument, options?: StartCollabHostOptions): Promise<CollabHostResult> => {
  for (const [roomId, host] of collabHosts) {
    await host.server.destroy();
    host.status.status = 'ended';
    host.status.endedAt = new Date().toISOString();
    collabHosts.delete(roomId);
  }

  const roomId = randomUUID();
  const hostName = getLanAddress();
  const token = createCollabToken();
  const tokens = new Map<string, CollabPermission>([[token, 'host']]);
  const collabDir = await ensureCollabDir();
  const storagePath = path.join(collabDir, `${roomId}.bin`);
  const seedUpdate = Y.encodeStateAsUpdate(documentToYDoc(document));

  const server = new Server({
    port: 0,
    address: COLLAB_HOST_ADDRESS,
    quiet: true,
    async onAuthenticate({ token: receivedToken }) {
      const permission = tokens.get(receivedToken);
      if (!permission) throw new Error('This Script Pilot collaboration invite is no longer valid.');
      return { permission, userName: options?.userName ?? 'Host' };
    },
    async onLoadDocument() {
      const ydoc = new Y.Doc();
      if (existsSync(storagePath)) {
        Y.applyUpdate(ydoc, await readFile(storagePath));
      } else {
        Y.applyUpdate(ydoc, seedUpdate);
      }
      return ydoc;
    },
    async onStoreDocument({ document }) {
      await mkdir(path.dirname(storagePath), { recursive: true });
      await writeFile(storagePath, Y.encodeStateAsUpdate(document));
    }
  });

  await server.listen(0);
  const address = server.address;
  const port = typeof address === 'string' ? 0 : address.port;
  const statusBase: CollabHostStatus = {
    roomId,
    roomName: document.title || 'Untitled Script',
    url: `ws://${hostName}:${port}`,
    host: hostName,
    port,
    startedAt: new Date().toISOString(),
    status: 'hosting',
    isHost: true,
    invite: {} as CollabInvite
  };
  statusBase.invite = createInvite(statusBase, token, 'host');

  collabHosts.set(roomId, { server, status: statusBase, tokens, storagePath });
  return { canceled: false, path: statusBase.invite.appUrl, data: statusBase };
});

ipcMain.handle('collab:stop-host', async (_event, roomId: string): Promise<FileResult<null>> => {
  const host = collabHosts.get(roomId);
  if (!host) return { canceled: false, data: null };
  await host.server.destroy();
  host.status.status = 'ended';
  host.status.endedAt = new Date().toISOString();
  collabHosts.delete(roomId);
  return { canceled: false, data: null };
});

ipcMain.handle('collab:create-invite', async (_event, options: CreateCollabInviteOptions): Promise<CollabInviteResult> => {
  const host = collabHosts.get(options.roomId);
  if (!host) return canceled({} as CollabInvite);
  const token = createCollabToken();
  host.tokens.set(token, options.permission);
  const invite = createInvite(host.status, token, options.permission);
  return { canceled: false, path: invite.appUrl, data: invite };
});

ipcMain.handle('collab:join-room', async (_event, options: JoinCollabRoomOptions): Promise<CollabJoinResult> => {
  const invite = parseInvite(options.invite);
  const session: CollabSession = {
    roomId: invite.roomId,
    roomName: invite.roomName || invite.roomId,
    url: invite.url,
    token: invite.token,
    permission: invite.permission,
    isHost: false,
    status: 'joining',
    invite
  };
  return { canceled: false, path: invite.appUrl, data: session };
});

ipcMain.handle('collab:get-status', async (): Promise<CollabHostResult | FileResult<null>> => {
  const host = Array.from(collabHosts.values())[0];
  if (!host) return { canceled: false, data: null };
  return { canceled: false, path: host.status.invite.appUrl, data: host.status };
});
