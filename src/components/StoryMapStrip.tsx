import { Boxes, Film, Flag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { estimatePageCount, lineWidthFor } from '@/shared/screenplay';
import type { Beat, ScriptDocument, ScriptElement } from '@/shared/types';
import { useWorkspace } from '@/store/workspace';

const MIN_MAP_WIDTH = 920;
const EXPANDED_SUMMARY_HEIGHT = 188;

interface SceneEntry {
  element: ScriptElement;
  index: number;
  page: number;
  nextPage: number;
  summary: string;
}

interface MapRange {
  id: string;
  sourceRangeId?: string;
  label: string;
  color: string;
  summary?: string;
  startPage: number;
  endPage: number;
}

interface ActEditorState {
  rangeId?: string;
  leftPct: number;
  label: string;
  startPage: number;
  endPage: number;
  color: string;
  summary: string;
}

interface FloatingPreview {
  title: string;
  meta: string;
  body: string;
  color: string;
  left: number;
  top: number;
}

const STRUCTURE_COLORS = ['#91c8b7', '#6ca8e7', '#a88adf', '#d9a441', '#9f3f45', '#55b8c7', '#b95f89'];

export function OutlineEditorStrip() {
  const {
    document,
    outlineHeight,
    selectedElementId,
    setSelectedElement,
    setPanel,
    addBeatAt,
    updateBeat,
    deleteBeat,
    addStructureRangeAtPage,
    updateStructureRange,
    deleteStructureRange
  } = useWorkspace();
  const [actEditor, setActEditor] = useState<ActEditorState>();
  const [floatingPreview, setFloatingPreview] = useState<FloatingPreview>();

  const pageMap = useMemo(() => buildPageMap(document.elements), [document.elements]);
  const scenes = useMemo(() => buildSceneEntries(document.elements, pageMap), [document.elements, pageMap]);
  const pageCount = useMemo(() => resolvePageCount(document, pageMap, scenes), [document, pageMap, scenes]);
  const pageNumbers = useMemo(() => buildPageNumbers(pageCount), [pageCount]);
  const actRanges = useMemo(() => buildActRanges(document, pageMap, pageCount), [document, pageMap, pageCount]);
  const beatRanges = useMemo(() => buildBeatRanges(document.beats, pageMap, pageCount), [document.beats, pageMap, pageCount]);
  const expanded = outlineHeight >= EXPANDED_SUMMARY_HEIGHT;
  const selectedPage = selectedElementId ? pageMap.get(selectedElementId) ?? 1 : 1;

  useEffect(() => {
    if (!actEditor) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActEditor(undefined);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [actEditor]);

  const openActEditor = (range: MapRange, event?: React.SyntheticEvent<HTMLElement>) => {
    event?.stopPropagation();
    const existing = range.sourceRangeId ? document.structureRanges.find((item) => item.id === range.sourceRangeId) : undefined;
    setActEditor({
      rangeId: existing?.id,
      leftPct: leftForPage(range.startPage, pageCount),
      label: range.label,
      startPage: range.startPage,
      endPage: range.endPage,
      color: range.color,
      summary: range.summary ?? ''
    });
  };

  const openNewActEditor = (event: React.MouseEvent<HTMLElement>) => {
    const page = pageFromLaneEvent(event, pageCount);
    const existingActCount = document.structureRanges.filter((range) => range.kind === 'act').length;
    const defaultSpan = defaultActSpan(pageCount, existingActCount + 1);
    setActEditor({
      leftPct: leftForPage(page, pageCount),
      label: `ACT ${existingActCount + 1}`,
      startPage: page,
      endPage: Math.min(pageCount, page + defaultSpan - 1),
      color: STRUCTURE_COLORS[existingActCount % STRUCTURE_COLORS.length],
      summary: ''
    });
  };

  const saveActEditor = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actEditor) return;

    const startPage = clampPage(actEditor.startPage, pageCount);
    const endPage = Math.max(startPage, clampPage(actEditor.endPage, pageCount));
    const startElementId = elementIdForOutlinePage(document.elements, pageMap, startPage, 'start');
    const endElementId = elementIdForOutlinePage(document.elements, pageMap, endPage, 'end') ?? startElementId;
    if (!startElementId || !endElementId) return;

    const patch = {
      label: actEditor.label.trim() || 'ACT',
      color: actEditor.color,
      summary: actEditor.summary.trim(),
      startPage,
      endPage,
      startElementId,
      endElementId,
      visible: true
    };

    if (actEditor.rangeId) {
      updateStructureRange(actEditor.rangeId, patch);
    } else {
      const id = addStructureRangeAtPage(startPage, 'act');
      updateStructureRange(id, patch);
    }

    setActEditor(undefined);
  };

  const applyActRangePages = (rangeId: string, startPage: number, endPage: number) => {
    const nextStartPage = clampPage(startPage, pageCount);
    const nextEndPage = Math.max(nextStartPage, clampPage(endPage, pageCount));
    const startElementId = elementIdForOutlinePage(document.elements, pageMap, nextStartPage, 'start');
    const endElementId = elementIdForOutlinePage(document.elements, pageMap, nextEndPage, 'end') ?? startElementId;
    if (!startElementId || !endElementId) return;

    updateStructureRange(rangeId, {
      startPage: nextStartPage,
      endPage: nextEndPage,
      startElementId,
      endElementId
    });

    setActEditor((current) =>
      current?.rangeId === rangeId
        ? {
            ...current,
            leftPct: leftForPage(nextStartPage, pageCount),
            startPage: nextStartPage,
            endPage: nextEndPage
          }
        : current
    );
  };

  const startActResize = (range: MapRange, edge: 'start' | 'end', event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!range.sourceRangeId) {
      openActEditor(range, event);
      return;
    }

    const lane = event.currentTarget.closest('.outline-lane-strip');
    if (!(lane instanceof HTMLElement)) return;

    let nextStartPage = range.startPage;
    let nextEndPage = range.endPage;
    let lastApplied = `${nextStartPage}:${nextEndPage}`;
    const previousCursor = window.document.body.style.cursor;
    const previousUserSelect = window.document.body.style.userSelect;
    window.document.body.style.cursor = 'ew-resize';
    window.document.body.style.userSelect = 'none';

    const updateFromClientX = (clientX: number) => {
      const page = pageFromClientX(clientX, lane, pageCount);
      if (edge === 'start') {
        nextStartPage = Math.min(page, nextEndPage);
      } else {
        nextEndPage = Math.max(page, nextStartPage);
      }

      const key = `${nextStartPage}:${nextEndPage}`;
      if (key === lastApplied) return;
      lastApplied = key;
      applyActRangePages(range.sourceRangeId!, nextStartPage, nextEndPage);
    };

    const move = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      updateFromClientX(pointerEvent.clientX);
    };

    const stop = (pointerEvent: PointerEvent) => {
      updateFromClientX(pointerEvent.clientX);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.document.body.style.cursor = previousCursor;
      window.document.body.style.userSelect = previousUserSelect;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  };

  const removeAct = () => {
    if (!actEditor?.rangeId) return;
    deleteStructureRange(actEditor.rangeId);
    setActEditor(undefined);
  };

  const deleteBeatFromOutline = (beatId: string, event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const beat = document.beats.find((item) => item.id === beatId);
    const title = beat?.title.trim() || 'Untitled beat';
    if (!window.confirm(`Delete "${title}" from the beat board and outline?`)) return;
    deleteBeat(beatId);
  };

  const previewHandlers = (preview: Omit<FloatingPreview, 'left' | 'top'>) => ({
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => setFloatingPreview(resolveFloatingPreview(preview, event.currentTarget)),
    onMouseLeave: () => setFloatingPreview(undefined),
    onFocus: (event: React.FocusEvent<HTMLElement>) => setFloatingPreview(resolveFloatingPreview(preview, event.currentTarget)),
    onBlur: () => setFloatingPreview(undefined)
  });

  return (
    <section className={expanded ? 'outline-editor-strip is-expanded' : 'outline-editor-strip'} aria-label="Outline editor">
        <div className="outline-editor-labels">
        <strong>Outline</strong>
        <span>Acts</span>
        <span>Beats</span>
        <span>Scenes</span>
        <span>Pages</span>
        <span>Script</span>
      </div>

      <div className="outline-editor-board" style={{ '--map-width': `${MIN_MAP_WIDTH}px` } as React.CSSProperties}>
        <div className="outline-cursor" style={{ left: `${leftForPage(selectedPage, pageCount)}%` }} aria-hidden="true" />
        <div className="outline-map-header">
          <span>{document.title || 'Untitled Script'}</span>
          <small>{pageCount} dynamic pages</small>
        </div>

        <div className="outline-lane-strip outline-lane-strip--acts" onDoubleClick={openNewActEditor}>
          {actRanges.map((range) => (
            <button
              key={range.id}
              className="outline-beat outline-beat--act"
              style={rangeStyle(range.startPage, range.endPage, pageCount, range.color)}
              onClick={() => {
                const targetRange = range.sourceRangeId ? document.structureRanges.find((item) => item.id === range.sourceRangeId) : undefined;
                if (targetRange) setSelectedElement(targetRange.startElementId);
              }}
              onDoubleClick={(event) => {
                openActEditor(range, event);
              }}
              {...previewHandlers({
                title: range.label,
                meta: `pg. ${range.startPage}-${range.endPage}`,
                body: range.summary || (range.sourceRangeId ? 'Double-click to define this act.' : 'Suggested marker. Double-click to create your own act.'),
                color: range.color
              })}
            >
              {range.sourceRangeId && (
                <span
                  className="outline-range-handle outline-range-handle--start"
                  role="separator"
                  aria-label={`Resize start of ${range.label}`}
                  onPointerDown={(event) => startActResize(range, 'start', event)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                />
              )}
              <Flag size={12} />
              <span className="outline-marker-label">{range.label}</span>
              <small className="outline-range-pages">pg. {range.startPage}-{range.endPage}</small>
              {range.sourceRangeId && (
                <span
                  className="outline-range-handle outline-range-handle--end"
                  role="separator"
                  aria-label={`Resize end of ${range.label}`}
                  onPointerDown={(event) => startActResize(range, 'end', event)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                />
              )}
            </button>
          ))}
        </div>

        <div className="outline-lane-strip outline-lane-strip--sequences" onDoubleClick={(event) => addBeatFromLane(event, pageCount, addBeatAt, updateBeat, setPanel)}>
          {beatRanges.map((range) => (
            <button
              key={range.id}
              className="outline-beat"
              style={rangeStyle(range.startPage, range.endPage, pageCount, range.color)}
              onClick={() => {
                const beat = document.beats.find((item) => item.id === range.id);
                if (beat?.linkedElementId) setSelectedElement(beat.linkedElementId);
                setPanel('beats');
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setPanel('beats');
                window.setTimeout(() => window.dispatchEvent(new CustomEvent('scriptpilot:center-beat', { detail: { beatId: range.id } })), 0);
              }}
              {...previewHandlers({
                title: range.label,
                meta: `pg. ${range.startPage}-${range.endPage}`,
                body: range.summary || 'Double-click to open this beat on the board.',
                color: range.color
              })}
            >
              <Boxes size={12} />
              <span className="outline-marker-label">{range.label}</span>
              <span
                className="outline-marker-delete"
                role="button"
                tabIndex={0}
                aria-label={`Delete beat ${range.label}`}
                onClick={(event) => deleteBeatFromOutline(range.id, event)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') deleteBeatFromOutline(range.id, event);
                }}
              >
                <Trash2 size={10} />
              </span>
            </button>
          ))}
        </div>

        <div className="outline-lane-strip outline-lane-strip--scenes" onDoubleClick={(event) => addBeatFromLane(event, pageCount, addBeatAt, updateBeat, setPanel)}>
          {scenes.map((scene) => (
            <button
              key={scene.element.id}
              className={scene.element.id === selectedElementId ? 'outline-beat outline-beat--scene is-active' : 'outline-beat outline-beat--scene'}
              style={sceneAnchorStyle(scene.page, pageCount, colorForPage(scene.page, actRanges))}
              onClick={() => setSelectedElement(scene.element.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setSelectedElement(scene.element.id);
              }}
              {...previewHandlers({
                title: scene.element.text || `Scene ${scene.index + 1}`,
                meta: `pg. ${scene.page}`,
                body: scene.summary || 'No scene summary yet.',
                color: colorForPage(scene.page, actRanges)
              })}
            >
              <Film size={12} />
              <span className="outline-marker-label">{scene.element.text || `Scene ${scene.index + 1}`}</span>
            </button>
          ))}
        </div>

        <div className="outline-page-ruler">
          {pageNumbers.map((page) => (
            <span key={page} style={{ left: `${leftForPage(page, pageCount)}%` }}>
              {page}
            </span>
          ))}
        </div>

        <div className={expanded ? 'outline-script-lane is-expanded' : 'outline-script-lane'}>
          {scenes.map((scene) => (
            <button
              key={scene.element.id}
              className={scene.element.id === selectedElementId ? 'outline-scene is-active' : 'outline-scene'}
              style={sceneAnchorStyle(scene.page, pageCount, colorForPage(scene.page, actRanges))}
              onClick={() => setSelectedElement(scene.element.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setSelectedElement(scene.element.id);
              }}
            >
              <Film size={12} />
              <span>{scene.element.text || `Scene ${scene.index + 1}`}</span>
              <small>pg. {scene.page}</small>
              {expanded && <em>{scene.summary || 'No scene summary yet.'}</em>}
            </button>
          ))}
        </div>
      </div>

      {actEditor && (
        <form className="outline-act-popover" style={{ '--act-popover-left': `${actEditor.leftPct}%` } as React.CSSProperties} onSubmit={saveActEditor}>
          <div className="outline-act-popover__header">
            <strong>{actEditor.rangeId ? 'Edit act' : 'New act'}</strong>
            <button type="button" className="icon-button" aria-label="Close act editor" onClick={() => setActEditor(undefined)}>
              <X size={14} />
            </button>
          </div>

          <label>
            <span>Title</span>
            <input autoFocus value={actEditor.label} onChange={(event) => setActEditor((current) => (current ? { ...current, label: event.target.value } : current))} />
          </label>

          <div className="outline-act-popover__grid">
            <label>
              <span>Start pg.</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={actEditor.startPage}
                onChange={(event) => setActEditor((current) => (current ? { ...current, startPage: Number(event.target.value) || 1 } : current))}
              />
            </label>
            <label>
              <span>End pg.</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={actEditor.endPage}
                onChange={(event) => setActEditor((current) => (current ? { ...current, endPage: Number(event.target.value) || current.startPage } : current))}
              />
            </label>
            <label>
              <span>Color</span>
              <input type="color" value={actEditor.color} onChange={(event) => setActEditor((current) => (current ? { ...current, color: event.target.value } : current))} />
            </label>
          </div>

          <div className="outline-act-popover__swatches" aria-label="Act colors">
            {STRUCTURE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={color.toLowerCase() === actEditor.color.toLowerCase() ? 'is-active' : ''}
                style={{ '--swatch-color': color } as React.CSSProperties}
                aria-label={`Use act color ${color}`}
                onClick={() => setActEditor((current) => (current ? { ...current, color } : current))}
              />
            ))}
          </div>

          <label>
            <span>Purpose</span>
            <textarea
              rows={3}
              placeholder="Central turn, pressure, promise, reversal..."
              value={actEditor.summary}
              onChange={(event) => setActEditor((current) => (current ? { ...current, summary: event.target.value } : current))}
            />
          </label>

          <div className="outline-act-popover__actions">
            {actEditor.rangeId && (
              <button type="button" className="ghost-button danger" onClick={removeAct}>
                <Trash2 size={13} />
                Remove
              </button>
            )}
            <button type="button" className="ghost-button" onClick={() => setActEditor(undefined)}>
              Cancel
            </button>
            <button type="submit">{actEditor.rangeId ? 'Update act' : 'Create act'}</button>
          </div>
        </form>
      )}
      {floatingPreview && (
        <div
          className="outline-floating-preview"
          style={{
            '--outline-color': floatingPreview.color,
            left: floatingPreview.left,
            top: floatingPreview.top
          } as React.CSSProperties}
          aria-hidden="true"
        >
          <span>{floatingPreview.title}</span>
          <small>{floatingPreview.meta}</small>
          <em>{floatingPreview.body}</em>
        </div>
      )}
    </section>
  );
}

