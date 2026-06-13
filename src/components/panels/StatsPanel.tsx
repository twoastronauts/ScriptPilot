import { Timer } from 'lucide-react';
import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function StatsPanel() {
  const { document, sprintStartedAt, sprintBaseline, startSprint, stopSprint } = useWorkspace();
  const stats = computeWritingStats(document);
  const sprintDelta = sprintBaseline
    ? { words: Math.max(0, stats.words - sprintBaseline.words), pages: Math.max(0, stats.pages - sprintBaseline.pages) }
    : { words: 0, pages: 0 };

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Writing Stats</span>
        <button title={sprintStartedAt ? 'Stop sprint' : 'Start sprint'} onClick={sprintStartedAt ? stopSprint : startSprint}>
          <Timer size={16} />
        </button>
      </div>
      <div className="metric-grid">
        <Metric label="Pages" value={stats.pages} />
        <Metric label="Words" value={stats.words} />
        <Metric label="Scenes" value={stats.scenes} />
        <Metric label="Streak" value={`${stats.streakDays}d`} />
        <Metric label="Time" value={formatSeconds(stats.writingSeconds)} />
        <Metric label="Tags" value={stats.tags} />
      </div>
      {sprintStartedAt && (
        <>
          <h3>Current Sprint</h3>
          <div className="metric-grid">
            <Metric label="Sprint Words" value={`+${sprintDelta.words}`} />
            <Metric label="Sprint Pages" value={`+${sprintDelta.pages}`} />
          </div>
        </>
      )}
      <h3>Character Screen Time</h3>
      {stats.characters.map((character) => (
        <div key={character.name} className="stat-row">
          <span>{character.name}</span>
          <small>{character.estimatedLines} lines in {character.scenes} scenes</small>
        </div>
      ))}
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
