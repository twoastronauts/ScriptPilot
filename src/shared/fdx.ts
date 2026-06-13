import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { v4 as uuid } from 'uuid';
import { createDocumentFromPlainText, createScriptElement } from './defaultDocument';
import { ELEMENT_TO_FDX_TYPE, FDX_TYPE_TO_ELEMENT, normalizeCharacterName } from './screenplay';
import type { CharacterProfile, ScriptDocument, ScriptElement, ScriptElementType, TitlePage } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true
});

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getFinalDraftNode(root: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(root.FinalDraft)) return root.FinalDraft;
  if (isRecord(root.Script)) return root.Script;
  return root;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function textFromFdxText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textFromFdxText).join('');
  if (isRecord(value)) {
    if (typeof value['#text'] === 'string') return value['#text'];
    if (value.Text !== undefined) return textFromFdxText(value.Text);
    return Object.values(value).map(textFromFdxText).join('');
  }
  return '';
}

function typeFromParagraph(paragraph: Record<string, unknown>): ScriptElementType {
  const rawType = String(paragraph['@_Type'] ?? paragraph.Type ?? 'Action');
  return FDX_TYPE_TO_ELEMENT[rawType] ?? 'action';
}

function paragraphToElement(paragraph: Record<string, unknown>, index: number): ScriptElement {
  const type = typeFromParagraph(paragraph);
  const text = textFromFdxText(paragraph.Text);
  const element = createScriptElement(type, text);
  element.fdx = {
    rawParagraph: clone(paragraph),
    originalIndex: index
  };
  if (type === 'character') element.character = normalizeCharacterName(text);
  return element;
}

function extractTitlePage(finalDraft: Record<string, unknown>, fallbackTitle: string): TitlePage {
  const titlePage = isRecord(finalDraft.TitlePage) ? finalDraft.TitlePage : {};
  const content = isRecord(titlePage.Content) ? titlePage.Content : titlePage;
  const paragraphs = arrayify(isRecord(content) ? content.Paragraph : undefined).filter(isRecord);
  const fields: Record<string, string> = {};

  for (const paragraph of paragraphs) {
    const label = String(paragraph['@_Type'] ?? paragraph['@_Label'] ?? `Field ${Object.keys(fields).length + 1}`);
    fields[label] = textFromFdxText(paragraph.Text);
  }

  return {
    title: fields.Title || fallbackTitle,
    author: fields.Author || fields['Written by'] || '',
    contact: fields.Contact,
    draftDate: fields.Date,
    fields: Object.keys(fields).length ? fields : { Title: fallbackTitle, Author: '' }
  };
}

function collectCharacters(elements: ScriptElement[]): CharacterProfile[] {
  const names = Array.from(new Set(elements.filter((element) => element.type === 'character').map((element) => normalizeCharacterName(element.text)).filter(Boolean)));
  return names.map((name, index) => ({
    id: uuid(),
    name,
    aliases: [],
    color: ['#2f6fed', '#c24c3a', '#0f9f83', '#7b4fd6', '#b06b00'][index % 5]
  }));
}

export function importFdx(xml: string, sourcePath?: string): ScriptDocument {
  const rawRoot = parser.parse(xml) as Record<string, unknown>;
  const finalDraft = getFinalDraftNode(rawRoot);
  const content = isRecord(finalDraft.Content) ? finalDraft.Content : {};
  const paragraphs = arrayify(isRecord(content) ? content.Paragraph : undefined).filter(isRecord);
  const elements = paragraphs.map(paragraphToElement);
  const fallbackTitle = sourcePath ? sourcePath.split(/[\\/]/).pop()?.replace(/\.fdx$/i, '') ?? 'Untitled' : 'Untitled';
  const document = createDocumentFromPlainText(fallbackTitle, '');
  const titlePage = extractTitlePage(finalDraft, fallbackTitle);

  return {
    ...document,
    title: titlePage.title || fallbackTitle,
    author: titlePage.author || '',
    titlePage,
    elements: elements.length ? elements : document.elements,
    characters: collectCharacters(elements.length ? elements : document.elements),
    fdxShadow: {
      sourcePath,
      importedAt: new Date().toISOString(),
      originalXml: xml,
      rawRoot
    },
    updatedAt: new Date().toISOString()
  };
}

function updateParagraphText(paragraph: Record<string, unknown>, element: ScriptElement): Record<string, unknown> {
  const next = clone(paragraph);
  next['@_Type'] = ELEMENT_TO_FDX_TYPE[element.type];
  if (isRecord(next.Text)) {
    next.Text = { ...next.Text, '#text': element.text };
  } else {
    next.Text = element.text;
  }
  return next;
}

function elementToParagraph(element: ScriptElement): Record<string, unknown> {
  const raw = isRecord(element.fdx?.rawParagraph) ? element.fdx.rawParagraph : undefined;
  if (raw) return updateParagraphText(raw, element);
  return {
    '@_Type': ELEMENT_TO_FDX_TYPE[element.type],
    Text: element.text
  };
}

function titlePageToFdx(titlePage: TitlePage): Record<string, unknown> {
  const fields = {
    Title: titlePage.title,
    Author: titlePage.author,
    ...titlePage.fields
  };

  return {
    Content: {
      Paragraph: Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => ({
          '@_Type': label,
          Text: value
        }))
    }
  };
}

function createFdxRoot(document: ScriptDocument): Record<string, unknown> {
  return {
    FinalDraft: {
      '@_DocumentType': 'Script',
      '@_Template': 'No',
      '@_Version': '1',
      TitlePage: titlePageToFdx(document.titlePage),
      Content: {
        Paragraph: document.elements.map(elementToParagraph)
      }
    }
  };
}

export function exportFdx(document: ScriptDocument): string {
  const root = isRecord(document.fdxShadow?.rawRoot) ? clone(document.fdxShadow.rawRoot) : createFdxRoot(document);
  const finalDraft = getFinalDraftNode(root);
  finalDraft.Content = {
    ...(isRecord(finalDraft.Content) ? finalDraft.Content : {}),
    Paragraph: document.elements.map(elementToParagraph)
  };
  finalDraft.TitlePage = titlePageToFdx(document.titlePage);

  if (!root.FinalDraft && !root.Script) {
    return builder.build({ FinalDraft: finalDraft });
  }

  return builder.build(root);
}