function resolveFloatingPreview(preview: Omit<FloatingPreview, 'left' | 'top'>, element: HTMLElement): FloatingPreview {
  const rect = element.getBoundingClientRect();
  const width = 278;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
  const top = Math.max(72, Math.min(window.innerHeight - 170, rect.bottom + 8));
  return {
    ...preview,
    left,
    top
  };
}

function buildPageMap(elements: ScriptElement[]): Map<string, number> {
  const pageMap = new Map<string, number>();
  let weightedLines = 0;

  elements.forEach((element) => {
    pageMap.set(element.id, Math.max(1, Math.ceil(weightedLines / 55)));
    weightedLines += estimateElementLines(element);
  });

  return pageMap;
}

function buildSceneEntries(elements: ScriptElement[], pageMap: Map<string, number>): SceneEntry[] {
  const scenes = elements
    .map((element, index) => ({ element, index }))
    .filter((entry) => entry.element.type === 'scene-heading');

  return scenes.map((entry, sceneIndex) => {
    const next = scenes[sceneIndex + 1];
    const page = pageMap.get(entry.element.id) ?? 1;
    const nextPage = next ? Math.max(page + 1, pageMap.get(next.element.id) ?? page + 1) : page + 2;
    return {
      ...entry,
      page,
      nextPage,
      summary: summarizeScene(elements, entry.index, next?.index ?? elements.length)
    };
  });
}

