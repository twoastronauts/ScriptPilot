import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importFdx, exportFdx } from '../src/shared/fdx';
import { createDocumentFromPlainText } from '../src/shared/defaultDocument';
import { createPrintableHtml } from '../src/shared/pdf';
import { serializeProject, parseProject } from '../src/shared/projectFile';
import { computeWritingStats } from '../src/shared/stats';
import type { ExportPdfOptions, FileResult, ImportedPdfResult, RecentFilesResult } from '../src/shared/ipc';
import type { RecentFile, ScriptDocument } from '../src/shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'Script Pilot',
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

  installSpellcheckMenu(mainWindow);
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

async function ensureBackupsDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'backups');
  await mkdir(dir, { recursive: true });
  return dir;
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
  const document = ext === '.spx' || ext === '.astrostory' || ext === '.json' ? parseProject(text) : createDocumentFromPlainText(path.basename(filePath, ext), text);
  await rememberRecentFile(filePath, document, ext === '.txt' ? 'text' : 'project', 'open');
  return { canceled: false, path: filePath, data: document };
}

ipcMain.handle('file:open-project', async (): Promise<FileResult<ScriptDocument>> => {
  const result = await dialog.showOpenDialog({
    title: 'Open Script Pilot project',
    filters: [{ name: 'Script Pilot Project', extensions: ['spx', 'astrostory', 'json'] }],
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
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save Script Pilot project',
      defaultPath: `${document.title || 'Untitled'}.spx`,
      filters: [{ name: 'Script Pilot Project', extensions: ['spx'] }]
    });
    if (result.canceled || !result.filePath) return canceled(document);
    filePath = result.filePath;
  }

  await writeFile(filePath, serializeProject(document), 'utf8');
  await rememberRecentFile(filePath, document, 'project', 'save');
  return { canceled: false, path: filePath, data: document };
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
  return { canceled: false, path: filePath, data: document };
});

ipcMain.handle('file:export-pdf', async (_event, document: ScriptDocument, options?: ExportPdfOptions): Promise<FileResult<null>> => {
  const result = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: `${document.title || 'Untitled'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return canceled(null);

  const html = createPrintableHtml(document, options);
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

ipcMain.handle('file:create-backup', async (_event, document: ScriptDocument, currentPath?: string): Promise<FileResult<null>> => {
  const dir = await ensureBackupsDir();
  const baseName = currentPath ? path.basename(currentPath, path.extname(currentPath)) : document.title || 'Untitled';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dir, `${baseName}.${stamp}.spx`);
  await writeFile(backupPath, serializeProject(document), 'utf8');
  return { canceled: false, path: backupPath, data: null };
});

ipcMain.handle('file:restore-backup', async (): Promise<FileResult<ScriptDocument>> => {
  const dir = await ensureBackupsDir();
  const result = await dialog.showOpenDialog({
    title: 'Restore backup',
    defaultPath: existsSync(dir) ? dir : app.getPath('documents'),
    filters: [{ name: 'Script Pilot Project', extensions: ['spx', 'astrostory', 'json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return canceled(createDocumentFromPlainText('Untitled', ''));
  const text = await readFile(result.filePaths[0], 'utf8');
  return { canceled: false, path: result.filePaths[0], data: parseProject(text) };
});
