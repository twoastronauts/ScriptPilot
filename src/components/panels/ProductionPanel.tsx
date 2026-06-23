import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { Check, Eraser, Plus, Sparkles, Trash2 } from 'lucide-react';
import { buildProductionReports } from '@/shared/reports';
import { useWorkspace } from '@/store/workspace';
import type { ProductionTag } from '@/shared/types';

const categories: ProductionTag['category'][] = ['prop', 'wardrobe', 'cast', 'vehicle', 'vfx', 'sound', 'location', 'custom'];

export function ProductionPanel() {
  const {
    document,
    selectedElementId,
    addProductionTagToSelected,
    addScriptNoteToSelected,
    toggleOmitSelected,
    setRevisionMode,
    setActiveRevisionSet,
    updateRevisionSet,
    markSelectedRevised,
    clearSelectedRevision,
    updateScriptNote,
    deleteScriptNote
  } = useWorkspace();
  const selected = document.elements.find((element) => element.id === selectedElementId);
  const activeRevision = document.revisions.find((revision) => revision.active) ?? document.revisions[0];
  const revisionCount = document.elements.filter((element) => element.revisionColor).length;
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<ProductionTag['category']>('prop');
  const [note, setNote] = useState('');
  const reports = useMemo(() => buildProductionReports(document), [document]);
  const scriptNotes = useMemo(
    () =>
      document.elements.flatMap((element) =>
        element.notes.map((scriptNote) => ({
          ...scriptNote,
          elementId: element.id,
          elementType: element.type,
          lineText: element.text
        }))
      ),
    [document.elements]
  );

  function addTag() {
    if (!label.trim()) return;
    addProductionTagToSelected({ label: label.trim(), category, color: '#2f6fed' });
    setLabel('');
  }

  function addNote() {
    addScriptNoteToSelected(note);
    setNote('');
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Notes / Revisions</span>
        <small>{selected ? selected.type : 'No selection'}</small>
      </div>
      <div className="form-row">
        <select value={category} onChange={(event) => setCategory(event.target.value as ProductionTag['category'])}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input placeholder="Tag label" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button title="Add tag" onClick={addTag}>
          <Plus size={15} />
        </button>
      </div>
      <div className="form-row">
        <input placeholder="ScriptNote" value={note} onChange={(event) => setNote(event.target.value)} />
        <button title="Add note" onClick={addNote}>
          <Plus size={15} />
        </button>
      </div>

      <div className="note-list">
        <h3>Selected line notes</h3>
        {selected?.notes.length ? (
          selected.notes.map((scriptNote) => (
            <NoteEditor
              key={scriptNote.id}
              elementId={selected.id}
              elementType={selected.type}
              lineText={selected.text}
              note={scriptNote}
              onUpdate={updateScriptNote}
              onDelete={deleteScriptNote}
            />
          ))
        ) : (
          <p className="empty-copy">No notes on the selected line.</p>
        )}

        <h3>All script notes</h3>
        {scriptNotes.length ? (
          scriptNotes.map((scriptNote) => (
            <NoteEditor
              key={`${scriptNote.elementId}:${scriptNote.id}`}
              elementId={scriptNote.elementId}
              elementType={scriptNote.elementType}
              lineText={scriptNote.lineText}
              note={scriptNote}
              onUpdate={updateScriptNote}
              onDelete={deleteScriptNote}
            />
          ))
        ) : (
          <p className="empty-copy">No script notes yet.</p>
        )}
      </div>

      <div className="revision-card">
        {activeRevision && (
          <div className="revision-status" style={{ '--active-revision': activeRevision.color } as React.CSSProperties}>
            <span>{revisionCount}</span>
            <strong>{activeRevision.name}</strong>
          </div>
        )}
        <label className="revision-toggle">
          <span>
            <strong>Revision Mode</strong>
            <small>{activeRevision ? activeRevision.name : 'No revision set'}</small>
          </span>
          <input type="checkbox" checked={document.settings.revisionMode} onChange={(event) => setRevisionMode(event.target.checked)} />
        </label>

        <select value={activeRevision?.id ?? ''} onChange={(event) => setActiveRevisionSet(event.target.value)}>
          {document.revisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revision.name}
            </option>
          ))}
        </select>

        {activeRevision && (
          <>
            <div className="revision-fields">
              <label>
                <span>Revision mark</span>
                <input value={activeRevision.mark ?? '*'} maxLength={2} onChange={(event) => updateRevisionSet(activeRevision.id, { mark: event.target.value || '*' })} />
              </label>
            </div>
            <div className="revision-palette" aria-label="Revision set colors">
              {document.revisions.map((revision) => (
                <button
                  key={revision.id}
                  title={revision.name}
                  className={revision.id === activeRevision.id ? 'is-active' : ''}
                  style={{ '--revision-chip': revision.color } as React.CSSProperties}
                  onClick={() => setActiveRevisionSet(revision.id)}
                />
              ))}
            </div>
          </>
        )}

        <div className="segmented">
          <button onClick={markSelectedRevised} disabled={!selected}>
            <Sparkles size={14} />
            <span>Mark revised</span>
          </button>
          <button onClick={clearSelectedRevision} disabled={!selected?.revisionColor}>
            <Eraser size={14} />
            <span>Clear mark</span>
          </button>
          <button onClick={toggleOmitSelected} disabled={!selected}>
            <span>Omit</span>
          </button>
        </div>
      </div>

      <h3>Reports</h3>
      {reports.map((report) => (
        <div key={`${report.category}:${report.label}`} className="report-row">
          <span>{report.label}</span>
          <small>{report.category} x{report.count}</small>
        </div>
      ))}
    </section>
  );
}

function NoteEditor({
  elementId,
  elementType,
  lineText,
  note,
  onUpdate,
  onDelete
}: {
  elementId: string;
  elementType: string;
  lineText: string;
  note: { id: string; text: string; color: string; resolved: boolean };
  onUpdate: (elementId: string, noteId: string, patch: { text?: string; color?: string; resolved?: boolean }) => void;
  onDelete: (elementId: string, noteId: string) => void;
}) {
  const [draft, setDraft] = useState(note.text);

  useEffect(() => {
    setDraft(note.text);
  }, [note.text]);

  return (
    <article className={note.resolved ? 'note-row is-resolved' : 'note-row'} style={{ '--note-color': note.color } as React.CSSProperties}>
      <textarea
        aria-label="Script note text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = draft.trim();
          if (next && next !== note.text) onUpdate(elementId, note.id, { text: next });
          if (!next) setDraft(note.text);
        }}
      />
      <small>
        {elementType} - {lineText || 'Blank line'}
      </small>
      <div className="note-row__actions">
        <input aria-label="Note color" type="color" value={note.color} onChange={(event) => onUpdate(elementId, note.id, { color: event.target.value })} />
        <button title={note.resolved ? 'Reopen note' : 'Resolve note'} onClick={() => onUpdate(elementId, note.id, { resolved: !note.resolved })}>
          <Check size={13} />
        </button>
        <button className="danger" title="Delete note" onClick={() => onDelete(elementId, note.id)}>
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}