function resolvePageCount(document: ScriptDocument, pageMap: Map<string, number>, scenes: SceneEntry[]): number {
  const scriptPages = estimatePageCount(document.elements);
  const sceneMax = scenes.reduce((max, scene) => Math.max(max, scene.nextPage - 1), 1);
  const beatMax = document.beats.reduce((max, beat) => {
    if (!hasOutlinePage(beat)) return max;
    const start = beatStartPage(beat, pageMap);
    return Math.max(max, start + Math.max(1, beat.outlinePageSpan ?? 6) - 1);
  }, 1);
  const actMax = document.structureRanges.reduce((max, range) => {
    if (!range.visible || range.kind !== 'act') return max;
    return Math.max(max, range.endPage ?? pageMap.get(range.endElementId) ?? 1);
  }, 1);

  return Math.max(1, scriptPages, sceneMax, beatMax, actMax);
}

function buildActRanges(document: ScriptDocument, pageMap: Map<string, number>, pageCount: number): MapRange[] {
  const ranges = document.structureRanges
    .filter((range) => range.visible && range.kind === 'act')
    .map((range) => {
      const startPage = range.startPage ?? pageMap.get(range.startElementId) ?? 1;
      const endPage = range.endPage ?? pageMap.get(range.endElementId) ?? pageCount;
      return {
        id: range.id,
        sourceRangeId: range.id,
        label: range.label || 'Act',
        color: range.color,
        summary: range.summary,
        startPage,
        endPage: Math.max(startPage, endPage)
      };
    })
    .sort((first, second) => first.startPage - second.startPage);

  if (ranges.length) return ranges;

  const actOneEnd = Math.max(1, Math.round(pageCount * 0.25));
  const actTwoEnd = Math.max(actOneEnd + 1, Math.round(pageCount * 0.75));
  return [
    { id: 'act-one', label: 'ACT ONE', color: '#91c8b7', summary: 'Suggested first-act setup range.', startPage: 1, endPage: actOneEnd },
    { id: 'act-two', label: 'ACT TWO', color: '#6ca8e7', summary: 'Suggested second-act escalation range.', startPage: actOneEnd + 1, endPage: actTwoEnd },
    { id: 'act-three', label: 'ACT THREE', color: '#8ea0cc', summary: 'Suggested final-act resolution range.', startPage: actTwoEnd + 1, endPage: pageCount }
  ];
}

