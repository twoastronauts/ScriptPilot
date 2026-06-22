import { Schema } from 'prosemirror-model';
import type { InlineTextStyle, ScriptElement, ScriptElementType, TextStyle } from '@/shared/types';

export interface PageChromeOptions {
  documentTitle?: string;
  headerText?: string;
  footerText?: string;
  showHeaderFooter?: boolean;
  showPageNumbers?: boolean;
  pageNumberStart?: number;
  pageMode?: 'pages' | 'continuous';
  sprintActive?: boolean;
  sprintElementId?: string;
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
        generatedPageBreak: { default: false },
        sprintClass: { default: '' },
        noteCount: { default: 0 }
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
              generatedPageBreak: element.dataset.generatedPageBreak === 'true',
              noteCount: Number(element.dataset.noteCount) || 0
            };
          }
        }
      ],
      toDOM(node) {
        const hasRevision = Boolean(node.attrs.revisionColor);
        const attrs = {
          class: `script-line ${node.attrs.scriptType}${hasRevision ? ' revision' : ''}${node.attrs.omitted ? ' omitted' : ''}${node.attrs.sprintClass ? ` ${node.attrs.sprintClass}` : ''}`,
          'data-id': node.attrs.id,
          'data-script-type': node.attrs.scriptType,
          'data-revision-color': node.attrs.revisionColor ?? '',
          'data-revision-set-id': node.attrs.revisionSetId ?? '',
          'data-revision-mark': hasRevision ? node.attrs.revisionMark ?? '*' : '',
          'data-omitted': String(Boolean(node.attrs.omitted)),
          'data-format-style': node.attrs.formatStyle ? JSON.stringify(node.attrs.formatStyle) : '',
          'data-generated-page-break': String(Boolean(node.attrs.generatedPageBreak)),
          'data-note-count': String(Number(node.attrs.noteCount) || 0),
          style: [node.attrs.revisionColor ? `--revision:${node.attrs.revisionColor}` : '', textStyleToCssVars(node.attrs.formatStyle)].filter(Boolean).join(';')
        };
        return ['p', attrs, 0];
      }
    }
  },
  marks: {
    textStyle: {
      attrs: {
        style: { default: null }
      },
      parseDOM: [
        {
          tag: 'span[data-text-style]',
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            return { style: parseFormatStyle(element.dataset.textStyle) };
          }
        }
      ],
      toDOM(mark) {
        const style = mark.attrs.style as TextStyle | null;
        return [
          'span',
          {
            'data-text-style': style ? JSON.stringify(style) : '',
            style: textStyleToInlineCss(style)
          },
          0
        ];
      }
    }
  }
});

