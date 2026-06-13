import { describe, expect, it } from 'vitest';
import { applyDocumentUpdate, encodeDocumentUpdate } from '@/shared/collaboration';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';

describe('local-first collaboration bridge', () => {
  it('encodes and applies Yjs-compatible document snapshots', () => {
    const original = createDocumentFromPlainText('Collab', 'INT. LAB - NIGHT\nMARA\nIt syncs.');
    const changed = { ...original, title: 'Collab Revised' };
    const update = encodeDocumentUpdate(changed);
    const merged = applyDocumentUpdate(original, update);

    expect(merged.title).toBe('Collab Revised');
    expect(merged.elements).toHaveLength(3);
  });
});