function buildBeatRanges(beats: Beat[], pageMap: Map<string, number>, pageCount: number): MapRange[] {
  return beats
    .filter(hasOutlinePage)
    .map((beat) => {
      const startPage = beatStartPage(beat, pageMap);
      return {
        id: beat.id,
        label: beat.title || 'Untitled beat',
        color: beat.color,
        summary: beat.body,
        startPage,
        endPage: Math.min(pageCount, startPage + Math.max(1, beat.outlinePageSpan ?? 6) - 1)
      };
    })
    .sort((first, second) => first.startPage - second.startPage);
}

function buildPageNumbers(pageCount: number): number[] {
  const interval = pageCount <= 24 ? 1 : pageCount <= 70 ? 5 : pageCount <= 160 ? 10 : 20;
  const pages = new Set<number>([1, pageCount]);
  for (let page = interval; page < pageCount; page += interval) pages.add(page);
  return Array.from(pages).sort((first, second) => first - second);
}

function beatStartPage(beat: Beat, pageMap: Map<string, number>): number {
  return Math.max(1, beat.outlineStartPage ?? (beat.linkedElementId ? pageMap.get(beat.linkedElementId) ?? 1 : 1));
}

function hasOutlinePage(beat: Beat): boolean {
  return Boolean((beat.outlineStartPage && beat.outlineStartPage > 0) || beat.linkedElementId);
}

