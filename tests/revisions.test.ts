import { describe, expect, it } from 'vitest';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { useWorkspace } from '@/store/workspace';

describe('revision workflow', () => {
  it('marks edited lines with the active revision set while Revision Mode is enabled', () => {
    const document = createDocumentFromPlainText('Revision Test', 'INT. ROOM - NIGHT\nA lamp flickers.');
    useWorkspace.getState().setDocument(document);
    useWorkspace.getState().setRevisionMode(true);

    const activeRevision = useWorkspace.getState().document.revisions.find((revision) => revision.active);
    const changedElements = useWorkspace.getState().document.elements.map((element, index) =>
      index === 1 ? { ...element, text: 'A lamp flickers, then dies.' } : element
    );

    useWorkspace.getState().setElements(changedElements);
    const revised = useWorkspace.getState().document.elements[1];

    expect(revised.revisionSetId).toBe(activeRevision?.id);
    expect(revised.revisionColor).toBe(activeRevision?.color);
    expect(revised.revisionMark).toBe('*');
  });

  it('can manually mark and clear the selected line', () => {
    const document = createDocumentFromPlainText('Manual Revision', 'INT. ROOM - NIGHT\nMARA\nWe keep the mark visible.');
    useWorkspace.getState().setDocument(document);

    const selected = useWorkspace.getState().document.elements[2];
    useWorkspace.getState().setSelectedElement(selected.id);
    useWorkspace.getState().markSelectedRevised();

    expect(useWorkspace.getState().document.elements[2].revisionMark).toBe('*');

    useWorkspace.getState().clearSelectedRevision();

    expect(useWorkspace.getState().document.elements[2].revisionColor).toBeUndefined();
    expect(useWorkspace.getState().document.elements[2].revisionSetId).toBeUndefined();
    expect(useWorkspace.getState().document.elements[2].revisionMark).toBeUndefined();
  });

  it('can target notes, style, type, and revision changes without relying on current selection timing', () => {
    const document = createDocumentFromPlainText('Context Actions', 'INT. ROOM - NIGHT\nThe lamp flickers.');
    useWorkspace.getState().setDocument(document);
    useWorkspace.getState().setSelectedElement(undefined);

    const actionLineId = document.elements[1].id;
    useWorkspace.getState().addScriptNoteToElement(actionLineId, 'Track this image.');
    useWorkspace.getState().updateElementStyle(actionLineId, { bold: true, backgroundColor: '#ffe08a' });
    useWorkspace.getState().setElementType(actionLineId, 'shot');
    useWorkspace.getState().markElementRevised(actionLineId);

    const updated = useWorkspace.getState().document.elements.find((element) => element.id === actionLineId);

    expect(updated?.notes[0]?.text).toBe('Track this image.');
    expect(updated?.style?.bold).toBe(true);
    expect(updated?.style?.backgroundColor).toBe('#ffe08a');
    expect(updated?.type).toBe('shot');
    expect(updated?.revisionMark).toBe('*');
  });
});
