import type { ScriptDocument } from './types';

const UNTITLED_TITLES = new Set([
  '',
  'untitled',
  'untitled script',
  'untitled script pilot script',
  'untitled astro script',
  'untitled screenplay'
]);

export function titleFromFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? '';
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Untitled';
}

export function isGenericUntitledTitle(title: string | undefined): boolean {
  return UNTITLED_TITLES.has((title ?? '').trim().toLowerCase());
}

export function documentWithTitleFromSavePath(document: ScriptDocument, filePath: string): ScriptDocument {
  if (!isGenericUntitledTitle(document.title) && !isGenericUntitledTitle(document.titlePage?.title)) return document;

  const title = titleFromFilePath(filePath);
  const nextTitlePage = {
    ...document.titlePage,
    title,
    fields: {
      ...(document.titlePage.fields ?? {}),
      Title: title
    }
  };

  return {
    ...document,
    title,
    titlePage: nextTitlePage,
    updatedAt: new Date().toISOString()
  };
}

export function backupBaseName(document: ScriptDocument, currentPath?: string): string {
  const title = currentPath ? titleFromFilePath(currentPath) : document.title;
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'Untitled';
}
