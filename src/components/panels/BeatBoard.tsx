import { useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { Crosshair, Image as ImageIcon, Maximize2, Mic, Minimize2, PanelRightClose, PanelRightOpen, Plus, Send, Square, Trash2, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import type { Beat } from '@/shared/types';

const DEFAULT_NODE_WIDTH = 360;
const DEFAULT_NODE_HEIGHT = 420;
const MIN_NODE_WIDTH = 280;
const MIN_NODE_HEIGHT = 280;
const MAX_NODE_WIDTH = 680;
const MAX_NODE_HEIGHT = 720;
const BOARD_WIDTH = 1960;
const BOARD_HEIGHT = 1220;
const MIN_ZOOM = 0.24;
const MAX_ZOOM = 2;
const palette = ['#d9a441', '#9f3f45', '#4f8f87', '#536c9f', '#8e6bb8', '#c56f3f', '#6c6f73'];

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface PanState {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

interface ConnectionState {
  fromId: string;
  fromSide: 'left' | 'right';
  x: number;
  y: number;
}

export function BeatBoard() {
  const { document, addBeatAt, updateBeat, deleteBeat, linkBeats, unlinkBeatSide, sendBeatToScript, beatBoardMode, setBeatBoardMode, setWarning } = useWorkspace();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [newBeatId, setNewBeatId] = useState<string | null>(null);
  const [recordingBeatId, setRecordingBeatId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [zoom, setZoom] = useState(0.86);

  const beatsById = useMemo(() => new Map(document.beats.map((beat) => [beat.id, beat])), [document.beats]);
  const edges = useMemo(
    () =>
      document.beats
        .map((beat) => ({ from: beat.parentId ? beatsById.get(beat.parentId) : undefined, to: beat }))
        .filter((edge): edge is { from: Beat; to: Beat } => Boolean(edge.from)),
    [beatsById, document.beats]
  );

  function boardPoint(event: React.PointerEvent): { x: number; y: number } {
    const rect = boardRef.current?.getBoundingClientRect();
    const board = boardRef.current;
    return {
      x: (event.clientX - (rect?.left ?? 0) + (board?.scrollLeft ?? 0)) / zoom,
      y: (event.clientY - (rect?.top ?? 0) + (board?.scrollTop ?? 0)) / zoom
    };
  }

  function visibleCenterPoint(): { x: number; y: number } {
    const board = boardRef.current;
    if (!board) return { x: 120, y: 120 };
    return {
      x: (board.scrollLeft + board.clientWidth / 2) / zoom,
      y: (board.scrollTop + board.clientHeight / 2) / zoom
    };
  }

  function startDrag(event: React.PointerEvent<HTMLElement>, beat: Beat) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, button, label')) return;
    const point = boardPoint(event);
    setDragState({ id: beat.id, offsetX: point.x - beat.x, offsetY: point.y - beat.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startResize(event: React.PointerEvent<HTMLElement>, beat: Beat) {
    event.preventDefault();
    event.stopPropagation();
    const point = boardPoint(event);
    setResizeState({
      id: beat.id,
      startX: point.x,
      startY: point.y,
      startWidth: nodeWidth(beat),
      startHeight: nodeHeight(beat)
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.beat-node, input, textarea, select, button, label')) return;
    const board = boardRef.current;
    if (!board) return;
    setPanState({
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: board.scrollLeft,
      scrollTop: board.scrollTop
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent) {
    if (resizeState) {
      const beat = beatsById.get(resizeState.id);
      if (!beat) return;
      const point = boardPoint(event);
      updateBeat({
        ...beat,
        width: clamp(resizeState.startWidth + point.x - resizeState.startX, MIN_NODE_WIDTH, MAX_NODE_WIDTH),
        height: clamp(resizeState.startHeight + point.y - resizeState.startY, MIN_NODE_HEIGHT, MAX_NODE_HEIGHT)
      });
      return;
    }

    if (panState) {
      const board = boardRef.current;
      if (!board) return;
      board.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
      board.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
      return;
    }

    if (connectionState) {
      const point = boardPoint(event);
      setConnectionState({ ...connectionState, x: point.x, y: point.y });
      return;
    }

    if (!dragState) return;
    const beat = beatsById.get(dragState.id);
    if (!beat) return;
    const point = boardPoint(event);
    const width = nodeWidth(beat);
    const height = nodeHeight(beat);
    updateBeat({
      ...beat,
      x: Math.max(16, Math.min(BOARD_WIDTH - width - 16, point.x - dragState.offsetX)),
      y: Math.max(16, Math.min(BOARD_HEIGHT - height - 16, point.y - dragState.offsetY))
    });
  }

  function dropImage(event: React.DragEvent<HTMLElement>, beat: Beat) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    readImage(file, (imageDataUrl) => updateBeat({ ...beat, imageDataUrl, showImage: true }));
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>, beat: Beat) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    readImage(file, (imageDataUrl) => updateBeat({ ...beat, imageDataUrl, showImage: true }));
    event.target.value = '';
  }

  async function startAudioRecording(beat: Beat) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setWarning('Audio recording is not available in this environment.');
      return;
    }

    if (recordingBeatId) stopAudioRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      audioStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        readAudio(blob, (audioDataUrl) => {
          updateBeat({
            ...beat,
            audioDataUrl,
            audioName: `${beat.title || 'Beat'} audio note`,
            audioRecordedAt: new Date().toISOString(),
            showAudio: true
          });
        });
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        recorderRef.current = null;
        audioChunksRef.current = [];
        setRecordingBeatId(null);
      });
      recorder.start();
      setRecordingBeatId(beat.id);
      setRecordingSeconds(0);
    } catch (error) {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      recorderRef.current = null;
      setWarning(error instanceof Error ? `Microphone recording could not start: ${error.message}` : 'Microphone permission was blocked or unavailable.');
      setRecordingBeatId(null);
      setRecordingSeconds(0);
    }
  }

  function stopAudioRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      recorderRef.current = null;
      setRecordingBeatId(null);
      setRecordingSeconds(0);
    }
  }

  function addBeatInView() {
    const center = visibleCenterPoint();
    const id = addBeatAt({ x: center.x - DEFAULT_NODE_WIDTH / 2, y: center.y - DEFAULT_NODE_HEIGHT / 2 });
    flashNewBeat(id);
  }

  function addBeatOnBoard(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.beat-node, input, textarea, select, button, label')) return;
    const point = boardPoint(event as unknown as React.PointerEvent);
    const id = addBeatAt({ x: point.x - DEFAULT_NODE_WIDTH / 2, y: point.y - DEFAULT_NODE_HEIGHT / 2 });
    flashNewBeat(id);
  }

  function centerNodes() {
    const board = boardRef.current;
    if (!board || !document.beats.length) return;
    const bounds = document.beats.reduce(
      (box, beat) => ({
        left: Math.min(box.left, beat.x),
        top: Math.min(box.top, beat.y),
        right: Math.max(box.right, beat.x + nodeWidth(beat)),
        bottom: Math.max(box.bottom, beat.y + nodeHeight(beat))
      }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    );
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    board.scrollTo({
      left: Math.max(0, centerX * zoom - board.clientWidth / 2),
      top: Math.max(0, centerY * zoom - board.clientHeight / 2),
      behavior: 'smooth'
    });
  }

  function centerBeat(beatId: string) {
    const board = boardRef.current;
    const beat = beatsById.get(beatId);
    if (!board || !beat) return;
    board.scrollTo({
      left: Math.max(0, (beat.x + nodeWidth(beat) / 2) * zoom - board.clientWidth / 2),
      top: Math.max(0, (beat.y + nodeHeight(beat) / 2) * zoom - board.clientHeight / 2),
      behavior: 'smooth'
    });
  }

  function sendBeat(beat: Beat) {
    if (!beat.outlineStartPage || beat.outlineStartPage <= 0) {
      setWarning('Specify a page number on this beat before sending it to the script.');
      return;
    }
    sendBeatToScript(beat.id);
  }

  function deleteBeatNode(beat: Beat) {
    const title = beat.title.trim() || 'Untitled beat';
    const confirmed = window.confirm(`Delete "${title}" from the beat board and outline?`);
    if (!confirmed) return;
    if (recordingBeatId === beat.id) stopAudioRecording();
    setDragState(null);
    setResizeState(null);
    setConnectionState((current) => (current?.fromId === beat.id ? null : current));
    deleteBeat(beat.id);
  }

  function startConnection(event: React.PointerEvent<HTMLButtonElement>, beat: Beat, side: 'left' | 'right') {
    event.preventDefault();
    event.stopPropagation();
    const hasSideConnection = side === 'left' ? Boolean(beat.parentId) : document.beats.some((item) => item.parentId === beat.id);
    if (hasSideConnection) unlinkBeatSide(beat.id, side);
    setConnectionState({
      fromId: beat.id,
      fromSide: side,
      x: side === 'left' ? beat.x : beat.x + nodeWidth(beat),
      y: beat.y + nodeHeight(beat) / 2
    });
  }

  function finishConnection(event: React.PointerEvent<HTMLButtonElement>, beat: Beat) {
    event.preventDefault();
    event.stopPropagation();
    if (connectionState && connectionState.fromId !== beat.id) {
      if (connectionState.fromSide === 'left') {
        linkBeats(beat.id, connectionState.fromId);
      } else {
        linkBeats(connectionState.fromId, beat.id);
      }
    }
    setConnectionState(null);
  }

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const boardElement = board;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = boardElement.getBoundingClientRect();
      const before = {
        x: (event.clientX - rect.left + boardElement.scrollLeft) / zoom,
        y: (event.clientY - rect.top + boardElement.scrollTop) / zoom
      };
      const nextZoom = clamp(zoom + (event.deltaY < 0 ? 0.08 : -0.08), MIN_ZOOM, MAX_ZOOM);
      setZoom(nextZoom);
      window.requestAnimationFrame(() => {
        boardElement.scrollLeft = Math.max(0, before.x * nextZoom - (event.clientX - rect.left));
        boardElement.scrollTop = Math.max(0, before.y * nextZoom - (event.clientY - rect.top));
      });
    }

    boardElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => boardElement.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  useEffect(() => {
    if (!recordingBeatId) return;
    const interval = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recordingBeatId]);

  useEffect(() => {
    function handleCenterBeat(event: Event) {
      const beatId = (event as CustomEvent<{ beatId?: string }>).detail?.beatId;
      if (beatId) centerBeat(beatId);
    }

    window.addEventListener('scriptpilot:center-beat', handleCenterBeat);
    return () => window.removeEventListener('scriptpilot:center-beat', handleCenterBeat);
  }, [beatsById, zoom]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function flashNewBeat(id: string) {
    setNewBeatId(id);
    window.setTimeout(() => setNewBeatId((current) => (current === id ? null : current)), 760);
  }

  return (
    <section className={`panel beat-panel beat-panel--${beatBoardMode}`}>
      <div className="panel-title">
        <span>Beat Board</span>
        <div className="panel-actions">
          <button
            title={beatBoardMode === 'rail' ? 'Expand beat board panel' : 'Collapse beat board panel'}
            aria-pressed={beatBoardMode !== 'rail'}
            onClick={() => setBeatBoardMode(beatBoardMode === 'rail' ? 'expanded' : 'rail')}
          >
            {beatBoardMode === 'rail' ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
          </button>
          <button
            title={beatBoardMode === 'fullscreen' ? 'Exit beat board fullscreen' : 'Fullscreen beat board'}
            aria-pressed={beatBoardMode === 'fullscreen'}
            onClick={() => setBeatBoardMode(beatBoardMode === 'fullscreen' ? 'expanded' : 'fullscreen')}
          >
            {beatBoardMode === 'fullscreen' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button title="Zoom out" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.08))}>
            <ZoomOut size={15} />
          </button>
          <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.08))}>
            <ZoomIn size={15} />
          </button>
          <button title="Center beat board" onClick={centerNodes}>
            <Crosshair size={15} />
          </button>
          <button title="Add beat" onClick={addBeatInView}>
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="beat-board-shell">
        <div
          ref={boardRef}
          className={panState ? 'beat-board-canvas is-panning' : 'beat-board-canvas'}
          onPointerDown={startPan}
          onPointerMove={moveDrag}
          onPointerUp={() => {
            setDragState(null);
            setResizeState(null);
            setPanState(null);
            setConnectionState(null);
          }}
          onPointerCancel={() => {
            setDragState(null);
            setResizeState(null);
            setPanState(null);
            setConnectionState(null);
          }}
          onDoubleClick={addBeatOnBoard}
        >
          <div className="beat-board-space" style={{ width: BOARD_WIDTH * zoom, height: BOARD_HEIGHT * zoom }}>
            <div className="beat-board-zoom" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${zoom})` }}>
              <svg className="beat-links" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} aria-hidden="true">
                {edges.map(({ from, to }) => (
                  <path
                    key={`${from.id}:${to.id}`}
                    d={linkPath(from.x + nodeWidth(from), from.y + nodeHeight(from) / 2, to.x, to.y + nodeHeight(to) / 2)}
                    style={{ stroke: to.color }}
                  />
                ))}
                {connectionState && (() => {
                  const from = beatsById.get(connectionState.fromId);
                  if (!from) return null;
                  const startX = connectionState.fromSide === 'left' ? from.x : from.x + nodeWidth(from);
                  return (
                    <path
                      className="beat-link-preview"
                      d={linkPath(startX, from.y + nodeHeight(from) / 2, connectionState.x, connectionState.y)}
                      style={{ stroke: from.color }}
                    />
                  );
                })()}
              </svg>
              {document.beats.map((beat) => {
                const width = nodeWidth(beat);
                const height = nodeHeight(beat);
                return (
                  <article
                    key={beat.id}
                    className={`beat-node beat-node--${beat.textStyle ?? 'normal'}${newBeatId === beat.id ? ' is-new' : ''}`}
                    style={{ left: beat.x, top: beat.y, width, height, '--beat-color': beat.color } as React.CSSProperties}
                    onPointerDown={(event) => startDrag(event, beat)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropImage(event, beat)}
                  >
                    <button
                      className="beat-connector beat-connector--left"
                      title={beat.parentId ? 'Drag to disconnect or reconnect this beat from its parent' : 'Drag to connect this beat to a parent'}
                      aria-label="Connect beat from left side"
                      onPointerDown={(event) => startConnection(event, beat, 'left')}
                      onPointerUp={(event) => finishConnection(event, beat)}
                    />
                    <button
                      className="beat-connector beat-connector--right"
                      title={document.beats.some((item) => item.parentId === beat.id) ? 'Drag to disconnect or reconnect child beats' : 'Drag to connect this beat to another beat'}
                      aria-label="Connect beat from right side"
                      onPointerDown={(event) => startConnection(event, beat, 'right')}
                      onPointerUp={(event) => finishConnection(event, beat)}
                    />
                    <div className="beat-node__header">
                      <input aria-label="Beat title" value={beat.title} onChange={(event) => updateBeat({ ...beat, title: event.target.value })} />
                      <button
                        title={beat.outlineStartPage && beat.outlineStartPage > 0 ? 'Send beat to script' : 'Specify a page number before sending'}
                        className={beat.outlineStartPage && beat.outlineStartPage > 0 ? '' : 'is-disabled'}
                        aria-disabled={!(beat.outlineStartPage && beat.outlineStartPage > 0)}
                        onClick={() => sendBeat(beat)}
                      >
                        <Send size={14} />
                      </button>
                      <button className="beat-node__delete" title="Delete beat node" aria-label={`Delete beat node ${beat.title || 'Untitled beat'}`} onClick={() => deleteBeatNode(beat)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {(beat.showBody ?? true) && (
                      <textarea aria-label="Beat body" value={beat.body} onChange={(event) => updateBeat({ ...beat, body: event.target.value })} />
                    )}
                    {(beat.showImage ?? true) && (
                      <label className={beat.imageDataUrl ? 'beat-image has-image' : 'beat-image'}>
                        {beat.imageDataUrl ? (
                          <img src={beat.imageDataUrl} alt="" />
                        ) : (
                          <>
                            <ImageIcon size={16} />
                            <span>Drop image</span>
                          </>
                        )}
                        <input aria-label="Choose beat image" type="file" accept="image/*" onChange={(event) => pickImage(event, beat)} />
                      </label>
                    )}
                    {(beat.showAudio ?? true) && (
                      <div className={`${beat.audioDataUrl ? 'beat-audio has-audio' : 'beat-audio'}${recordingBeatId === beat.id ? ' is-recording' : ''}`}>
                        <div className="beat-audio__label">
                          <Volume2 size={15} />
                          <span>{recordingBeatId === beat.id ? `Recording ${formatRecordTime(recordingSeconds)}` : beat.audioDataUrl ? beat.audioName ?? 'Audio note' : 'Audio note'}</span>
                          {recordingBeatId === beat.id && (
                            <i className="beat-audio__wave" aria-hidden="true">
                              <b />
                              <b />
                              <b />
                              <b />
                            </i>
                          )}
                        </div>
                        {beat.audioDataUrl && <audio controls src={beat.audioDataUrl} />}
                        <div className="beat-audio__actions">
                          {recordingBeatId === beat.id ? (
                            <button className="record-stop" title="Stop recording" onClick={stopAudioRecording}>
                              <Square size={13} />
                              Stop
                            </button>
                          ) : (
                            <button title="Record audio note" onClick={() => startAudioRecording(beat)}>
                              <Mic size={13} />
                              Record
                            </button>
                          )}
                          {beat.audioDataUrl && (
                            <button title="Remove audio note" onClick={() => updateBeat({ ...beat, audioDataUrl: undefined, audioName: undefined, audioRecordedAt: undefined })}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="beat-node__tools">
                      <button
                        title="Headline style"
                        className={beat.textStyle === 'headline' ? 'is-active' : ''}
                        onClick={() => updateBeat({ ...beat, textStyle: beat.textStyle === 'headline' ? 'normal' : 'headline', showBody: beat.textStyle === 'headline' ? true : false })}
                      >
                        H
                      </button>
                      <button
                        title="Large text"
                        className={beat.textStyle === 'large' ? 'is-active' : ''}
                        onClick={() => updateBeat({ ...beat, textStyle: beat.textStyle === 'large' ? 'normal' : 'large' })}
                      >
                        T
                      </button>
                      <button title="Toggle body text" className={(beat.showBody ?? true) ? 'is-active' : ''} onClick={() => updateBeat({ ...beat, showBody: !(beat.showBody ?? true) })}>
                        Text
                      </button>
                      <button title="Toggle image area" className={(beat.showImage ?? true) ? 'is-active' : ''} onClick={() => updateBeat({ ...beat, showImage: !(beat.showImage ?? true) })}>
                        Img
                      </button>
                      <button title="Toggle audio area" className={(beat.showAudio ?? true) ? 'is-active' : ''} onClick={() => updateBeat({ ...beat, showAudio: !(beat.showAudio ?? true) })}>
                        Aud
                      </button>
                      <label className="beat-page-anchor">
                        Pg
                        <input
                          type="number"
                          min={1}
                          value={beat.outlineStartPage ?? ''}
                          placeholder="-"
                          onChange={(event) => {
                            const nextPage = Number(event.target.value);
                            updateBeat({ ...beat, outlineStartPage: Number.isFinite(nextPage) && nextPage > 0 ? nextPage : undefined });
                          }}
                        />
                      </label>
                    </div>
                    <div className="beat-node__footer">
                      <div className="swatches" aria-label="Beat colors">
                        {palette.map((color) => (
                          <button
                            key={color}
                            title={`Set beat color ${color}`}
                            className={beat.color === color ? 'is-active' : ''}
                            style={{ '--swatch': color } as React.CSSProperties}
                            onClick={() => updateBeat({ ...beat, color })}
                          />
                        ))}
                      </div>
                    </div>
                    <button className="beat-resize-handle" title="Resize beat" aria-label="Resize beat" onPointerDown={(event) => startResize(event, beat)} />
                  </article>
                );
              })}
              {!document.beats.length && (
                <div className="beat-empty">
                  <strong>Map the story visually</strong>
                  <span>Add a beat to start building acts, reversals, and set pieces.</span>
                  <button onClick={addBeatInView}>
                    <Plus size={16} />
                    Add beat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function readImage(file: File, callback: (imageDataUrl: string) => void): void {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') callback(reader.result);
  });
  reader.readAsDataURL(file);
}

function readAudio(blob: Blob, callback: (audioDataUrl: string) => void): void {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') callback(reader.result);
  });
  reader.readAsDataURL(blob);
}

function preferredAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus'
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const distance = Math.max(80, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`;
}

function nodeWidth(beat: Beat): number {
  return clamp(beat.width ?? DEFAULT_NODE_WIDTH, MIN_NODE_WIDTH, MAX_NODE_WIDTH);
}

function nodeHeight(beat: Beat): number {
  return clamp(beat.height ?? DEFAULT_NODE_HEIGHT, MIN_NODE_HEIGHT, MAX_NODE_HEIGHT);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatRecordTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
