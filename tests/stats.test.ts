import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { buildProductionReports } from '@/shared/reports';
import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';

describe('stats and reports', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks scenes, characters, and interactions', () => {
    const document = createDocumentFromPlainText(
      'Stats',
      ['INT. ROOM - NIGHT', 'MARA', 'Hello.', 'JON', 'Hi.', 'EXT. STREET - DAY', 'MARA', 'We move.'].join('\n')
    );
    const stats = computeWritingStats(document);

    expect(stats.scenes).toBe(2);
    expect(stats.characters.find((character) => character.name === 'MARA')?.scenes).toBe(2);
    expect(stats.characters.find((character) => character.name === 'MARA')?.interactions).toContain('JON');
  });

  it('builds production tag reports', () => {
    const document = createDocumentFromPlainText('Reports', 'INT. ROOM - NIGHT\nA red phone rings.');
    document.elements[1].productionTags.push({ id: 'tag-1', category: 'prop', label: 'Red phone', color: '#c24c3a' });

    expect(buildProductionReports(document)).toEqual([
      {
        category: 'prop',
        label: 'Red phone',
        count: 1,
        scenes: ['INT. ROOM - NIGHT']
      }
    ]);
  });

  it('records sprint sessions as deltas from the start snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const document = createDocumentFromPlainText('Sprint', ['INT. ROOM - NIGHT', 'MARA', 'Hello there.'].join('\n'));
    useWorkspace.getState().setDocument(document);
    const baselineStats = computeWritingStats(document);

    useWorkspace.getState().startSprint();
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));

    const updatedElements = document.elements.map((element, index) =>
      index === document.elements.length - 1
        ? { ...element, text: 'Hello there and welcome to the rewrite.', updatedAt: new Date().toISOString() }
        : element
    );
    useWorkspace.getState().setElements(updatedElements);

    const updatedStats = computeWritingStats({ ...document, elements: updatedElements });
    useWorkspace.getState().stopSprint();

    const session = useWorkspace.getState().document.writingSessions.at(-1);
    expect(session?.wordsAdded).toBe(updatedStats.words - baselineStats.words);
    expect(session?.pagesAdded).toBe(updatedStats.pages - baselineStats.pages);
    expect(session?.wordsAdded).not.toBe(updatedStats.words);
    expect(session?.seconds).toBe(120);
    expect(useWorkspace.getState().sprintStartedAt).toBeUndefined();
    expect(useWorkspace.getState().sprintBaseline).toBeUndefined();
  });

  it('sends a beat to its anchored page as a scene heading', () => {
    const document = createDocumentFromPlainText('Beats', 'INT. ROOM - NIGHT\nA lamp glows.');
    document.beats = [
      {
        id: 'beat-send',
        title: 'Breakthrough',
        body: 'The clue lands.',
        color: '#55b8c7',
        x: 100,
        y: 100,
        outlineStartPage: 3,
        outlinePageSpan: 2
      }
    ];

    useWorkspace.getState().setDocument(document);
    useWorkspace.getState().sendBeatToScript('beat-send');

    const state = useWorkspace.getState();
    expect(state.document.elements.filter((element) => element.type === 'page-break')).toHaveLength(2);
    expect(state.document.elements.some((element) => element.type === 'scene-heading' && element.text === 'BREAKTHROUGH')).toBe(true);
    expect(state.document.beats[0].linkedElementId).toBeTruthy();
  });
});
