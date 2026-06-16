import { describe, expect, it } from 'vitest';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { analyzeDialogue } from '@/shared/dialogueStudio';
import { createDraftVersion, createProductionPaginationPlan, createRevisionMemo } from '@/shared/formattingV2';
import { scanProofingIssues, suggestCorrections } from '@/shared/proofing';
import { isCorrectlySpelled, suggestSpelling } from '@/shared/languageTools';
import { runScriptDoctor } from '@/shared/scriptDoctor';
import { suggestSynonymGroups } from '@/shared/synonyms';
import { analyzeScript, buildSceneIntents } from '@/shared/storyAssistant';

describe('V02 writer assistant', () => {
  it('flags scenes that need conflict, stakes, and sharper visual action', () => {
    const document = createDocumentFromPlainText(
      'Assistant',
      ['INT. ROOM - NIGHT', 'Mara enters and feels nervous.', 'MARA', 'I am explaining everything because I am afraid of what happens next.'].join('\n')
    );
    const checks = analyzeScript(document);

    expect(checks.some((check) => check.title === 'Consider entering later')).toBe(true);
    expect(checks.some((check) => check.title === 'Conflict may be soft')).toBe(true);
    expect(checks.some((check) => check.category === 'subtext')).toBe(true);
    expect(buildSceneIntents(document)).toEqual([
      expect.objectContaining({
        sceneNumber: 1,
        sceneElementId: document.elements[0].id
      })
    ]);
  });

  it('analyzes dialogue rhythm and repeated phrases', () => {
    const document = createDocumentFromPlainText(
      'Dialogue',
      ['INT. ROOM - DAY', 'MARA', 'I need the key. I need the door.', 'MARA', 'Do you have the key? I need the key.'].join('\n')
    );
    const [mara] = analyzeDialogue(document);

    expect(mara.characterName).toBe('MARA');
    expect(mara.questionCount).toBe(1);
    expect(mara.repeatedPhrases).toContain('need key');
  });

  it('creates production pagination groundwork for MORE and CONTINUED', () => {
    const document = createDocumentFromPlainText(
      'Pages',
      ['INT. ROOM - DAY', 'MARA', 'Hello.', ...Array.from({ length: 70 }, (_, index) => `Action line ${index} keeps the page moving.`), 'MARA', 'Still here.'].join('\n')
    );
    const plan = createProductionPaginationPlan(document.elements);

    expect(plan.pages.length).toBeGreaterThan(1);
    expect(plan.moreAfterElementIds.length).toBeGreaterThan(0);
    expect(plan.continuedCharacterElementIds.length).toBeGreaterThanOrEqual(0);
  });

  it('tracks draft snapshots and revision memos', () => {
    const document = createDocumentFromPlainText('Revisions', 'INT. ROOM - DAY\nA door opens.');
    document.elements[1].revisionSetId = document.revisions[1].id;
    document.elements[1].revisionColor = document.revisions[1].color;

    const draft = createDraftVersion(document, 'Table read');
    const memo = createRevisionMemo(document, document.revisions[1].id);

    expect(draft.label).toBe('Table read');
    expect(draft.wordCount).toBeGreaterThan(0);
    expect(memo.changedElementIds).toContain(document.elements[1].id);
  });

  it('keeps proofing local and screenplay-aware', () => {
    const document = createDocumentFromPlainText('Proofing', 'INT. ROOM - DAY\nWe see the camera pan to a wierd door.');
    const issues = scanProofingIssues(document);

    expect(isCorrectlySpelled('observatory')).toBe(true);
    expect(isCorrectlySpelled('wierd')).toBe(false);
    expect(suggestSpelling('wierd')).toContain('weird');
    expect(suggestCorrections('wierd')).toContain('weird');
    expect(suggestCorrections('suprise')).toContain('surprise');
    expect(issues.some((issue) => issue.title === 'Camera phrase')).toBe(true);
    expect(issues.some((issue) => issue.title === 'Director language')).toBe(true);
    expect(issues.some((issue) => issue.title === 'Possible typo: wierd')).toBe(true);
  });

  it('uses a larger local thesaurus and script doctor overused-word report', () => {
    const document = createDocumentFromPlainText(
      'Doctor',
      [
        'INT. ROOM - NIGHT',
        'Mara just looks at the door. She just looks at the key. She just looks at Jon.',
        'MARA',
        'I really need the key. I really need the key. I really need the key.',
        'JON',
        'You said key again.'
      ].join('\n')
    );
    const report = runScriptDoctor(document);
    const synonymGroups = suggestSynonymGroups('run');

    expect(report.score).toBeLessThan(100);
    expect(report.overusedWords.some((issue) => issue.word === 'just')).toBe(true);
    expect(report.summary.some((line) => line.startsWith('Language pass:'))).toBe(true);
    expect(synonymGroups.flatMap((group) => group.words)).toContain('sprint');
  });
});