export function elementsToProseMirrorDoc(elements: ScriptElement[], options: PageChromeOptions = {}) {
  const pages = splitElementsIntoPages(elements);
  const sprintClasses = sprintClassesForElements(elements, options);
  const pageNodes = pages.map((page, index) =>
    screenplaySchema.nodes.screenplayPage.create(
      pageAttrs(index, page.breakBefore, options),
      page.elements.map((element) => elementToProseMirrorNode(element, sprintClasses.get(element.id)))
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

function elementToProseMirrorNode(element: ScriptElement, sprintClass = '') {
  return screenplaySchema.nodes.screenplayElement.create(
    {
      id: element.id,
      scriptType: element.type,
      revisionColor: element.revisionColor ?? null,
      revisionSetId: element.revisionSetId ?? null,
      revisionMark: element.revisionMark ?? null,
      omitted: Boolean(element.omitted),
      formatStyle: element.style ?? null,
      generatedPageBreak: Boolean(element.generatedPageBreak),
      sprintClass,
      noteCount: element.notes?.filter((note) => !note.resolved).length ?? 0
    },
    element.text ? textNodesWithInlineStyles(element.text, element.inlineStyles) : undefined
  );
}

function sprintClassesForElements(elements: ScriptElement[], options: PageChromeOptions): Map<string, string> {
  const classes = new Map<string, string>();
  if (!options.sprintActive) return classes;
  const visibleElements = elements.filter((element) => element.type !== 'page-break');
  if (!visibleElements.length) return classes;
  let currentIndex = options.sprintElementId ? visibleElements.findIndex((element) => element.id === options.sprintElementId) : -1;
  if (currentIndex < 0) currentIndex = 0;

  visibleElements.forEach((element, index) => {
    if (index === currentIndex) classes.set(element.id, 'is-current-line');
    else if (index === currentIndex - 1) classes.set(element.id, 'is-before-current-1');
    else if (index === currentIndex - 2) classes.set(element.id, 'is-before-current-2');
    else if (index === currentIndex - 3) classes.set(element.id, 'is-before-current-3');
    else if (index === currentIndex - 4) classes.set(element.id, 'is-before-current-4');
    else if (index < currentIndex - 4) classes.set(element.id, 'is-far-before-current');
    else if (index > currentIndex) classes.set(element.id, 'is-after-current');
  });

  return classes;
}

function nodeToElement(node: import('prosemirror-model').Node, byId: Map<string, ScriptElement>, now: string): ScriptElement {
  const id = node.attrs.id || crypto.randomUUID();
  const existing = byId.get(id);
  const type = node.attrs.scriptType as ScriptElementType;
  const text = node.textContent;
  const inlineStyles = extractInlineStyles(node);
  const nextStyle = node.attrs.formatStyle ?? existing?.style;
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
    style: nextStyle,
    inlineStyles: inlineStyles.length ? inlineStyles : undefined,
    generatedPageBreak: Boolean(node.attrs.generatedPageBreak),
    updatedAt:
      existing?.text === text &&
      existing?.type === type &&
      JSON.stringify(existing?.style) === JSON.stringify(nextStyle ?? undefined) &&
      JSON.stringify(existing?.inlineStyles ?? undefined) === JSON.stringify(inlineStyles.length ? inlineStyles : undefined) &&
      Boolean(existing?.generatedPageBreak) === Boolean(node.attrs.generatedPageBreak)
        ? existing.updatedAt
        : now
  };
}

function textNodesWithInlineStyles(text: string, inlineStyles?: InlineTextStyle[]) {
  const markType = screenplaySchema.marks.textStyle;
  const ranges = (inlineStyles ?? [])
    .filter((range) => range.to > range.from && range.from < text.length)
    .map((range) => ({
      ...range,
      from: Math.max(0, Math.min(text.length, range.from)),
      to: Math.max(0, Math.min(text.length, range.to))
    }))
    .filter((range) => range.to > range.from)
    .sort((first, second) => first.from - second.from || first.to - second.to);

  if (!ranges.length) return screenplaySchema.text(text);

  const nodes: Array<ReturnType<typeof screenplaySchema.text>> = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.from > cursor) nodes.push(screenplaySchema.text(text.slice(cursor, range.from)));
    nodes.push(screenplaySchema.text(text.slice(range.from, range.to), [markType.create({ style: range.style })]));
    cursor = Math.max(cursor, range.to);
  }

  if (cursor < text.length) nodes.push(screenplaySchema.text(text.slice(cursor)));
  return nodes;
}

function extractInlineStyles(node: import('prosemirror-model').Node): InlineTextStyle[] {
  const ranges: InlineTextStyle[] = [];
  let cursor = 0;

  node.forEach((child) => {
    const length = child.text?.length ?? child.textContent.length;
    child.marks.forEach((mark) => {
      if (mark.type.name !== 'textStyle') return;
      const style = mark.attrs.style as TextStyle | null;
      if (!style || !length) return;
      ranges.push({
        id: crypto.randomUUID(),
        from: cursor,
        to: cursor + length,
        style
      });
    });
    cursor += length;
  });

  return ranges;
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

function textStyleToInlineCss(style?: TextStyle | null): string {
  if (!style) return '';
  const rules: string[] = [];
  if (style.fontFamily) rules.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) rules.push(`font-size:${style.fontSize}`);
  if (style.fontWeight || style.bold !== undefined) rules.push(`font-weight:${style.bold ? '700' : style.fontWeight ?? '400'}`);
  if (style.italic !== undefined) rules.push(`font-style:${style.italic ? 'italic' : 'normal'}`);
  if (style.underline !== undefined) rules.push(`text-decoration:${style.underline ? 'underline' : 'none'}`);
  if (style.textColor) rules.push(`color:${style.textColor}`);
  if (style.backgroundColor) rules.push(`background-color:${style.backgroundColor}`);
  return rules.join(';');
}
