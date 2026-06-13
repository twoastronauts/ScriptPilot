import { Boxes, Film, Flag } from 'lucide-react';
import { useMemo } from 'react';
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
  label: string;
  color: string;
  startPage: number;
  endPage: number;
}

export function OutlineEditorStrip() {
  const { document, outlineHeight, selectedElementId, setSelectedElement, setPanel, addBeatAt, updateBeat, addStructureRangeAtPage } = useWorkspace();

  const pageMap = useMemo(() => buildPageMap(document.elements), [document.elements]);
  const scenes = useMemo(() => buildSceneEntries(document.elements, pageMap), [document.elements, pageMap]);
  const pageCount = useMemo(() => resolvePageCount(document, pageMap, scenes), [document, pageMap, scenes]);
  const pageNumbers = useMemo(() => buildPageNumbers(pageCount), [pageCount]);
  const actRanges = useMemo(() => buildActRanges(document, pageMap, pageCount), [document, pageMap, pageCount]);
  const beatRanges = useMemo(() => buildBeatRanges(document.beats, pageMap, pageCount), [document.beats, pageMap, pageCount]);
  const expanded = outlineHeight >= EXPANDED_SUMMARY_HEIGHT;
  const selectedPage = selectedElementId ? pageMap.get(selectedElementId) ?? 1 : 1;

  return (
    <section className={expanded ? 'outline-editor-strip is-expanded' : 'outline-editor-strip'} aria-label="Outline editor">
      <div className="outline-editor-labels">
        <strong>Outline</strong>
        <span>Acts</span>
        <span>Sequences</span>
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

        <div className="outline-lane-strip outline-lane-strip--acts" onDoubleClick={(event) => addActFromLane(event, pageCount, addStructureRangeAtPage)}>
          {actRanges.map((range) => (
            <button
              key={range.id}
              className="outline-beat outline-beat--act"
              style={rangeStyle(range.startPage, range.endPage, pageCount, range.color)}
              title={`${range.label}: pages ${range.startPage}-${range.endPage}`}
              onDoubleClick={(event) => {
                event.stopPropagation();
                const targetRange = document.structureRanges.find((item) => item.id === range.id);
                if (targetRange) setSelectedElement(targetRange.startElementId);
              }}
            >
              <Flag size={12} />
              <span>{range.label}</span>
            </button>
          ))}
        </div>

        <div className="outline-lane-strip outline-lane-strip--sequences" onDoubleClick={(event) => addBeatFromLane(event, pageCount, addBeatAt, updateBeat, setPanel)}>
          {beatRanges.map((range) => (
            <button
              key={range.id}
              className="outline-beat"
              style={rangeStyle(range.startPage, range.endPage, pageCount, range.color)}
              title={`${range.label}: pages ${range.startPage}-${range.endPage}`}
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
            >
              <Boxes size={12} />
              <span>{range.label}</span>
            </button>
          ))}
        </div>

        <div className="outline-lane-strip outline-lane-strip--scenes" onDoubleClick={(event) => addBeatFromLane(event, pageCount, addBeatAt, updateBeat, setPanel)}>
          {scenes.map((scene) => (
            <button
              key={scene.element.id}
              className={scene.element.id === selectedElementId ? 'outline-beat outline-beat--scene is-active' : 'outline-beat outline-beat--scene'}
              style={rangeStyle(scene.page, scene.nextPage - 1, pageCount, document.structureRanges[scene.index % Math.max(1, document.structureRanges.length)]?.color ?? '#55b8c7')}
              title={`${scene.element.text || `Scene ${scene.index + 1}`}: page ${scene.page}`}
              onClick={() => setSelectedElement(scene.element.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                setSelectedElement(scene.element.id);
              }}
            >
              <Film size={12} />
              <span>{scene.element.text || `Scene ${scene.index + 1}`}</span>
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
              title={`${scene.element.text} - pg. ${scene.page}`}
              style={rangeStyle(scene.page, scene.nextPage - 1, pageCount, document.structureRanges[scene.index % Math.max(1, document.structureRanges.length)]?.color ?? '#55b8c7')}
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
    </section>
  );
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

  return Math.max(1, scriptPages, sceneMax, beatMax);
}

function buildActRanges(document: ScriptDocument, pageMap: Map<string, number>, pageCount: number): MapRange[] {
  const ranges = document.structureRanges
    .filter((range) => range.visible && range.kind === 'act')
    .map((range) => {
      const startPage = pageMap.get(range.startElementId) ?? 1;
      const endPage = pageMap.get(range.endElementId) ?? pageCount;
      return {
        id: range.id,
        label: range.label || 'Act',
        color: range.color,
        startPage,
        endPage: Math.max(startPage, endPage)
      };
    });

  if (ranges.length) return ranges;

  const actOneEnd = Math.max(1, Math.round(pageCount * 0.25));
  const actTwoEnd = Math.max(actOneEnd + 1, Math.round(pageCount * 0.75));
  return [
    { id: 'act-one', label: 'ACT ONE', color: '#91c8b7', startPage: 1, endPage: actOneEnd },
    { id: 'act-two', label: 'ACT TWO', color: '#6ca8e7', startPage: actOneEnd + 1, endPage: actTwoEnd },
    { id: 'act-three', label: 'ACT THREE', color: '#8ea0cc', startPage: actTwoEnd + 1, endPage: pageCount }
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
  const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
  const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthFor(element.type)));
  const typeWeight = element.type === 'dialogue' ? 1.2 : element.type === 'scene-heading' ? 1.4 : 1;
  return Math.max(hardLines, softLines) * typeWeight;
}

function rangeStyle(startPage: number, endPage: number, pageCount: number, color: string): React.CSSProperties {
  return {
    '--outline-color': color,
    '--scene-color': color,
    left: `${leftForPage(startPage, pageCount)}%`,
    width: `${widthForPages(startPage, endPage, pageCount)}%`
  } as React.CSSProperties;
}

function leftForPage(page: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return Math.max(0, Math.min(100, ((page - 1) / pageCount) * 100));
}

function widthForPages(startPage: number, endPage: number, pageCount: number): number {
  const span = Math.max(1, endPage - startPage + 1);
  return Math.max(2.8, Math.min(100, (span / Math.max(1, pageCount)) * 100));
}

function addActFromLane(event: React.MouseEvent<HTMLDivElement>, pageCount: number, addStructureRangeAtPage: (page: number, kind?: 'act' | 'sequence' | 'scene' | 'custom') => string): void {
  if (event.target !== event.currentTarget) return;
  const page = pageFromLaneEvent(event, pageCount);
  addStructureRangeAtPage(page, 'act');
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
