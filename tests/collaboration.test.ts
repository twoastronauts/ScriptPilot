import { describe, expect, it } from 'vitest';
import { applyDocumentUpdate, documentMap, encodeDocumentUpdate, readDocumentSnapshot, writeDocumentSnapshot } from '@/shared/collaboration';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import * as Y from 'yjs';

describe('local-first collaboration bridge', () => {
  it('encodes and applies Yjs-compatible document snapshots', () => {
    const original = createDocumentFromPlainText('Collab', 'INT. LAB - NIGHT\nMARA\nIt syncs.');
    const changed = { ...original, title: 'Collab Revised' };
    const update = encodeDocumentUpdate(changed);
    const merged = applyDocumentUpdate(original, update);

    expect(merged.title).toBe('Collab Revised');
    expect(merged.elements).toHaveLength(3);
  });

  it('stores live collaboration snapshots under the shared document map', () => {
    const document = createDocumentFromPlainText('Room', 'INT. LAB - NIGHT');
    const ydoc = new Y.Doc();

    writeDocumentSnapshot(ydoc, document, 'local-test');

    expect(documentMap(ydoc).has('snapshot')).toBe(true);
    expect(readDocumentSnapshot(ydoc)?.title).toBe('Room');
  });
});
