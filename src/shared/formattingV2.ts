import { v4 as uuid } from 'uuid';
import { lineWidthFor, normalizeCharacterName } from './screenplay';
import type { DraftVersion, RevisionMemo, ScriptDocument, ScriptElement } from './types';

export interface ProductionPage {
  pageNumber: number;
  elementIds: string[];
  lineCount: number;
  moreAfterElementId?: string;
}

export interface ProductionPaginationPlan {
  pages: ProductionPage[];
  continuedCharacterElementIds: string[];
  moreAfterElementIds: string[];
  lockedPageElementIds: string[];
}

const LINES_PER_PAGE = 54;

export function createProductionPaginationPlan(elements: ScriptElement[], pageNumberStart = 1): ProductionPaginationPlan {
  const pages: ProductionPage[] = [{ pageNumber: pageNumberStart, elementIds: [], lineCount: 0 }];
  const continuedCharacterElementIds: string[] = [];
  const moreAfterElementIds: string[] = [];
  const lockedPageElementIds: string[] = [];
  let previousCharacter = '';
  let previousWasDialogue = false;

  for (const element of elements) {
    if (element.lockedPage) lockedPageElementIds.push(element.id);

    if (element.type === 'page-break') {
      ensureNextPage(pages, pageNumberStart);
      previousWasDialogue = false;
      continue;
    }

    const needed = estimateProductionLines(element);
    const page = pages[pages.length - 1];
    if (page.elementIds.length && page.lineCount + needed > LINES_PER_PAGE) {
      const lastElementId = page.elementIds.at(-1);
      if (lastElementId) {
        page.moreAfterElementId = lastElementId;
        moreAfterElementIds.push(lastElementId);
      }
      ensureNextPage(pages, pageNumberStart);
    }

    if (element.type === 'character') {
      const character = normalizeCharacterName(element.text);
      if (previousWasDialogue && character && character === previousCharacter) continuedCharacterElementIds.push(element.id);
      previousCharacter = character;
      previousWasDialogue = false;
    } else if (element.type === 'dialogue') {
      previousWasDialogue = true;
    } else if (element.type !== 'parenthetical') {
      previousWasDialogue = false;
    }

    const nextPage = pages[pages.length - 1];
    nextPage.elementIds.push(element.id);
    nextPage.lineCount += needed;
  }

  return {
    pages,
    continuedCharacterElementIds,
    moreAfterElementIds,
    lockedPageElementIds
  };
}

export function createDraftVersion(document: ScriptDocument, label = 'Draft snapshot', note?: string): DraftVersion {
  return {
    id: uuid(),
    label,
    note,
    createdAt: new Date().toISOString(),
    elementCount: document.elements.filter((element) => element.type !== 'page-break').length,
    wordCount: document.elements.reduce((sum, element) => sum + (element.text.match(/[A-Za-z']+/g)?.length ?? 0), 0),
    revisionSetId: document.revisions.find((revision) => revision.active)?.id
  };
}

export function createRevisionMemo(document: ScriptDocument, revisionSetId = document.revisions.find((revision) => revision.active)?.id ?? ''): RevisionMemo {
  const revisionSet = document.revisions.find((revision) => revision.id === revisionSetId);
  const changedElementIds = document.elements
    .filter((element) => element.revisionSetId === revisionSetId || (!revisionSetId && element.revisionColor))
    .map((element) => element.id);
  return {
    id: uuid(),
    revisionSetId,
    title: revisionSet ? `${revisionSet.name} memo` : 'Revision memo',
    body: `${changedElementIds.length} revised script element${changedElementIds.length === 1 ? '' : 's'} ready for review.`,
    changedElementIds,
    createdAt: new Date().toISOString()
  };
}

function ensureNextPage(pages: ProductionPage[], pageNumberStart: number): void {
  pages.push({ pageNumber: pageNumberStart + pages.length, elementIds: [], lineCount: 0 });
}

function estimateProductionLines(element: ScriptElement): number {
  const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
  const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthFor(element.type)));
  const base = Math.max(hardLines, softLines);
  if (element.type === 'scene-heading') return base + 1;
  if (element.type === 'character') return base + 1;
  if (element.type === 'transition') return base + 1;
  return base;
}
