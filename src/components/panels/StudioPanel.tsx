import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, ContactRound, Images, ListChecks, Plus, Trash2 } from 'lucide-react';
import { buildProductionBoard } from '@/shared/productionSuite';
import { useWorkspace } from '@/store/workspace';
import type { EditableCallSheet, EditableProductionShot } from '@/shared/types';
import type {
  CallSheetSummary,
  CallSheetRecipient,
  ProductionContact,
  ProductionShot,
  StoryboardCard,
  StripboardDay
} from '@/shared/productionSuite';

type StudioView = 'shots' | 'storyboard' | 'schedule' | 'calls' | 'contacts';

const viewTabs = [
  { id: 'shots', label: 'Shots', icon: ListChecks },
  { id: 'storyboard', label: 'Boards', icon: Images },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'calls', label: 'Calls', icon: ClipboardList },
  { id: 'contacts', label: 'Contacts', icon: ContactRound }
] as const;

export function StudioPanel() {
  const { document, setProductionShots, setProductionCallSheets } = useWorkspace();
  const board = useMemo(() => buildProductionBoard(document), [document]);
  const [view, setView] = useState<StudioView>('shots');
  const shotRows = useMemo(
    () => (document.productionShots?.length ? document.productionShots : board.shotList.map(generatedShotToEditable)),
    [board.shotList, document.productionShots]
  );
  const callRows = useMemo(
    () => (document.productionCallSheets?.length ? document.productionCallSheets : board.callSheets.map(generatedCallSheetToEditable)),
    [board.callSheets, document.productionCallSheets]
  );

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Shot List</span>
        <small>{board.scenes.length} scenes</small>
      </div>

      <div className="metric-grid">
        <Metric label="Shots" value={shotRows.length} />
        <Metric label="Cards" value={board.storyboardCards.length} />
        <Metric label="Days" value={board.stripboardSchedule.length} />
        <Metric label="Calls" value={callRows.length} />
      </div>

      <div className="segmented">
        {viewTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={view === tab.id ? 'is-active' : ''} title={tab.label} onClick={() => setView(tab.id)}>
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {board.scenes.length === 0 && view !== 'shots' && view !== 'calls' ? (
        <p className="report-row">No scenes yet.</p>
      ) : (
        <>
          {view === 'shots' && <ShotList shots={shotRows} onChange={setProductionShots} />}
          {view === 'storyboard' && <StoryboardCards cards={board.storyboardCards} />}
          {view === 'schedule' && <ScheduleList schedule={board.stripboardSchedule} />}
          {view === 'calls' && <CallSheets callSheets={callRows} onChange={setProductionCallSheets} />}
          {view === 'contacts' && <Contacts contacts={board.contacts} recipients={board.recipients} />}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ShotList({ shots, onChange }: { shots: EditableProductionShot[]; onChange: (shots: EditableProductionShot[]) => void }) {
  function updateShot(id: string, patch: Partial<EditableProductionShot>) {
    onChange(shots.map((shot) => (shot.id === id ? { ...shot, ...patch, custom: true } : shot)));
  }

  function addShot() {
    const nextOrder = shots.length + 1;
    onChange([
      ...shots,
      {
        id: crypto.randomUUID(),
        sceneNumber: shots.at(-1)?.sceneNumber ?? 1,
        order: nextOrder,
        shotNumber: `${shots.at(-1)?.sceneNumber ?? 1}${String.fromCharCode(64 + Math.min(26, nextOrder))}`,
        setup: 'Manual setup',
        shotType: 'custom',
        label: 'New shot',
        description: '',
        subject: '',
        cameraAngle: 'Eye level',
        cameraMovement: 'Static',
        cameraEquipment: 'Camera',
        framing: '16:9',
        location: '',
        timeOfDay: '',
        characters: [],
        tags: [],
        estimatedMinutes: 4,
        setupMinutes: 20,
        custom: true
      }
    ]);
  }

  function removeShot(id: string) {
    onChange(shots.filter((shot) => shot.id !== id));
  }

  return (
    <>
      <div className="studio-list-header">
        <h3>Shot List</h3>
        <button type="button" onClick={addShot} title="Add shot">
          <Plus size={14} />
          Add
        </button>
      </div>
      {shots.map((shot) => (
        <div key={shot.id} className="shot-row shot-row--editable">
          <div className="studio-row-toolbar">
            <strong>
              Scene {shot.sceneNumber}.{shot.order} - {shot.shotNumber}
            </strong>
            <button type="button" title="Remove shot" onClick={() => removeShot(shot.id)}>
              <Trash2 size={13} />
            </button>
          </div>
          <label>
            <span>Label</span>
            <input value={shot.label} onChange={(event) => updateShot(shot.id, { label: event.target.value })} />
          </label>
          <label>
            <span>Brief description</span>
            <textarea rows={2} value={shot.description} onChange={(event) => updateShot(shot.id, { description: event.target.value })} />
          </label>
          <div className="studio-edit-grid">
            <label>
              <span>Shot type</span>
              <input value={shot.shotType} onChange={(event) => updateShot(shot.id, { shotType: event.target.value as EditableProductionShot['shotType'] })} />
            </label>
            <label>
              <span>Angle</span>
              <input value={shot.cameraAngle} onChange={(event) => updateShot(shot.id, { cameraAngle: event.target.value })} />
            </label>
            <label>
              <span>Movement</span>
              <input value={shot.cameraMovement} onChange={(event) => updateShot(shot.id, { cameraMovement: event.target.value })} />
            </label>
            <label>
              <span>Equipment</span>
              <input value={shot.cameraEquipment} onChange={(event) => updateShot(shot.id, { cameraEquipment: event.target.value })} />
            </label>
            <label>
              <span>Framing</span>
              <input value={shot.framing} onChange={(event) => updateShot(shot.id, { framing: event.target.value })} />
            </label>
            <label>
              <span>Setup min.</span>
              <input type="number" min={0} value={shot.setupMinutes} onChange={(event) => updateShot(shot.id, { setupMinutes: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
          </div>
        </div>
      ))}
    </>
  );
}

function StoryboardCards({ cards }: { cards: StoryboardCard[] }) {
  return (
    <>
      <h3>Storyboard Cards</h3>
      {cards.map((card) => (
        <div key={card.id} className="report-row">
          <span>
            <strong>{card.frameLabel}</strong> {card.caption}
          </span>
          <small>
            {card.location} / {card.timeOfDay}
          </small>
        </div>
      ))}
    </>
  );
}

function ScheduleList({ schedule }: { schedule: StripboardDay[] }) {
  return (
    <>
      <h3>Stripboard Schedule</h3>
      {schedule.map((day) => (
        <div key={day.id} className="report-row">
          <span>
            <strong>Day {day.shootDay}</strong> {day.location}
          </span>
          <small>
            {day.scenes.length} scenes - {day.totalPages} pages - {joinOrDash(day.cast)}
          </small>
        </div>
      ))}
    </>
  );
}

function CallSheets({ callSheets, onChange }: { callSheets: EditableCallSheet[]; onChange: (callSheets: EditableCallSheet[]) => void }) {
  function updateCallSheet(id: string, patch: Partial<EditableCallSheet>) {
    onChange(callSheets.map((callSheet) => (callSheet.id === id ? { ...callSheet, ...patch, custom: true } : callSheet)));
  }

  function addCallSheet() {
    onChange([
      ...callSheets,
      {
        id: crypto.randomUUID(),
        projectTitle: '',
        shootDay: (callSheets.at(-1)?.shootDay ?? 0) + 1,
        title: 'New Call Sheet',
        location: '',
        timeOfDay: '',
        callTime: '7:00 AM',
        scenesText: '',
        cast: [],
        departments: [],
        notes: ['Manual call sheet.'],
        custom: true
      }
    ]);
  }

  function removeCallSheet(id: string) {
    onChange(callSheets.filter((callSheet) => callSheet.id !== id));
  }

  return (
    <>
      <div className="studio-list-header">
        <h3>Call Sheets</h3>
        <button type="button" onClick={addCallSheet} title="Add call sheet">
          <Plus size={14} />
          Add
        </button>
      </div>
      {callSheets.map((callSheet) => (
        <div key={callSheet.id} className="shot-row shot-row--editable">
          <div className="studio-row-toolbar">
            <strong>Day {callSheet.shootDay}</strong>
            <button type="button" title="Remove call sheet" onClick={() => removeCallSheet(callSheet.id)}>
              <Trash2 size={13} />
            </button>
          </div>
          <label>
            <span>Title</span>
            <input value={callSheet.title} onChange={(event) => updateCallSheet(callSheet.id, { title: event.target.value })} />
          </label>
          <div className="studio-edit-grid">
            <label>
              <span>Location</span>
              <input value={callSheet.location} onChange={(event) => updateCallSheet(callSheet.id, { location: event.target.value })} />
            </label>
            <label>
              <span>Call time</span>
              <input value={callSheet.callTime} onChange={(event) => updateCallSheet(callSheet.id, { callTime: event.target.value })} />
            </label>
            <label>
              <span>Time</span>
              <input value={callSheet.timeOfDay} onChange={(event) => updateCallSheet(callSheet.id, { timeOfDay: event.target.value })} />
            </label>
            <label>
              <span>Departments</span>
              <input value={callSheet.departments.join(', ')} onChange={(event) => updateCallSheet(callSheet.id, { departments: splitList(event.target.value) })} />
            </label>
          </div>
          <label>
            <span>Scenes</span>
            <textarea rows={2} value={callSheet.scenesText} onChange={(event) => updateCallSheet(callSheet.id, { scenesText: event.target.value })} />
          </label>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={callSheet.notes.join('\n')} onChange={(event) => updateCallSheet(callSheet.id, { notes: event.target.value.split(/\r?\n/).filter(Boolean) })} />
          </label>
        </div>
      ))}
    </>
  );
}

function Contacts({ contacts, recipients }: { contacts: ProductionContact[]; recipients: CallSheetRecipient[] }) {
  return (
    <>
      <h3>Contacts</h3>
      {contacts.map((contact) => (
        <div key={contact.id} className="report-row">
          <span>
            <strong>{contact.name}</strong> {contact.department}
          </span>
          <small>{contact.email || contact.phone || 'manual'}</small>
        </div>
      ))}
      <h3>Recipients</h3>
      {recipients.map((recipient) => (
        <div key={recipient.id} className="report-row">
          <span>{recipient.name}</span>
          <small>
            {recipient.role} - {recipient.channel}
          </small>
        </div>
      ))}
    </>
  );
}

function joinOrDash(items: string[]): string {
  return items.length ? items.join(', ') : '-';
}

function generatedShotToEditable(shot: ProductionShot): EditableProductionShot {
  return {
    ...shot,
    tags: shot.tags.map((tag) => tag.label),
    custom: false
  };
}

function generatedCallSheetToEditable(callSheet: CallSheetSummary): EditableCallSheet {
  return {
    id: callSheet.id,
    projectTitle: callSheet.projectTitle,
    shootDay: callSheet.shootDay,
    title: callSheet.title,
    location: callSheet.location,
    timeOfDay: callSheet.timeOfDay,
    callTime: callSheet.callTime,
    scenesText: callSheet.scenes.map((scene) => `Scene ${scene.sceneNumber}: ${scene.heading}`).join('\n'),
    cast: callSheet.cast,
    departments: callSheet.departments,
    notes: callSheet.notes,
    custom: false
  };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
