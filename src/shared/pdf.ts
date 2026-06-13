import type { ExportPdfOptions } from './ipc';
import { ELEMENT_LABELS } from './screenplay';
import type { ScriptDocument, ScriptElement, TextStyle } from './types';

export function createPrintableHtml(document: ScriptDocument, options: ExportPdfOptions = {}): string {
  const includeTitlePage = options.includeTitlePage ?? true;
  const includeStructureLines = options.includeStructureLines ?? true;
  const matchDisplayColors = options.matchDisplayColors ?? document.settings.customPdfColors;
  const themeClass = matchDisplayColors ? document.settings.viewMode : 'day';
  const structureCss = includeStructureLines ? createStructureCss(document) : '';
  const watermark = options.includeWatermark ? `<div class="watermark">${escapeHtml(options.watermarkText || 'Confidential')}</div>` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(document.title)}</title>
<style>
  @page { size: Letter; margin: 0.5in; }
  body { font-family: "Courier Prime", Courier, monospace; color: #111; background: #fff; }
  body.night { color: #e8e0d0; background: #181b22; }
  body.midnight { color: #d6f4ff; background: #020712; }
  .title-page { position: relative; height: 9.25in; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; text-align: center; }
  .title-page h1 { font-size: 24pt; text-transform: uppercase; margin: 0 0 1in; }
  .title-page .contact { position: absolute; left: 1in; bottom: 1in; max-width: 3.5in; text-align: left; white-space: pre-wrap; }
  .script { position: relative; font-size: 12pt; line-height: 1.05; }
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
${document.elements.map(elementToHtml).join('\n')}
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

function elementToHtml(element: ScriptElement): string {
  const classes = ['line', element.type];
  if (element.omitted) classes.push('omitted');
  if (element.revisionColor) classes.push('revision');
  const styleRules = [element.revisionColor ? `--revision:${escapeHtml(element.revisionColor)}` : '', textStyleToCss(element.style)].filter(Boolean).join(';');
  const style = styleRules ? ` style="${styleRules}"` : '';
  const revisionMark = element.revisionColor ? ` data-revision-mark="${escapeHtml(element.revisionMark ?? '*')}"` : '';
  return `<p id="${element.id}" class="${classes.join(' ')}"${style}${revisionMark} aria-label="${ELEMENT_LABELS[element.type]}">${escapeHtml(element.text)}</p>`;
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
