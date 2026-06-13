import { describe, expect, it } from 'vitest';
import { estimatePageCount, inferElementType, isLikelyCharacterCue, nextElementType, normalizeCharacterName, tabElementType } from '@/shared/screenplay';
import { createDefaultSettings, createDocumentFromPlainText, createScriptElement } from '@/shared/defaultDocument';
import { collectSmartTypeOptions } from '@/shared/smartType';
import { suggestSynonyms } from '@/shared/synonyms';
import { correctionSpan, suggestCorrections } from '@/shared/proofing';
import { elementsToProseMirrorDoc, prosemirrorDocToElements } from '@/prosemirror/schema';
import { screenplayAutoformat } from '@/prosemirror/autoformat';
import { EditorState } from 'prosemirror-state';

describe('screenplay helpers', () => {
  it('infers common screenplay line types', () => {
    expect(inferElementType('INT. KITCHEN - DAY')).toBe('scene-heading');
    expect(inferElementType('INT./EXT. CAR - NIGHT')).toBe('scene-heading');
    expect(inferElementType('I/E. TAXI - MORNING')).toBe('scene-heading');
    expect(inferElementType('EST. CITY - DAWN')).toBe('scene-heading');
    expect(inferElementType('CUT TO:')).toBe('transition');
    expect(inferElementType('FADE TO BLACK:')).toBe('transition');
    expect(inferElementType('JUMP CUT TO:')).toBe('transition');
    expect(inferElementType('(quietly)')).toBe('parenthetical');
    expect(inferElementType('M')).toBe('action');
    expect(inferElementType('MARA')).toBe('character');
  });

  it('moves through useful enter-key defaults', () => {
    expect(nextElementType('scene-heading')).toBe('action');
    expect(nextElementType('character')).toBe('dialogue');
    expect(nextElementType('dialogue')).toBe('action');
    expect(nextElementType('transition')).toBe('scene-heading');
  });

  it('uses context-aware tab targets instead of one-way cycling', () => {
    expect(tabElementType('action')).toBe('character');
    expect(tabElementType('character')).toBe('parenthetical');
    expect(tabElementType('dialogue')).toBe('parenthetical');
    expect(tabElementType('dialogue', -1)).toBe('character');
    expect(tabElementType('action', -1)).toBe('scene-heading');
  });

  it('normalizes character extensions', () => {
    expect(normalizeCharacterName('MARA (V.O.)')).toBe('MARA');
  });

  it('keeps action-like uppercase punctuation out of character cues', () => {
    expect(isLikelyCharacterCue('MARA')).toBe(true);
    expect(isLikelyCharacterCue('THE DOOR EXPLODES.')).toBe(false);
    expect(inferElementType('THE DOOR EXPLODES.')).toBe('action');
  });

  it('does not downgrade an edited scene heading to a character cue', () => {
    const element = { ...createScriptElement('scene-heading', 'MINT. OBSERVATORY - NIGHT'), id: 'scene-1' };
    const doc = elementsToProseMirrorDoc([element]);
    const state = EditorState.create({ schema: doc.type.schema, doc, plugins: [screenplayAutoformat] });
    const transaction = state.tr.insertText(' ', elementTextStart(doc, 'scene-1'), elementTextStart(doc, 'scene-1'));
    const next = state.apply(transaction);

    expect(elementAttrs(next.doc, 'scene-1')?.scriptType).toBe('scene-heading');
  });

  it('does not promote live uppercase typing into a character cue', () => {
    const element = { ...createScriptElement('action', 'MAR'), id: 'action-1' };
    const doc = elementsToProseMirrorDoc([element]);
    const state = EditorState.create({ schema: doc.type.schema, doc, plugins: [screenplayAutoformat] });
    const insertAt = elementTextStart(doc, 'action-1') + 3;
    const next = state.apply(state.tr.insertText('A', insertAt, insertAt));

    expect(elementText(next.doc, 'action-1')).toBe('MARA');
    expect(elementAttrs(next.doc, 'action-1')?.scriptType).toBe('action');
  });

  it('renders page breaks as page nodes and round-trips break metadata', () => {
    const first = { ...createScriptElement('scene-heading', 'INT. ROOM - NIGHT'), id: 'scene-1' };
    const pageBreak = { ...createScriptElement('page-break', ''), id: 'break-1', generatedPageBreak: true };
    const second = { ...createScriptElement('action', 'Morning burns through the blinds.'), id: 'action-2' };
    const doc = elementsToProseMirrorDoc([first, pageBreak, second], {
      documentTitle: 'Pages',
      pageNumberStart: 7,
      headerText: '',
      footerText: 'Draft',
      showHeaderFooter: true,
      showPageNumbers: true
    });

    expect(doc.childCount).toBe(2);
    expect(doc.child(0).type.name).toBe('screenplayPage');
    expect(doc.child(1).attrs.pageNumber).toBe(8);
    expect(doc.child(1).attrs.pageBreakIdBefore).toBe('break-1');
    expect(doc.child(1).attrs.pageBreakGeneratedBefore).toBe(true);

    const roundTripped = prosemirrorDocToElements(doc, [first, pageBreak, second]);
    expect(roundTripped.map((element) => element.id)).toEqual(['scene-1', 'break-1', 'action-2']);
    expect(roundTripped[1]).toMatchObject({ type: 'page-break', generatedPageBreak: true });
  });

  it('estimates at least one page', () => {
    expect(estimatePageCount([{ type: 'action', text: 'A short action line.' }])).toBe(1);
  });

  it('suggests scene headings and characters from the document', () => {
    const document = createDocumentFromPlainText('SmartType', 'INT. KITCHEN - NIGHT\nMARA\nHello.');
    const sceneOptions = collectSmartTypeOptions(document, 'scene-heading', 'EXT.');
    const characterOptions = collectSmartTypeOptions(document, 'character', 'MA');

    expect(sceneOptions.some((option) => option.replacement === 'EXT. KITCHEN - NIGHT')).toBe(true);
    expect(characterOptions.some((option) => option.replacement === 'MARA')).toBe(true);
  });

  it('rescues action lines that start like scene headings', () => {
    const document = createDocumentFromPlainText('SmartType', 'INT. KITCHEN - NIGHT');
    const options = collectSmartTypeOptions(document, 'action', 'EST');

    expect(options.some((option) => option.replacement === 'EST.')).toBe(true);
  });

  it('only suggests scene headings after an INT or EXT start', () => {
    const document = createDocumentFromPlainText('SmartType', 'INT. KITCHEN - NIGHT\nMARA\nHello.');

    expect(collectSmartTypeOptions(document, 'scene-heading', '').some((option) => option.kind === 'scene-heading')).toBe(false);
    expect(collectSmartTypeOptions(document, 'scene-heading', 'IN').some((option) => option.kind === 'scene-heading')).toBe(true);
  });

  it('keeps transition suggestions out of plain action lines', () => {
    const document = createDocumentFromPlainText('SmartType', 'INT. KITCHEN - NIGHT\nA kettle screams.');

    expect(collectSmartTypeOptions(document, 'action', '').some((option) => option.replacement === 'CUT TO:')).toBe(false);
  });

  it('offers transition suggestions when an action line clearly starts as a transition', () => {
    const document = createDocumentFromPlainText('Transitions', 'INT. ROOM - NIGHT');
    const options = collectSmartTypeOptions(document, 'action', 'FADE');

    expect(options.some((option) => option.replacement === 'FADE TO BLACK:')).toBe(true);
  });

  it('suggests a broader transition vocabulary', () => {
    const document = createDocumentFromPlainText('Transitions', 'INT. ROOM - NIGHT');
    const options = collectSmartTypeOptions(document, 'transition', 'FA');

    expect(options.some((option) => option.replacement === 'FADE TO BLACK:')).toBe(true);
  });

  it('hides transition suggestions once a transition is complete', () => {
    const document = createDocumentFromPlainText('Transitions', 'INT. ROOM - NIGHT\nCUT TO:');
    const options = collectSmartTypeOptions(document, 'transition', 'CUT TO:');

    expect(options).toEqual([]);
  });

  it('suggests alternate words while preserving case', () => {
    expect(suggestSynonyms('quiet')).toContain('silent');
    expect(suggestSynonyms('QUIET')).toContain('SILENT');
    expect(suggestSynonyms('walk')).toContain('stride');
    expect(suggestSynonyms('running')).toContain('sprint');
    expect(suggestSynonyms('afraid')).toContain('scared');
  });

  it('suggests typo corrections for screenplay drafting words', () => {
    expect(suggestCorrections('teh')).toContain('the');
    expect(suggestCorrections('recieve')).toContain('receive');
    expect(suggestCorrections('Scean')).toContain('Scene');
    expect(suggestCorrections('TEHINT')).toContain('THE');
    expect(correctionSpan('tehINT')).toEqual({ start: 0, end: 3 });
  });

  it('defaults language tools on for local writing help', () => {
    const settings = createDefaultSettings();

    expect(settings.smartType).toBe(true);
    expect(settings.spellcheck).toBe(true);
    expect(settings.grammarSuggestions).toBe(true);
    expect(settings.styleSuggestions).toBe(true);
    expect(settings.dictionaryLanguage).toBe('en-US');
    expect(settings.sprintChimeEnabled).toBe(true);
    expect(settings.sprintChimeMinutes).toBe(5);
  });
});

function elementTextStart(doc: import('prosemirror-model').Node, id: string): number {
  let result = 1;
  doc.descendants((node, position) => {
    if (node.type.name !== 'screenplayElement') return true;
    if (node.attrs.id !== id) return false;
    result = position + 1;
    return false;
  });
  return result;
}

function elementAttrs(doc: import('prosemirror-model').Node, id: string): Record<string, unknown> | undefined {
  let result: Record<string, unknown> | undefined;
  doc.descendants((node) => {
    if (node.type.name !== 'screenplayElement') return true;
    if (node.attrs.id !== id) return false;
    result = node.attrs;
    return false;
  });
  return result;
}

function elementText(doc: import('prosemirror-model').Node, id: string): string | undefined {
  let result: string | undefined;
  doc.descendants((node) => {
    if (node.type.name !== 'screenplayElement') return true;
    if (node.attrs.id !== id) return false;
    result = node.textContent;
    return false;
  });
  return result;
}