function summarizeScene(elements: ScriptElement[], startIndex: number, endIndex: number): string {
  const body = elements
    .slice(startIndex + 1, endIndex)
    .filter((element) => element.type !== 'transition')
    .map((element) => element.text.trim())
    .filter(Boolean)
    .join(' ');

  return body.length > 112 ? `${body.slice(0, 109).trimEnd()}...` : body;
}

function estimateElementLines(element: ScriptElement): number {
  if (element.type === 'page-break') return 55;
  const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
  const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthFor(element.type)));
  const typeWeight = element.type === 'dialogue' ? 1.2 : element.type === 'scene-heading' ? 1.4 : 1;
  return Math.max(hardLines, softLines) * typeWeight;
}

function sceneAnchorStyle(page: number, pageCount: number, color: string): React.CSSProperties {
  return {
    '--outline-color': color,
    '--scene-color': color,
    left: `${leftForPage(page, pageCount)}%`,
    width: `${Math.max(3.2, Math.min(7, 100 / Math.max(1, pageCount)))}%`
  } as React.CSSProperties;
}

function rangeStyle(startPage: number, endPage: number, pageCount: number, color: string): React.CSSProperties {
  return {
    '--outline-color': color,
    '--scene-color': color,
    left: `${leftForPage(startPage, pageCount)}%`,
    width: `${widthForPages(startPage, endPage, pageCount)}%`
  } as React.CSSProperties;
}

