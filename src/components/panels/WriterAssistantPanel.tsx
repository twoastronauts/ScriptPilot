import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileClock, Lightbulb, MessageSquareText, Sparkles } from 'lucide-react';
import { analyzeDialogue } from '@/shared/dialogueStudio';
import { createProductionPaginationPlan } from '@/shared/formattingV2';
import { scanProofingIssues } from '@/shared/proofing';
import { analyzeScript } from '@/shared/storyAssistant';
import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';
import type { StoryCheckResult } from '@/shared/types';

export function WriterAssistantPanel() {
  const { document, setSelectedElement, captureDraftVersion, createRevisionMemo } = useWorkspace();
  const stats = useMemo(() => computeWritingStats(document), [document]);
  const storyChecks = useMemo(() => analyzeScript(document), [document]);
  const proofingChecks = useMemo(() => scanProofingIssues(document), [document]);
  const dialogue = useMemo(() => analyzeDialogue(document), [document]);
  const pagination = useMemo(() => createProductionPaginationPlan(document.elements, document.settings.pageNumberStart), [document.elements, document.settings.pageNumberStart]);
  const allChecks = [...storyChecks, ...proofingChecks];
  const strongCount = allChecks.filter((check) => check.severity === 'strong').length;
  const warningCount = allChecks.filter((check) => check.severity === 'warning').length;

  return (
    <section className="panel writer-assistant-panel">
      <div className="panel-title">
        <span>V02 Assistant</span>
        <Sparkles size={16} />
      </div>

      <div className="metric-grid">
        <Metric label="Checks" value={allChecks.length} />
        <Metric label="Warnings" value={warningCount + strongCount} />
        <Metric label="MORE" value={pagination.moreAfterElementIds.length} />
        <Metric label="CONT'D" value={pagination.continuedCharacterElementIds.length} />
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

      <h3>Scene Intelligence</h3>
      {allChecks.length ? (
        allChecks.slice(0, 12).map((check) => <CheckRow key={check.id} check={check} onSelect={setSelectedElement} />)
      ) : (
        <div className="home-empty">
          <strong>Clean pass</strong>
          <span>No major story or proofing warnings yet.</span>
        </div>
      )}

      <h3>Dialogue Tuner</h3>
      {dialogue.slice(0, 6).map((analysis) => (
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
      {!dialogue.length && <p className="report-row">Dialogue analysis appears after character cues and dialogue lines.</p>}

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
