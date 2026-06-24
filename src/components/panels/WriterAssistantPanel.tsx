import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileClock, Lightbulb, MessageSquareText, Sparkles, Stethoscope } from 'lucide-react';
import { createProductionPaginationPlan, type ProductionPaginationPlan } from '@/shared/formattingV2';
import { runScriptDoctor, type OverusedWordIssue, type ScriptDoctorReport } from '@/shared/scriptDoctor';
import { computeWritingStats, type WritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';
import type { ScriptDocument, StoryCheckResult } from '@/shared/types';
import type { ScriptDoctorWorkerError, ScriptDoctorWorkerRequest, ScriptDoctorWorkerResult } from '@/workers/scriptDoctor.worker';

export function WriterAssistantPanel() {
  const { document, setSelectedElement, captureDraftVersion, createRevisionMemo } = useWorkspace();
  const [analysis, setAnalysis] = useState<DoctorAnalysis>(() => createPendingAnalysis(document));
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const documentKey = useMemo(
    () =>
      [
        document.id,
        document.settings.pageNumberStart,
        document.elements
          .map((element) => `${element.id}:${element.type}:${element.text}:${element.revisionColor ?? ''}:${element.notes.length}:${element.productionTags.length}`)
          .join('|')
      ].join('::'),
    [document.elements, document.id, document.settings.pageNumberStart]
  );

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const leanDocument = leanDoctorDocument(document);
    const analyzingNotice = window.setTimeout(() => setAnalyzing(true), 180);

    const startAnalysis = window.setTimeout(() => {
      if (typeof Worker !== 'undefined') {
        workerRef.current?.terminate();
        const worker = new Worker(new URL('../../workers/scriptDoctor.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<ScriptDoctorWorkerResult | ScriptDoctorWorkerError>) => {
          if (event.data.requestId !== requestId) return;
          if ('error' in event.data) {
            setAnalysisError(event.data.error);
          } else {
            setAnalysis({ report: event.data.report, stats: event.data.stats, pagination: event.data.pagination });
            setAnalysisError(null);
          }
          window.clearTimeout(analyzingNotice);
          setAnalyzing(false);
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
        worker.onerror = (error) => {
          if (requestIdRef.current !== requestId) return;
          try {
            setAnalysis(computeDoctorAnalysis(leanDocument));
            setAnalysisError('Script Doctor worker fell back to safe imported-script mode.');
          } catch {
            setAnalysisError(error.message || 'Script Doctor worker failed.');
          }
          window.clearTimeout(analyzingNotice);
          setAnalyzing(false);
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
        const payload: ScriptDoctorWorkerRequest = {
          requestId,
          document: leanDocument
        };
        worker.postMessage(payload);
        return;
      }

      try {
        setAnalysis(computeDoctorAnalysis(leanDocument));
        setAnalysisError(null);
      } catch (error) {
        setAnalysisError(error instanceof Error ? error.message : 'Script Doctor failed.');
      } finally {
        window.clearTimeout(analyzingNotice);
        setAnalyzing(false);
      }
    }, document.fdxShadow ? 420 : 120);

    return () => {
      window.clearTimeout(analyzingNotice);
      window.clearTimeout(startAnalysis);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [documentKey]);

  const { report, stats, pagination } = analysis;
  const warningCount = report.checks.filter((check) => check.severity !== 'note').length + report.overusedWords.filter((issue) => issue.severity !== 'note').length;

  return (
    <section className="panel writer-assistant-panel">
      <div className="panel-title">
        <span>Script Doctor</span>
        {analyzing ? <small>Analyzing...</small> : <Stethoscope size={16} />}
      </div>
      {analysisError && <p className="report-row report-row--warning">Script Doctor could not complete: {analysisError}</p>}

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

interface DoctorAnalysis {
  report: ScriptDoctorReport;
  stats: WritingStats;
  pagination: ProductionPaginationPlan;
}

function computeDoctorAnalysis(document: ScriptDocument): DoctorAnalysis {
  return {
    report: runScriptDoctor(document, { maxElements: 900, maxSpellingElements: 320 }),
    stats: computeWritingStats(document),
    pagination: createProductionPaginationPlan(document.elements, document.settings.pageNumberStart)
  };
}

function createPendingAnalysis(document: ScriptDocument): DoctorAnalysis {
  return {
    report: {
      score: 0,
      grade: 'Needs Pass',
      summary: ['Script Doctor is warming up. Large scripts analyze in the background so writing stays responsive.'],
      checks: [],
      overusedWords: [],
      dialogue: [],
      spellingIssueCount: 0,
      sceneCount: 0,
      wordCount: 0,
      analyzedElementCount: 0,
      totalElementCount: document.elements.length,
      limited: false
    },
    stats: {
      pages: 0,
      words: 0,
      scenes: 0,
      notes: 0,
      tags: 0,
      writingSeconds: 0,
      pagesAdded: 0,
      streakDays: 0,
      characters: [],
      scenesList: []
    },
    pagination: {
      pages: [],
      continuedCharacterElementIds: [],
      moreAfterElementIds: [],
      lockedPageElementIds: []
    }
  };
}

function leanDoctorDocument(document: ScriptDocument): ScriptDocument {
  return {
    ...document,
    elements: document.elements.map((element) => ({
      ...element,
      fdx: undefined
    })),
    fdxShadow: document.fdxShadow
      ? {
          ...document.fdxShadow,
          originalXml: '',
          rawRoot: undefined
        }
      : undefined
  };
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
