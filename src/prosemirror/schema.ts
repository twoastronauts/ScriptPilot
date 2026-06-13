import { Schema } from 'prosemirror-model';
import type { ScriptElement, ScriptElementType, TextStyle } from '@/shared/types';

export interface PageChromeOptions {
  documentTitle?: string;
  headerText?: string;
  footerText?: string;
  showHeaderFooter?: boolean;
  showPageNumbers?: boolean;
  pageNumberStart?: number;
  pageMode?: 'pages' | 'continuous';
}

export const screenplaySchema = new Schema({
  nodes: {
    doc: { content: 'screenplayPage+' },
    text: { group: 'inline' },
    screenplayPage: {
      content: 'screenplayElement*',
      attrs: {
        pageIndex: { default: 0 },
        pageNumber: { default: 1 },
        headerText: { default: '' },
        footerText: { default: '' },
        showHeaderFooter: { default: true },
        showPageNumbers: { default: true },
        pageBreakIdBefore: { default: null },
        pageBreakGeneratedBefore: { default: false }
      },
      parseDOM: [
        {
          tag: 'section[data-screenplay-page]',
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            return {
              pageIndex: Number(element.dataset.pageIndex) || 0,
              pageNumber: Number(element.dataset.pageNumber) || 1,
              headerText: element.dataset.headerText ?? '',
              footerText: element.dataset.footerText ?? '',
              showHeaderFooter: element.dataset.showHeaderFooter !== 'false',
              showPageNumbers: element.dataset.showPageNumbers !== 'false',
              pageBreakIdBefore: element.dataset.pageBreakIdBefore || null,
              pageBreakGeneratedBefore: element.dataset.pageBreakGeneratedBefore === 'true'
            };
          }
        }
      ],
      toDOM(node) {
        const showHeaderFooter = Boolean(node.attrs.showHeaderFooter);
        const showPageNumbers = Boolean(node.attrs.showPageNumbers);
        const attrs = {
          class: 'script-page',
          'data-screenplay-page': 'true',
          'data-page-index': String(node.attrs.pageIndex ?? 0),
          'data-page-number': String(node.attrs.pageNumber ?? 1),
          'data-header-text': node.attrs.headerText ?? '',
          'data-footer-text': node.attrs.footerText ?? '',
          'data-show-header-footer': String(showHeaderFooter),
          'data-show-page-numbers': String(showPageNumbers),
          'data-page-break-id-before': node.attrs.pageBreakIdBefore ?? '',
          'data-page-break-generated-before': String(Boolean(node.attrs.pageBreakGeneratedBefore))
        };

        return [
          'section',
          attrs,
          [
            'div',
            { class: 'script-page__chrome', contenteditable: 'false', 'aria-hidden': 'true' },
            showHeaderFooter ? ['span', { class: 'script-page__header' }, node.attrs.headerText ?? ''] : ['span', { class: 'script-page__header is-hidden' }, ''],
            showPageNumbers ? ['span', { class: 'script-page__number' }, `pg. ${node.attrs.pageNumber ?? 1}`] : ['span', { class: 'script-page__number is-hidden' }, ''],
            showHeaderFooter && node.attrs.footerText ? ['span', { class: 'script-page__footer' }, node.attrs.footerText] : ['span', { class: 'script-page__footer is-hidden' }, '']
          ],
          ['div', { class: 'script-page__body' }, 0]
        ];
      }
    },
    screenplayElement: {
      group: 'block',
      content: 'inline*',
      attrs: {
        id: { default: '' },
        scriptType: { default: 'action' },
        revisionColor: { default: null },
        revisionSetId: { default: null },
        revisionMark: { default: null },
        omitted: { default: false },
        formatStyle: { default: null },
        generatedPageBreak: { default: false }
      },
      parseDOM: [
        {
          tag: 'p[data-script-type]',
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            return {
              id: element.dataset.id ?? '',
              scriptType: element.dataset.scriptType ?? 'action',
              revisionColor: element.dataset.revisionColor ?? null,
              revisionSetId: element.dataset.revisionSetId ?? null,
              revisionMark: element.dataset.revisionMark ?? null,
              omitted: element.dataset.omitted === 'true',
              formatStyle: parseFormatStyle(element.dataset.formatStyle),
              generatedPageBreak: element.dataset.generatedPageBreak === 'true'
            };
          }
        }
      ],
      toDOM(node) {
        const hasRevision = Boolean(node.attrs.revisionColor);
        const attrs = {
          class: `script-line ${node.attrs.scriptType}${hasRevision ? ' revision' : ''}${node.attrs.omitted ? ' omitted' : ''}`,
          'data-id': node.attrs.id,
          'data-script-type': node.attrs.scriptType,
          'data-revision-color': node.attrs.revisionColor ?? '',
          'data-revision-set-id': node.attrs.revisionSetId ?? '',
          'data-revision-mark': hasRevision ? node.attrs.revisionMark ?? '*' : '',
          'data-omitted': String(Boolean(node.attrs.omitted)),
          'data-format-style': node.attrs.formatStyle ? JSON.stringify(node.attrs.formatStyle) : '',
          'data-generated-page-break': String(Boolean(node.attrs.generatedPageBreak)),
          style: [node.attrs.revisionColor ? `--revision:${node.attrs.revisionColor}` : '', textStyleToCssVars(node.attrs.formatStyle)].filter(Boolean).join(';')
        };
        return ['p', attrs, 0];
      }
    }
  },
  marks: {}
});

