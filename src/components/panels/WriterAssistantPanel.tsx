import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileClock, Lightbulb, MessageSquareText, Sparkles, Stethoscope } from 'lucide-react';
import { createProductionPaginationPlan } from '@/shared/formattingV2';
import { runScriptDoctor, type OverusedWordIssue } from '@/shared/scriptDoctor';
import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';
import type { StoryCheckResult } from '@/shared/types';

export function WriterAssistantPanel() {
  const { document, setSelectedElement, captureDraftVersion, createRevisionMemo } = useWorkspace();
  const stats = useMemo(() => computeWritingStats(document), [document]);
  const report = useMemo(() => runScriptDoctor(document), [document]);
  const pagination = useMemo(() => createProductionPaginationPlan(document.elements, document.settings.pageNumberStart), [document.elements, document.settings.pageNumberStart]);
  const warningCount = report.checks.filter((check) => check.severity !== 'note').length + report.overusedWords.filter((issue) => issue.severity !== 'note').length;

  return (
    <section className="panel writer-assistant-panel">
      <div className="panel-title">
        <span>Script Doctor</span>
        <Stethoscope size={16} />
      </div>

      <div className="metric-grid">
        <Metric label={report.grade} value={report.score} />
        <Metric label="Doctor Notes" value={report.checks.length} />
        <Metric label="Warnings" value={warningCount} />
        <Metric label="Typos" value={report.spellingIssueCount} />
        <Metric label="Overused" value={report.overusedWords.length} />
        <Metric label="MORE" value={pagination.moreAfterElementIds.length} />
      </div>

      <div className="segmented">
        <button title="Capture draft snapshot" onClick={() => captureDraftVersion(`Draft ${document.draftVersions.length + 1}`)}>
          <FileClock size={15} />
          <span>Snapshot</span>
        </button>
        <button title="Create revision memo" onClick={createRevisionMemo}>
          <CheckCircle2 size={15} />
          <span>Memo</span>
        </button>
      </div>

      <h3>Prescription</h3>
      <div className="doctor-summary">
        {report.summary.map((line) => (
          <p key={line}>
            <Sparkles size={14} />
            <span>{line}</span>
          </p>
        ))}
      </div>

      <h3>Doctor Notes</h3>
      {report.checks.length ? (
        report.checks.slice(0, 14).map((check) => <CheckRow key={check.id} check={check} onSelect={setSelectedElement} />)
      ) : (
        <div className="home-empty">
          <strong>Clean pass</strong>
          <span>No major story or proofing warnings yet.</span>
        </div>
      )}

      <h3>Overused Words</h3>
      {report.overusedWords.length ? (
        report.overusedWords.slice(0, 10).map((issue) => <OverusedRow key={issue.word} issue={issue} onSelect={setSelectedElement} />)
      ) : (
        <p className="report-row">No overused words crossed the doctor threshold.</p>
      )}

      <h3>Dialogue Tuner</h3>
      {report.dialogue.slice(0, 6).map((analysis) => (
        <div key={analysis.characterName} className="shot-row">
          <strong>{analysis.characterName}</strong>
          <span>
            {analysis.lineCount} lines, {analysis.averageWordsPerLine} words/line, {analysis.questionCount} questions
          </span>
          <small>
            {analysis.repeatedPhrases.length ? `Repeated: ${analysis.repeatedPhrases.slice(0, 3).join(', ')}` : 'No repeated phrases flagged'}
          </small>
        </div>
      ))}
      {!report.dialogue.length && <p className="report-row">Dialogue analysis appears after character cues and dialogue lines.</p>}

      <h3>Draft Safety</h3>
      <div className="report-row">
        <span>
          <strong>{document.draftVersions.length}</strong> snapshots
        </span>
        <small>{stats.words} words tracked locally</small>
      </div>
      <div className="report-row">
        <span>
          <strong>{document.revisionMemos.length}</strong> revision memos
        </span>
        <small>{document.settings.collabProvider ?? 'local'} collaboration metadata</small>
      </div>
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

function CheckRow({ check, onSelect }: { check: StoryCheckResult; onSelect: (id?: string) => void }) {
  const Icon = check.severity === 'note' ? Lightbulb : AlertTriangle;
  return (
    <button className={`assistant-check assistant-check--${check.severity}`} onClick={() => onSelect(check.elementId)} disabled={!check.elementId}>
      <Icon size={15} />
      <span>
        <strong>{check.sceneNumber ? `Scene ${check.sceneNumber}: ` : ''}{check.title}</strong>
        <small>{check.message}</small>
        <em>{check.suggestion}</em>
      </span>
      {check.category === 'dialogue' && <MessageSquareText size={14} />}
    </button>
  );
}

function OverusedRow({ issue, onSelect }: { issue: OverusedWordIssue; onSelect: (id?: string) => void }) {
  const Icon = issue.severity === 'note' ? Lightbulb : AlertTriangle;
  return (
    <button className={`assistant-check assistant-check--${issue.severity}`} onClick={() => onSelect(issue.elementIds[0])} disabled={!issue.elementIds.length}>
      <Icon size={15} />
      <span>
        <strong>
          "{issue.word}" x{issue.count} ({issue.density}%)
        </strong>
        <small>{issue.message}</small>
        <em>{issue.suggestions.length ? `Try: ${issue.suggestions.join(', ')}` : 'Try cutting repeats or making each beat more specific.'}</em>
      </span>
      <MessageSquareText size={14} />
    </button>
  );
}