function colorForPage(page: number, actRanges: MapRange[]): string {
  const containing = actRanges.find((range) => page >= range.startPage && page <= range.endPage);
  return containing?.color ?? '#55b8c7';
}

function leftForPage(page: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return Math.max(0, Math.min(100, ((page - 1) / pageCount) * 100));
}

function widthForPages(startPage: number, endPage: number, pageCount: number): number {
  const span = Math.max(1, endPage - startPage + 1);
  return Math.max(2.8, Math.min(100, (span / Math.max(1, pageCount)) * 100));
}

function defaultActSpan(pageCount: number, actNumber: number): number {
  if (pageCount <= 12) return Math.max(1, Math.ceil(pageCount / Math.max(3, actNumber)));
  return Math.max(4, Math.round(pageCount / Math.max(3, actNumber + 1)));
}

function clampPage(page: number, pageCount: number): number {
  return Math.max(1, Math.min(pageCount, Math.round(page)));
}

function elementIdForOutlinePage(elements: ScriptElement[], pageMap: Map<string, number>, page: number, mode: 'start' | 'end'): string | undefined {
  if (!elements.length) return undefined;
  const entries = elements.map((element) => ({ element, page: pageMap.get(element.id) ?? 1 }));

  if (mode === 'start') {
    return entries.find((entry) => entry.page >= page)?.element.id ?? entries[entries.length - 1]?.element.id;
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].page <= page) return entries[index].element.id;
  }

  return entries[0]?.element.id;
}

function addBeatFromLane(
  event: React.MouseEvent<HTMLDivElement>,
  pageCount: number,
  addBeatAt: (point?: { x: number; y: number }) => string,
  updateBeat: (beat: Beat) => void,
  setPanel: (panel: 'beats' | 'characters' | 'stats' | 'production' | 'studio' | 'shortcuts' | 'settings') => void
): void {
  if (event.target !== event.currentTarget) return;
  const page = pageFromLaneEvent(event, pageCount);
  const id = addBeatAt();
  const beat = useWorkspace.getState().document.beats.find((item) => item.id === id);
  if (beat) {
    updateBeat({
      ...beat,
      title: `Beat pg. ${page}`,
      outlineStartPage: page,
      outlinePageSpan: 4
    });
  }
  setPanel('beats');
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('scriptpilot:center-beat', { detail: { beatId: id } })), 0);
}

function pageFromLaneEvent(event: React.MouseEvent<HTMLElement>, pageCount: number): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  return Math.max(1, Math.min(pageCount, Math.round(ratio * pageCount) + 1));
}

function pageFromClientX(clientX: number, lane: HTMLElement, pageCount: number): number {
  const rect = lane.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  return Math.max(1, Math.min(pageCount, Math.round(ratio * pageCount) + 1));
}