export function elementsToProseMirrorDoc(elements: ScriptElement[], options: PageChromeOptions = {}) {
  const pages = splitElementsIntoPages(elements);
  const pageNodes = pages.map((page, index) =>
    screenplaySchema.nodes.screenplayPage.create(
      pageAttrs(index, page.breakBefore, options),
      page.elements.map(elementToProseMirrorNode)
    )
  );

  if (!pageNodes.length) {
    pageNodes.push(
      screenplaySchema.nodes.screenplayPage.create(pageAttrs(0, undefined, options), [
        screenplaySchema.nodes.screenplayElement.create({ scriptType: 'action' })
      ])
    );
  }

  return screenplaySchema.nodes.doc.create(null, pageNodes);
}

export function prosemirrorDocToElements(doc: import('prosemirror-model').Node, previous: ScriptElement[]): ScriptElement[] {
  const byId = new Map(previous.map((element) => [element.id, element]));
  const now = new Date().toISOString();
  const elements: ScriptElement[] = [];

  doc.forEach((pageNode, _offset, pageIndex) => {
    if (pageNode.type.name === 'screenplayElement') {
      elements.push(nodeToElement(pageNode, byId, now));
      return;
    }

    if (pageIndex > 0) {
      const breakId = pageNode.attrs.pageBreakIdBefore || crypto.randomUUID();
      const existingBreak = byId.get(breakId);
      elements.push({
        ...(existingBreak ?? {
          id: breakId,
          notes: [],
          productionTags: [],
          createdAt: now
        }),
        id: breakId,
        type: 'page-break',
        text: '',
        generatedPageBreak: Boolean(pageNode.attrs.pageBreakGeneratedBefore),
        updatedAt: existingBreak?.updatedAt ?? now
      });
    }

    pageNode.forEach((node) => {
      elements.push(nodeToElement(node, byId, now));
    });
  });

  return elements;
}

function splitElementsIntoPages(elements: ScriptElement[]): Array<{ breakBefore?: ScriptElement; elements: ScriptElement[] }> {
  const pages: Array<{ breakBefore?: ScriptElement; elements: ScriptElement[] }> = [{ elements: [] }];

  for (const element of elements) {
    if (element.type === 'page-break') {
      pages.push({ breakBefore: element, elements: [] });
      continue;
    }

    pages[pages.length - 1].elements.push(element);
  }

  return pages;
}

function pageAttrs(pageIndex: number, breakBefore: ScriptElement | undefined, options: PageChromeOptions) {
  const documentTitle = options.documentTitle ?? '';
  const headerText = options.headerText || documentTitle;
  return {
    pageIndex,
    pageNumber: (options.pageNumberStart ?? 1) + pageIndex,
    headerText,
    footerText: options.footerText ?? '',
    showHeaderFooter: options.showHeaderFooter ?? true,
    showPageNumbers: options.showPageNumbers ?? true,
    pageBreakIdBefore: breakBefore?.id ?? null,
    pageBreakGeneratedBefore: Boolean(breakBefore?.generatedPageBreak)
  };
}

function elementToProseMirrorNode(element: ScriptElement) {
  return screenplaySchema.nodes.screenplayElement.create(
    {
      id: element.id,
      scriptType: element.type,
      revisionColor: element.revisionColor ?? null,
      revisionSetId: element.revisionSetId ?? null,
      revisionMark: element.revisionMark ?? null,
      omitted: Boolean(element.omitted),
      formatStyle: element.style ?? null,
      generatedPageBreak: Boolean(element.generatedPageBreak)
    },
    element.text ? screenplaySchema.text(element.text) : undefined
  );
}

function nodeToElement(node: import('prosemirror-model').Node, byId: Map<string, ScriptElement>, now: string): ScriptElement {
  const id = node.attrs.id || crypto.randomUUID();
  const existing = byId.get(id);
  const type = node.attrs.scriptType as ScriptElementType;
  const text = node.textContent;
  return {
    ...(existing ?? {
      id,
      notes: [],
      productionTags: [],
      createdAt: now
    }),
    id,
    type,
    text,
    revisionColor: node.attrs.revisionColor ?? existing?.revisionColor,
    revisionSetId: node.attrs.revisionSetId ?? existing?.revisionSetId,
    revisionMark: node.attrs.revisionMark ?? existing?.revisionMark,
    omitted: Boolean(node.attrs.omitted),
    style: node.attrs.formatStyle ?? existing?.style,
    generatedPageBreak: Boolean(node.attrs.generatedPageBreak),
    updatedAt:
      existing?.text === text &&
      existing?.type === type &&
      JSON.stringify(existing?.style) === JSON.stringify(node.attrs.formatStyle ?? undefined) &&
      Boolean(existing?.generatedPageBreak) === Boolean(node.attrs.generatedPageBreak)
        ? existing.updatedAt
        : now
  };
}

function parseFormatStyle(value?: string): TextStyle | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as TextStyle;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function textStyleToCssVars(style?: TextStyle | null): string {
  if (!style) return '';
  const rules: string[] = [];
  if (style.fontFamily) rules.push(`--line-font:${style.fontFamily}`);
  if (style.fontSize) rules.push(`--line-size:${style.fontSize}`);
  if (style.fontWeight || style.bold !== undefined) rules.push(`--line-weight:${style.bold ? '700' : style.fontWeight ?? '400'}`);
  if (style.italic !== undefined) rules.push(`--line-style:${style.italic ? 'italic' : 'normal'}`);
  if (style.underline !== undefined) rules.push(`--line-decoration:${style.underline ? 'underline' : 'none'}`);
  if (style.textColor) rules.push(`--line-color:${style.textColor}`);
  if (style.backgroundColor) rules.push(`--line-bg:${style.backgroundColor}`);
  return rules.join(';');
}
