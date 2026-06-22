import type { ExportPdfOptions } from './ipc';
import { ELEMENT_LABELS } from './screenplay';
import type { InlineTextStyle, ScriptDocument, ScriptElement, TextStyle } from './types';

export function createPrintableHtml(document: ScriptDocument, options: ExportPdfOptions = {}): string {
  const includeTitlePage = options.includeTitlePage ?? true;
  const includeStructureLines = options.includeStructureLines ?? true;
  const includeNotes = options.includeNotes ?? false;
  const themeClass = options.nolanMode ? 'nolan' : 'print';
  const structureCss = includeStructureLines ? createStructureCss(document) : '';
  const watermark = options.includeWatermark ? `<div class="watermark">${escapeHtml(options.watermarkText || 'Confidential')}</div>` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(document.title)}</title>
<style>
  @page { size: Letter; margin: 0.5in; }
  html, body { margin: 0; min-height: 100%; background: #fff; }
  body { font-family: "Courier Prime", Courier, monospace; color: #111; background: #fff; }
  body.print { color: #111; background: #fff; }
  body.nolan { color: #000; background: #b5202a; }
  body.nolan .title-page, body.nolan .script { background: #b5202a; color: #000; }
  .title-page { position: relative; height: 9.25in; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; text-align: center; background: #fff; color: #111; }
  .title-page__image { position: absolute; inset: 0.35in; width: calc(100% - 0.7in); height: calc(100% - 0.7in); object-fit: contain; opacity: 0.16; z-index: 0; }
  .title-page > :not(.title-page__image) { position: relative; z-index: 1; }
  .title-page h1 { font-size: 24pt; text-transform: uppercase; margin: 0 0 1in; }
  .title-page .contact { position: absolute; left: 1in; bottom: 1in; max-width: 3.5in; text-align: left; white-space: pre-wrap; }
  .script { position: relative; font-size: 12pt; line-height: 1.05; background: #fff; color: #111; }
  .running-header, .running-footer, .page-number { position: fixed; font-size: 10pt; color: currentColor; opacity: 0.72; }
  .running-header { top: 0.22in; left: 1in; right: 1in; }
  .running-footer { bottom: 0.22in; left: 1in; right: 1in; }
  .page-number { top: 0.22in; right: 1in; }
  .line { position: relative; min-height: 1em; margin: 0 0 0.08in; white-space: pre-wrap; break-inside: avoid; }
  .scene-heading { text-transform: uppercase; font-weight: 700; margin-top: 0.18in; }
  .action { width: 6in; }
  .character { width: 2.25in; margin-left: 2.4in; text-transform: uppercase; }
  .parenthetical { width: 2.2in; margin-left: 1.85in; }
  .dialogue { width: 3.1in; margin-left: 1.45in; }
  .transition { width: 2in; margin-left: 4.55in; text-align: right; text-transform: uppercase; }
  .shot { text-transform: uppercase; font-weight: 700; }
  .page-break { break-after: page; height: 0; margin: 0; color: transparent; }
  .omitted { color: #888; text-decoration: line-through; }
  .revision::after { content: attr(data-revision-mark); position: absolute; left: calc(100% + 0.18in); top: 0; color: currentColor; font-weight: 700; }
  .script-note-print { width: 4.9in; margin: 0.02in 0 0.1in 0.18in; padding: 0.06in 0.08in; border-left: 0.08in solid #d9a441; background: rgba(217, 164, 65, 0.12); font-family: Arial, sans-serif; font-size: 8.5pt; line-height: 1.3; white-space: pre-wrap; break-inside: avoid; }
  .script-note-print b { display: inline-block; margin-right: 0.08in; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; }
  .structure-line { position: absolute; left: -0.22in; width: 0.08in; border-radius: 2px; background: var(--structure, #2f6fed); }
  .watermark { position: fixed; top: 43%; left: 0; right: 0; text-align: center; opacity: 0.1; transform: rotate(-32deg); font-size: 64pt; font-family: Arial, sans-serif; z-index: 0; }
  ${structureCss}
</style>
</head>
<body class="${themeClass}">
${watermark}
${createRunningMatter(document)}
${includeTitlePage ? createTitlePage(document) : ''}
<main class="script">
${document.elements.map((element) => elementToHtml(element, includeNotes)).join('\n')}
</main>
</body>
</html>`;
}

function createTitlePage(document: ScriptDocument): string {
  const activeRevision = document.revisions.find((revision) => revision.active);
  const styles = document.titlePage.styles ?? {};
  const revisionLine = activeRevision
    ? `<p class="revision-title-line" style="color:${escapeHtml(activeRevision.color)}">${escapeHtml(activeRevision.name)} - ${escapeHtml(new Date(activeRevision.date).toLocaleDateString())}</p>`
    : '';
  return `<section class="title-page">
  ${document.titlePage.fields?.CoverImage ? `<img class="title-page__image" src="${escapeHtml(document.titlePage.fields.CoverImage)}" alt="" />` : ''}
  <h1 style="${textStyleToCss(styles.title)}">${escapeHtml(document.titlePage.title || document.title)}</h1>
  <p style="${textStyleToCss(styles.byline)}">${escapeHtml(document.titlePage.byline ?? 'Written by')}</p>
  <p style="${textStyleToCss(styles.author)}">${escapeHtml(document.titlePage.author || document.author || '')}</p>
  ${revisionLine}
  ${document.titlePage.draftDate ? `<p style="${textStyleToCss(styles.draftDate)}">${escapeHtml(document.titlePage.draftDate)}</p>` : ''}
  ${document.titlePage.source ? `<p style="${textStyleToCss(styles.source)}">${escapeHtml(document.titlePage.source)}</p>` : ''}
  ${document.titlePage.contact ? `<p class="contact" style="${textStyleToCss(styles.contact)}">${escapeHtml(document.titlePage.contact)}</p>` : ''}
</section>`;
}

function createRunningMatter(document: ScriptDocument): string {
  if (!document.settings.showHeaderFooter && !document.settings.showPageNumbers) return '';
  const header = document.settings.showHeaderFooter && document.settings.headerText ? `<div class="running-header">${escapeHtml(document.settings.headerText)}</div>` : '';
  const footer = document.settings.showHeaderFooter && document.settings.footerText ? `<div class="running-footer">${escapeHtml(document.settings.footerText)}</div>` : '';
  const page = document.settings.showPageNumbers ? `<div class="page-number">pg. ${document.settings.pageNumberStart}</div>` : '';
  return `${header}${footer}${page}`;
}

function elementToHtml(element: ScriptElement, includeNotes: boolean): string {
  const classes = ['line', element.type];
  if (element.omitted) classes.push('omitted');
  if (element.revisionColor) classes.push('revision');
  const styleRules = [element.revisionColor ? `--revision:${escapeHtml(element.revisionColor)}` : '', textStyleToCss(element.style)].filter(Boolean).join(';');
  const style = styleRules ? ` style="${styleRules}"` : '';
  const revisionMark = element.revisionColor ? ` data-revision-mark="${escapeHtml(element.revisionMark ?? '*')}"` : '';
  const notes = includeNotes ? notesToHtml(element) : '';
  return `<p id="${element.id}" class="${classes.join(' ')}"${style}${revisionMark} aria-label="${ELEMENT_LABELS[element.type]}">${renderStyledText(element.text, element.inlineStyles)}</p>${notes}`;
}

function notesToHtml(element: ScriptElement): string {
  const notes = (element.notes ?? []).filter((note) => !note.resolved && note.text.trim());
  if (!notes.length) return '';
  return notes
    .map((note, index) => `<aside class="script-note-print" style="border-left-color:${escapeHtml(note.color || '#d9a441')}"><b>Note ${index + 1}</b>${escapeHtml(note.text.trim())}</aside>`)
    .join('');
}

function renderStyledText(text: string, inlineStyles?: InlineTextStyle[]): string {
  const ranges = (inlineStyles ?? [])
    .filter((range) => range.to > range.from && range.from < text.length)
    .map((range) => ({
      ...range,
      from: Math.max(0, Math.min(text.length, range.from)),
      to: Math.max(0, Math.min(text.length, range.to))
    }))
    .filter((range) => range.to > range.from)
    .sort((first, second) => first.from - second.from || first.to - second.to);

  if (!ranges.length) return escapeHtml(text);

  let cursor = 0;
  let html = '';
  for (const range of ranges) {
    if (range.from > cursor) html += escapeHtml(text.slice(cursor, range.from));
    html += `<span style="${textStyleToCss(range.style)}">${escapeHtml(text.slice(range.from, range.to))}</span>`;
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < text.length) html += escapeHtml(text.slice(cursor));
  return html;
}

function createStructureCss(document: ScriptDocument): string {
  return document.structureRanges
    .filter((range) => range.visible)
    .map((range) => `#${range.startElementId} { border-left: 4px solid ${range.color}; padding-left: 0.08in; }`)
    .join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textStyleToCss(style?: TextStyle): string {
  if (!style) return '';
  const rules: string[] = [];
  if (style.fontFamily) rules.push(`font-family:${escapeHtml(style.fontFamily)}`);
  if (style.fontSize) rules.push(`font-size:${escapeHtml(style.fontSize)}`);
  if (style.fontWeight || style.bold !== undefined) rules.push(`font-weight:${style.bold ? '700' : escapeHtml(style.fontWeight ?? '400')}`);
  if (style.italic !== undefined) rules.push(`font-style:${style.italic ? 'italic' : 'normal'}`);
  if (style.underline !== undefined) rules.push(`text-decoration:${style.underline ? 'underline' : 'none'}`);
  if (style.textColor) rules.push(`color:${escapeHtml(style.textColor)}`);
  if (style.backgroundColor) rules.push(`background-color:${escapeHtml(style.backgroundColor)}`);
  return rules.join(';');
}
