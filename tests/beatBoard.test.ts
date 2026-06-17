import { describe, expect, it } from 'vitest';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { useWorkspace } from '@/store/workspace';

describe('beat board workspace behavior', () => {
  it('creates new beats without a page anchor', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));

    const id = useWorkspace.getState().addBeatAt({ x: 200, y: 220 });
    const beat = useWorkspace.getState().document.beats.find((item) => item.id === id);

    expect(beat?.outlineStartPage).toBeUndefined();
    expect(beat?.showAudio).toBe(true);
  });

  it('does not send unanchored beats into the script', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));
    const id = useWorkspace.getState().addBeatAt({ x: 200, y: 220 });
    const beforeCount = useWorkspace.getState().document.elements.length;

    useWorkspace.getState().sendBeatToScript(id);

    expect(useWorkspace.getState().document.elements).toHaveLength(beforeCount);
    expect(useWorkspace.getState().lastWarning).toContain('page number');
  });

  it('offsets new beats that would fully cover an existing node', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));

    const first = useWorkspace.getState().addBeatAt({ x: 240, y: 260 });
    const second = useWorkspace.getState().addBeatAt({ x: 240, y: 260 });
    const beats = useWorkspace.getState().document.beats.filter((beat) => beat.id === first || beat.id === second);

    expect(beats[0].x === beats[1].x && beats[0].y === beats[1].y).toBe(false);
  });

  it('preserves audio notes on beat nodes', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));
    const beat = useWorkspace.getState().document.beats[0];

    useWorkspace.getState().updateBeat({
      ...beat,
      audioDataUrl: 'data:audio/webm;base64,AAAA',
      audioName: 'Opening note',
      audioRecordedAt: '2026-06-10T00:00:00.000Z',
      showAudio: true
    });

    const updated = useWorkspace.getState().document.beats[0];
    expect(updated.audioDataUrl).toContain('audio/webm');
    expect(updated.audioName).toBe('Opening note');
    expect(updated.showAudio).toBe(true);
  });

  it('can unlink either side of a beat connection', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));
    const first = useWorkspace.getState().addBeatAt({ x: 200, y: 220 });
    const second = useWorkspace.getState().addBeatAt({ x: 620, y: 220 });

    useWorkspace.getState().linkBeats(first, second);
    expect(useWorkspace.getState().document.beats.find((beat) => beat.id === second)?.parentId).toBe(first);

    useWorkspace.getState().unlinkBeatSide(second, 'left');
    expect(useWorkspace.getState().document.beats.find((beat) => beat.id === second)?.parentId).toBeUndefined();

    useWorkspace.getState().linkBeats(first, second);
    useWorkspace.getState().unlinkBeatSide(first, 'right');
    expect(useWorkspace.getState().document.beats.find((beat) => beat.id === second)?.parentId).toBeUndefined();
  });

  it('deletes beat nodes and cleans up links', () => {
    useWorkspace.getState().setDocument(createDocumentFromPlainText('Beat Board', 'INT. ROOM - DAY'));
    const parent = useWorkspace.getState().addBeatAt({ x: 200, y: 220 });
    const child = useWorkspace.getState().addBeatAt({ x: 620, y: 220 });
    const payoff = useWorkspace.getState().addBeatAt({ x: 980, y: 220 });

    useWorkspace.getState().linkBeats(parent, child);
    const parentBeat = useWorkspace.getState().document.beats.find((beat) => beat.id === parent);
    if (!parentBeat) throw new Error('Expected parent beat');
    useWorkspace.getState().updateBeat({ ...parentBeat, payoffBeatIds: [payoff, child] });

    useWorkspace.getState().deleteBeat(child);

    expect(useWorkspace.getState().document.beats.find((beat) => beat.id === child)).toBeUndefined();
    expect(useWorkspace.getState().document.beats.find((beat) => beat.id === parent)?.payoffBeatIds).toEqual([payoff]);
    expect(useWorkspace.getState().document.beats.some((beat) => beat.parentId === child)).toBe(false);
  });
});
