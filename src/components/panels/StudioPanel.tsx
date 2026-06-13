import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, ContactRound, Images, ListChecks } from 'lucide-react';
import { buildProductionBoard } from '@/shared/productionSuite';
import { useWorkspace } from '@/store/workspace';
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
  const { document } = useWorkspace();
  const board = useMemo(() => buildProductionBoard(document), [document]);
  const [view, setView] = useState<StudioView>('shots');

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Shot List</span>
        <small>{board.scenes.length} scenes</small>
      </div>

      <div className="metric-grid">
        <Metric label="Shots" value={board.shotList.length} />
        <Metric label="Cards" value={board.storyboardCards.length} />
        <Metric label="Days" value={board.stripboardSchedule.length} />
        <Metric label="Contacts" value={board.contacts.length} />
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

      {board.scenes.length === 0 ? (
        <p className="report-row">No scenes yet.</p>
      ) : (
        <>
          {view === 'shots' && <ShotList shots={board.shotList} />}
          {view === 'storyboard' && <StoryboardCards cards={board.storyboardCards} />}
          {view === 'schedule' && <ScheduleList schedule={board.stripboardSchedule} />}
          {view === 'calls' && <CallSheets callSheets={board.callSheets} />}
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

function ShotList({ shots }: { shots: ProductionShot[] }) {
  return (
    <>
      <h3>Shot List</h3>
      {shots.map((shot) => (
        <div key={shot.id} className="shot-row">
          <strong>
            Scene {shot.sceneNumber}.{shot.order} - {shot.label}
          </strong>
          <span>{shot.description || shot.subject}</span>
          <small>
            {shot.shotType} - {shot.location} - {shot.timeOfDay} - {shot.estimatedMinutes}m setup
          </small>
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

function CallSheets({ callSheets }: { callSheets: CallSheetSummary[] }) {
  return (
    <>
      <h3>Call Sheets</h3>
      {callSheets.map((callSheet) => (
        <div key={callSheet.id} className="report-row">
          <span>
            <strong>{callSheet.title}</strong> {callSheet.callTime}
          </span>
          <small>
            {callSheet.recipients.length} recipients - {joinOrDash(callSheet.departments)}
          </small>
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
