import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  createDefaultCharacterArc,
  createDefaultRevisions,
  createDefaultSettings,
  createDefaultTitlePageStyles,
  createDocumentFromPlainText,
  createScriptElement
} from '@/shared/defaultDocument';
import { createDraftVersion as buildDraftVersion, createRevisionMemo as buildRevisionMemo } from '@/shared/formattingV2';
import { estimatePageCount, lineWidthFor, normalizeCharacterName } from '@/shared/screenplay';
import { computeWritingStats } from '@/shared/stats';
import type { BackupInfo } from '@/shared/ipc';
import type {
  Beat,
  CharacterArc,
  CharacterProfile,
  CollabParticipant,
  CollabSession,
  ProductionTag,
  ProjectSettings,
  RevisionSet,
  ScriptDocument,
  ScriptElement,
  ScriptElementType,
  StructureRange,
  TextStyle,
  TitlePage,
  ViewMode
} from '@/shared/types';

interface SprintBaseline {
  words: number;
  pages: number;
}

type RightPanel = 'beats' | 'characters' | 'assistant' | 'stats' | 'production' | 'studio' | 'shortcuts' | 'collaboration' | 'settings';
export type BeatBoardMode = 'rail' | 'expanded' | 'fullscreen';
type WorkspaceView = 'home' | 'editor';

interface WorkspaceState {
  document: ScriptDocument;
  projectPath?: string;
  fdxPath?: string;
  dirty: boolean;
  selectedElementId?: string;
  workspaceView: WorkspaceView;
  activeRightPanel: RightPanel;
  beatBoardMode: BeatBoardMode;
  showTitlePage: boolean;
  rightRailCollapsed: boolean;
  navigatorWidth: number;
  rightRailWidth: number;
  outlineHeight: number;
  sprintStartedAt?: string;
  sprintBaseline?: SprintBaseline;
  lastWarning?: string;
  lastSavedAt?: string;
  lastBackupAt?: string;
  lastBackupPath?: string;
  backupDirectory?: string;
  collabSession?: CollabSession;
  collabParticipants: CollabParticipant[];
  setDocument: (document: ScriptDocument, paths?: { projectPath?: string; fdxPath?: string }) => void;
  applyRemoteDocument: (document: ScriptDocument) => void;
  setElements: (elements: ScriptElement[]) => void;
  setSelectedElement: (id?: string) => void;
  setProjectPath: (path?: string) => void;
  setFdxPath: (path?: string) => void;
  finishProjectSave: (document: ScriptDocument, path?: string) => void;
  finishFdxSave: (document: ScriptDocument, path?: string) => void;
  recordBackup: (backup: BackupInfo) => void;
  setBackupDirectory: (path?: string) => void;
  setCollabSession: (session?: CollabSession) => void;
  setCollabStatus: (status: CollabSession['status']) => void;
  setCollabParticipants: (participants: CollabParticipant[]) => void;
  markClean: () => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setPanel: (panel: RightPanel) => void;
  setBeatBoardMode: (mode: BeatBoardMode) => void;
  toggleTitlePage: () => void;
  toggleRightRailCollapsed: () => void;
  setRightRailCollapsed: (collapsed: boolean) => void;
  setNavigatorWidth: (width: number) => void;
  setRightRailWidth: (width: number) => void;
  setOutlineHeight: (height: number) => void;
  setViewMode: (viewMode: ViewMode) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  updateTitlePage: (patch: Partial<TitlePage>) => void;
  updateElementStyle: (elementId: string, patch: Partial<TextStyle>) => void;
  updateSelectedElementStyle: (patch: Partial<TextStyle>) => void;
  updateTitlePageStyle: (field: string, patch: Partial<TextStyle>) => void;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
  toggleTypewriterSounds: () => void;
  addBeat: () => string;
  addBeatAt: (point?: { x: number; y: number }) => string;
  updateBeat: (beat: Beat) => void;
  deleteBeat: (beatId: string) => void;
  linkBeats: (fromBeatId: string, toBeatId: string) => void;
  unlinkBeatSide: (beatId: string, side: 'left' | 'right') => void;
  sendBeatToScript: (beatId: string) => void;
  addStructureRangeAtPage: (page: number, kind?: StructureRange['kind']) => string;
  updateStructureRange: (rangeId: string, patch: Partial<StructureRange>) => void;
  deleteStructureRange: (rangeId: string) => void;
  addCharacter: () => string;
  updateCharacter: (characterId: string, patch: Partial<CharacterProfile>) => void;
  updateCharacterArc: (characterId: string, patch: Partial<CharacterArc>) => void;
  renameCharacter: (characterId: string, nextName: string, applyToScript: boolean) => void;
  setElementType: (elementId: string, type: ScriptElementType) => void;
  setSelectedElementType: (type: ScriptElementType) => void;
  addProductionTagToSelected: (tag: Omit<ProductionTag, 'id'>) => void;
  addScriptNoteToElement: (elementId: string, text: string) => void;
  addScriptNoteToSelected: (text: string) => void;
  toggleRevisionOnSelected: (color: string) => void;
  setRevisionMode: (enabled: boolean) => void;
  setActiveRevisionSet: (revisionId: string) => void;
  updateRevisionSet: (revisionId: string, patch: Partial<RevisionSet>) => void;
  markElementRevised: (elementId: string) => void;
  markSelectedRevised: () => void;
  clearSelectedRevision: () => void;
  toggleOmitSelected: () => void;
  captureDraftVersion: (label?: string, note?: string) => void;
  createRevisionMemo: () => void;
  startSprint: () => void;
  stopSprint: () => void;
  setWarning: (warning?: string) => void;
}

const BOARD_WIDTH = 1960;
const BOARD_HEIGHT = 1220;
const DEFAULT_BEAT_WIDTH = 360;
const DEFAULT_BEAT_HEIGHT = 420;
const EDITOR_LINES_PER_PAGE = 44;

function touch(document: ScriptDocument): ScriptDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

function normalizeSettings(settings: ProjectSettings): ProjectSettings {
  const defaults = createDefaultSettings();
  const normalized = { ...defaults, ...settings };
  if (settings.typewriterVolume === undefined && settings.typewriterSounds === false) normalized.typewriterVolume = 0;
  if (settings.typewriterBellVolume === undefined) normalized.typewriterBellVolume = normalized.typewriterVolume || defaults.typewriterBellVolume;
  return normalized;
}

function normalizeRevisions(revisions: RevisionSet[] = []): RevisionSet[] {
  const defaults = createDefaultRevisions();
  const source = revisions.length ? revisions : defaults;
  const hasActiveRevision = source.some((revision) => revision.active);

  return source.map((revision, index) => {
    const fallback = defaults[index] ?? defaults[defaults.length - 1];
    const color = revision.color ?? fallback.color;
    return {
      ...fallback,
      ...revision,
      color,
      textColor: revision.textColor ?? color,
      pageColor: revision.pageColor ?? color,
      mark: revision.mark ?? '*',
      active: hasActiveRevision ? Boolean(revision.active) : index === Math.min(1, source.length - 1)
    };
  });
}

function normalizeTitlePage(titlePage: TitlePage, fallbackTitle: string, fallbackAuthor: string): TitlePage {
  return {
    ...titlePage,
    title: titlePage.title ?? fallbackTitle,
    author: titlePage.author ?? fallbackAuthor,
    byline: titlePage.byline ?? 'Written by',
    styles: { ...createDefaultTitlePageStyles(), ...(titlePage.styles ?? {}) },
    fields: titlePage.fields ?? {}
  };
}

function normalizeDocument(document: ScriptDocument): ScriptDocument {
  return {
    ...document,
    titlePage: normalizeTitlePage(document.titlePage, document.title, document.author),
    settings: normalizeSettings(document.settings),
    revisions: normalizeRevisions(document.revisions),
    beats: (document.beats ?? []).map(normalizeBeat),
    characters: (document.characters ?? []).map(normalizeCharacter),
    sceneIntents: document.sceneIntents ?? [],
    draftVersions: document.draftVersions ?? [],
    revisionMemos: document.revisionMemos ?? [],
    collabRooms: document.collabRooms ?? [],
    exportPackages: document.exportPackages ?? []
  };
}

function normalizeBeat(beat: Beat): Beat {
  return {
    ...beat,
    width: beat.width ?? 360,
    height: beat.height ?? 420,
    textStyle: beat.textStyle ?? 'normal',
    showBody: beat.showBody ?? true,
    showImage: beat.showImage ?? true,
    showAudio: beat.showAudio ?? true,
    payoffBeatIds: beat.payoffBeatIds ?? [],
    scriptSyncState: beat.scriptSyncState ?? (beat.linkedElementId ? 'linked' : 'unlinked')
  };
}

function normalizeCharacter(character: CharacterProfile): CharacterProfile {
  return {
    ...character,
    aliases: character.aliases ?? [],
    description: character.description ?? '',
    demographics: character.demographics ?? '',
    arc: { ...createDefaultCharacterArc(), ...(character.arc ?? {}) }
  };
}

function normalizeTextStyle(style: TextStyle): TextStyle | undefined {
  const normalized = Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== '')) as TextStyle;
  return Object.keys(normalized).length ? normalized : undefined;
}

function getActiveRevision(revisions: RevisionSet[]): RevisionSet | undefined {
  return revisions.find((revision) => revision.active) ?? revisions[1] ?? revisions[0];
}

function markElementRevision(element: ScriptElement, revision: RevisionSet, timestamp = new Date().toISOString()): ScriptElement {
  return {
    ...element,
    revisionColor: revision.color,
    revisionSetId: revision.id,
    revisionMark: revision.mark ?? '*',
    updatedAt: timestamp
  };
}

function applyRevisionMode(document: ScriptDocument, elements: ScriptElement[]): ScriptElement[] {
  if (!document.settings.revisionMode) return elements;
  const revision = getActiveRevision(document.revisions);
  if (!revision) return elements;

  const previousById = new Map(document.elements.map((element) => [element.id, element]));
  const timestamp = new Date().toISOString();

  return elements.map((element) => {
    const previous = previousById.get(element.id);
    const changed = !previous || previous.text !== element.text || previous.type !== element.type;
    if (!changed || element.revisionColor || element.type === 'page-break') return element;
    return markElementRevision(element, revision, timestamp);
  });
}

function padElementsToPage(elements: ScriptElement[], targetPage: number): ScriptElement[] {
  const padded = [...elements];
  while (estimatePageCount(padded) < targetPage) {
    padded.push(createScriptElement('page-break', ''));
  }
  return padded;
}

function autoPaginateElements(elements: ScriptElement[]): ScriptElement[] {
  const source = elements.filter((element) => !(element.type === 'page-break' && element.generatedPageBreak));
  const paginated: ScriptElement[] = [];
  let pageLines = 0;

  for (const element of source) {
    if (element.type === 'page-break') {
      paginated.push(element);
      pageLines = 0;
      continue;
    }

    const neededLines = Math.max(1, Math.ceil(estimateElementLines(element)));
    if (paginated.length > 0 && pageLines > 0 && pageLines + neededLines > EDITOR_LINES_PER_PAGE) {
      const previous = paginated[paginated.length - 1];
      paginated.push(createGeneratedPageBreak(previous.id));
      pageLines = 0;
    }

    paginated.push(element);
    pageLines += neededLines;
  }

  return paginated;
}

function createGeneratedPageBreak(afterElementId: string): ScriptElement {
  const timestamp = new Date().toISOString();
  return {
    id: `generated-page-break:${afterElementId}`,
    type: 'page-break',
    text: '',
    notes: [],
    productionTags: [],
    generatedPageBreak: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function insertionIndexForPage(elements: ScriptElement[], targetPage: number): number {
  let weightedLines = 0;

  for (let index = 0; index < elements.length; index += 1) {
    const currentPage = Math.max(1, Math.ceil(weightedLines / 55));
    if (currentPage >= targetPage) return index;
    weightedLines += estimateElementLines(elements[index]);
  }

  return elements.length;
}

function estimateElementLines(element: ScriptElement): number {
  if (element.type === 'page-break') return 55;
  const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
  const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthFor(element.type)));
  const typeWeight = element.type === 'dialogue' ? 1.2 : element.type === 'scene-heading' ? 1.4 : 1;
  return Math.max(hardLines, softLines) * typeWeight;
}

function resolveOpenBeatPosition(point: { x: number; y: number }, beats: Beat[]): { x: number; y: number } {
  const candidates = [
    { x: 0, y: 0 },
    { x: 32, y: 32 },
    { x: -32, y: 32 },
    { x: 42, y: -28 },
    { x: -42, y: -28 },
    { x: 76, y: 44 },
    { x: -76, y: 44 },
    { x: 92, y: -62 },
    { x: -92, y: -62 },
    { x: 124, y: 72 },
    { x: -124, y: 72 }
  ];

  for (const candidate of candidates) {
    const x = clamp(point.x + candidate.x, 16, BOARD_WIDTH - DEFAULT_BEAT_WIDTH - 16);
    const y = clamp(point.y + candidate.y, 16, BOARD_HEIGHT - DEFAULT_BEAT_HEIGHT - 16);
    if (!beats.some((beat) => rectanglesOverlap(x, y, DEFAULT_BEAT_WIDTH, DEFAULT_BEAT_HEIGHT, beat.x, beat.y, beat.width ?? DEFAULT_BEAT_WIDTH, beat.height ?? DEFAULT_BEAT_HEIGHT))) {
      return { x, y };
    }
  }

  const offset = beats.length * 34;
  return {
    x: clamp(point.x + offset, 16, BOARD_WIDTH - DEFAULT_BEAT_WIDTH - 16),
    y: clamp(point.y + offset, 16, BOARD_HEIGHT - DEFAULT_BEAT_HEIGHT - 16)
  };
}

function rectanglesOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const overlapArea = overlapX * overlapY;
  const smallerArea = Math.min(aw * ah, bw * bh);
  return smallerArea > 0 && overlapArea / smallerArea > 0.62;
}

function elementIdForPage(elements: ScriptElement[], targetPage: number, mode: 'start' | 'end'): string {
  let weightedLines = 0;
  let fallback = elements[0]?.id ?? '';

  for (const element of elements) {
    const page = Math.max(1, Math.ceil(weightedLines / 55));
    if (mode === 'start' && page >= targetPage) return element.id;
    if (page <= targetPage) fallback = element.id;
    weightedLines += estimateElementLines(element);
    const nextPage = Math.max(1, Math.ceil(weightedLines / 55));
    if (mode === 'end' && nextPage >= targetPage) return element.id;
  }

  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  document: createDocumentFromPlainText('Untitled Script Pilot Script', ''),
  dirty: false,
  workspaceView: 'home',
  activeRightPanel: 'beats',
  beatBoardMode: 'rail',
  showTitlePage: false,
  rightRailCollapsed: false,
  navigatorWidth: 286,
  rightRailWidth: 430,
  outlineHeight: 138,
  collabParticipants: [],
  setDocument: (document, paths) => {
    const normalizedDocument = normalizeDocument(document);
    set({
      document: normalizedDocument,
      projectPath: paths?.projectPath,
      fdxPath: paths?.fdxPath,
      dirty: false,
      lastSavedAt: undefined,
      selectedElementId: normalizedDocument.elements[0]?.id,
      workspaceView: 'editor',
      showTitlePage: false,
      outlineHeight: normalizedDocument.settings.outlineHeight,
      sprintStartedAt: undefined,
      sprintBaseline: undefined
    });
  },
  applyRemoteDocument: (document) =>
    set((state) => {
      const normalizedDocument = normalizeDocument(document);
      return {
        document: normalizedDocument,
        dirty: true,
        selectedElementId: state.selectedElementId && normalizedDocument.elements.some((element) => element.id === state.selectedElementId)
          ? state.selectedElementId
          : normalizedDocument.elements[0]?.id,
        workspaceView: 'editor'
      };
    }),
  setElements: (elements) =>
    set((state) => {
      const document = normalizeDocument(state.document);
      const revisedElements = applyRevisionMode(document, elements);
      const nextElements = document.settings.pageMode === 'pages' ? autoPaginateElements(revisedElements) : revisedElements.filter((element) => !element.generatedPageBreak);
      return {
        document: touch({ ...document, elements: nextElements }),
        dirty: true
      };
    }),
  setSelectedElement: (id) => set({ selectedElementId: id }),
  setProjectPath: (projectPath) => set({ projectPath }),
  setFdxPath: (fdxPath) => set({ fdxPath }),
  finishProjectSave: (document, projectPath) =>
    set((state) => {
      const normalizedDocument = normalizeDocument(document);
      return {
        document: normalizedDocument,
        projectPath,
        fdxPath: state.fdxPath,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
        selectedElementId: state.selectedElementId && normalizedDocument.elements.some((element) => element.id === state.selectedElementId)
          ? state.selectedElementId
          : normalizedDocument.elements[0]?.id,
        workspaceView: 'editor'
      };
    }),
  finishFdxSave: (document, fdxPath) =>
    set((state) => ({
      document: normalizeDocument(document),
      fdxPath,
      projectPath: state.projectPath,
      dirty: false,
      lastSavedAt: new Date().toISOString()
    })),
  recordBackup: (backup) =>
    set({
      lastBackupAt: backup.createdAt,
      lastBackupPath: backup.path,
      backupDirectory: backup.directory
    }),
  setBackupDirectory: (backupDirectory) => set({ backupDirectory }),
  setCollabSession: (collabSession) => set({ collabSession, collabParticipants: collabSession ? get().collabParticipants : [] }),
  setCollabStatus: (status) =>
    set((state) => ({
      collabSession: state.collabSession ? { ...state.collabSession, status, endedAt: status === 'ended' ? new Date().toISOString() : state.collabSession.endedAt } : undefined
    })),
  setCollabParticipants: (collabParticipants) => set({ collabParticipants }),
  markClean: () => set({ dirty: false }),
  setWorkspaceView: (workspaceView) => set({ workspaceView }),
  setPanel: (activeRightPanel) =>
    set((state) => ({
      activeRightPanel,
      rightRailCollapsed: false,
      beatBoardMode: activeRightPanel === 'beats' ? state.beatBoardMode : 'rail'
    })),
  setBeatBoardMode: (beatBoardMode) =>
    set((state) => ({
      beatBoardMode,
      rightRailCollapsed: false,
      activeRightPanel: beatBoardMode === 'rail' ? state.activeRightPanel : 'beats'
    })),
  toggleTitlePage: () => set((state) => ({ showTitlePage: !state.showTitlePage })),
  toggleRightRailCollapsed: () =>
    set((state) => ({
      rightRailCollapsed: !state.rightRailCollapsed,
      beatBoardMode: !state.rightRailCollapsed ? 'rail' : state.beatBoardMode
    })),
  setRightRailCollapsed: (rightRailCollapsed) =>
    set((state) => ({
      rightRailCollapsed,
      beatBoardMode: rightRailCollapsed ? 'rail' : state.beatBoardMode
    })),
  setNavigatorWidth: (navigatorWidth) => set({ navigatorWidth: Math.max(196, Math.min(420, navigatorWidth)) }),
  setRightRailWidth: (rightRailWidth) => set({ rightRailWidth: Math.max(300, Math.min(760, rightRailWidth)) }),
  setOutlineHeight: (outlineHeight) =>
    set((state) => {
      const nextHeight = Math.max(138, Math.min(228, outlineHeight));
      return {
        outlineHeight: nextHeight,
        document: touch({ ...state.document, settings: { ...state.document.settings, outlineHeight: nextHeight } }),
        dirty: true
      };
    }),
  setViewMode: (viewMode) =>
    set((state) => ({
      document: touch({ ...state.document, settings: { ...state.document.settings, viewMode } }),
      dirty: true
    })),
  updateSettings: (patch) =>
    set((state) => {
      const settings = normalizeSettings({ ...state.document.settings, ...patch });
      const elements =
        patch.pageMode === 'pages'
          ? autoPaginateElements(state.document.elements)
          : patch.pageMode === 'continuous'
            ? state.document.elements.filter((element) => !element.generatedPageBreak)
            : state.document.elements;
      return {
        document: touch({ ...state.document, settings, elements }),
        outlineHeight: patch.outlineHeight ?? state.outlineHeight,
        dirty: true
      };
    }),
  updateTitlePage: (patch) =>
    set((state) => {
      const titlePage = {
        ...state.document.titlePage,
        ...patch,
        fields: { ...state.document.titlePage.fields, ...(patch.fields ?? {}) },
        styles: { ...(state.document.titlePage.styles ?? createDefaultTitlePageStyles()), ...(patch.styles ?? {}) }
      };
      const title = patch.title !== undefined ? patch.title : state.document.title;
      const author = patch.author !== undefined ? patch.author : state.document.author;
      return {
        document: touch({ ...state.document, title, author, titlePage }),
        dirty: true
      };
    }),
  updateElementStyle: (elementId, patch) =>
    set((state) => {
      if (!elementId) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === elementId
              ? { ...element, style: normalizeTextStyle({ ...(element.style ?? {}), ...patch }), updatedAt: new Date().toISOString() }
              : element
          )
        }),
        dirty: true
      };
    }),
  updateSelectedElementStyle: (patch) => {
    const elementId = get().selectedElementId;
    if (elementId) get().updateElementStyle(elementId, patch);
  },
  updateTitlePageStyle: (field, patch) =>
    set((state) => {
      const styles = state.document.titlePage.styles ?? createDefaultTitlePageStyles();
      return {
        document: touch({
          ...state.document,
          titlePage: {
            ...state.document.titlePage,
            styles: {
              ...styles,
              [field]: normalizeTextStyle({ ...(styles[field] ?? {}), ...patch }) ?? {}
            }
          }
        }),
        dirty: true
      };
    }),
  toggleFocusMode: () =>
    set((state) => ({
      document: touch({ ...state.document, settings: { ...state.document.settings, focusMode: !state.document.settings.focusMode } }),
      dirty: true
    })),
  toggleTypewriterMode: () =>
    set((state) => ({
      document: touch({
        ...state.document,
        settings: {
          ...state.document.settings,
          typewriterMode: !state.document.settings.typewriterMode,
          typewriterSounds: !state.document.settings.typewriterMode ? true : state.document.settings.typewriterSounds,
          typewriterVolume: !state.document.settings.typewriterMode && state.document.settings.typewriterVolume <= 0 ? 0.65 : state.document.settings.typewriterVolume,
          typewriterBellVolume: !state.document.settings.typewriterMode && state.document.settings.typewriterBellVolume <= 0 ? 0.8 : state.document.settings.typewriterBellVolume
        }
      }),
      dirty: true
    })),
  toggleTypewriterSounds: () =>
    set((state) => ({
      document: touch({
        ...state.document,
        settings: {
          ...state.document.settings,
          typewriterSounds: !state.document.settings.typewriterSounds,
          typewriterVolume: state.document.settings.typewriterSounds ? 0 : Math.max(0.55, state.document.settings.typewriterVolume),
          typewriterBellVolume: state.document.settings.typewriterSounds ? 0 : Math.max(0.65, state.document.settings.typewriterBellVolume)
        }
      }),
      dirty: true
    })),
  addBeat: () => get().addBeatAt(),
  addBeatAt: (point) => {
    const state = get();
    const id = uuid();
    const beatCount = state.document.beats.length;
    const requested = {
      x: point?.x ?? 120 + beatCount * 32,
      y: point?.y ?? 120 + beatCount * 20
    };
    const { x, y } = resolveOpenBeatPosition(requested, state.document.beats);
    set({
      document: touch({
        ...state.document,
        beats: [
          ...state.document.beats,
          {
            id,
            title: 'New Beat',
            body: '',
            color: '#ffe08a',
            x,
            y,
            width: DEFAULT_BEAT_WIDTH,
            height: DEFAULT_BEAT_HEIGHT,
            textStyle: 'normal',
            showBody: true,
            showImage: true,
            showAudio: true,
            act: '',
            sequence: '',
            goal: '',
            conflict: '',
            payoffBeatIds: [],
            scriptSyncState: 'unlinked',
            outlineStartPage: undefined,
            outlinePageSpan: 6
          }
        ]
      }),
      dirty: true
    });
    return id;
  },
  updateBeat: (beat) =>
    set((state) => ({
      document: touch({
        ...state.document,
        beats: state.document.beats.map((item) =>
          item.id === beat.id
            ? normalizeBeat({ ...beat, outlineStartPage: beat.outlineStartPage && beat.outlineStartPage > 0 ? beat.outlineStartPage : undefined })
            : item
        )
      }),
      dirty: true
    })),
  deleteBeat: (beatId) =>
    set((state) => {
      const nextBeats = state.document.beats
        .filter((beat) => beat.id !== beatId)
        .map((beat) =>
          normalizeBeat({
            ...beat,
            parentId: beat.parentId === beatId ? undefined : beat.parentId,
            payoffBeatIds: beat.payoffBeatIds?.filter((id) => id !== beatId)
          })
        );

      return {
        document: touch({
          ...state.document,
          beats: nextBeats
        }),
        dirty: true
      };
    }),
  linkBeats: (fromBeatId, toBeatId) =>
    set((state) => {
      if (fromBeatId === toBeatId) return state;
      return {
        document: touch({
          ...state.document,
          beats: state.document.beats.map((beat) => (beat.id === toBeatId ? { ...beat, parentId: fromBeatId } : beat))
        }),
        dirty: true
      };
    }),
  unlinkBeatSide: (beatId, side) =>
    set((state) => ({
      document: touch({
        ...state.document,
        beats:
          side === 'left'
            ? state.document.beats.map((beat) => (beat.id === beatId ? { ...beat, parentId: undefined } : beat))
            : state.document.beats.map((beat) => (beat.parentId === beatId ? { ...beat, parentId: undefined } : beat))
      }),
      dirty: true
    })),
  sendBeatToScript: (beatId) => {
    const state = get();
    const beat = state.document.beats.find((item) => item.id === beatId);
    if (!beat) return;
    if (!beat.outlineStartPage || beat.outlineStartPage <= 0) {
      set({ lastWarning: 'Add a page number to this beat before sending it to the script.' });
      return;
    }
    const revision = state.document.settings.revisionMode ? getActiveRevision(state.document.revisions) : undefined;
    const targetPage = Math.max(1, beat.outlineStartPage);
    const sceneText = beat.title.trim() || 'NEW BEAT';
    const sceneElement = revision ? markElementRevision(createScriptElement('scene-heading', sceneText.toUpperCase()), revision) : createScriptElement('scene-heading', sceneText.toUpperCase());
    const bodyElement = beat.body.trim()
      ? revision
        ? markElementRevision(createScriptElement('action', beat.body.trim()), revision)
        : createScriptElement('action', beat.body.trim())
      : undefined;
    const elementsForTarget = padElementsToPage(state.document.elements, targetPage);
    const insertionIndex = insertionIndexForPage(elementsForTarget, targetPage);
    const inserted = bodyElement ? [sceneElement, bodyElement] : [sceneElement];
    const elements = [...elementsForTarget.slice(0, insertionIndex), ...inserted, ...elementsForTarget.slice(insertionIndex)];
    set({
      document: touch({
        ...state.document,
        elements,
        beats: state.document.beats.map((item) => (item.id === beatId ? { ...item, linkedElementId: sceneElement.id, scriptSyncState: 'synced' } : item))
      }),
      dirty: true,
      selectedElementId: sceneElement.id
    });
  },
  addStructureRangeAtPage: (page, kind = 'act') => {
    const state = get();
    const pageCount = Math.max(1, estimatePageCount(state.document.elements));
    const targetPage = Math.max(1, Math.min(Math.ceil(page), pageCount));
    const startElementId = elementIdForPage(state.document.elements, targetPage, 'start');
    const endElementId = elementIdForPage(state.document.elements, Math.min(pageCount, targetPage + 24), 'end') ?? startElementId;
    const id = uuid();
    const sameKindCount = state.document.structureRanges.filter((range) => range.kind === kind).length;
    const range: StructureRange = {
      id,
      label: kind === 'act' ? `ACT ${sameKindCount + 1}` : `${kind.toUpperCase()} ${sameKindCount + 1}`,
      color: ['#91c8b7', '#6ca8e7', '#a88adf', '#d9a441', '#9f3f45'][sameKindCount % 5],
      startPage: targetPage,
      endPage: Math.min(pageCount, targetPage + 24),
      startElementId,
      endElementId,
      kind,
      visible: true
    };

    set({
      document: touch({ ...state.document, structureRanges: [...state.document.structureRanges, range] }),
      dirty: true
    });
    return id;
  },
  updateStructureRange: (rangeId, patch) =>
    set((state) => ({
      document: touch({
        ...state.document,
        structureRanges: state.document.structureRanges.map((range) => (range.id === rangeId ? { ...range, ...patch } : range))
      }),
      dirty: true
    })),
  deleteStructureRange: (rangeId) =>
    set((state) => ({
      document: touch({
        ...state.document,
        structureRanges: state.document.structureRanges.filter((range) => range.id !== rangeId)
      }),
      dirty: true
    })),
  addCharacter: () => {
    const state = get();
    const id = uuid();
    const characterCount = state.document.characters.length;
    const character: CharacterProfile = {
      id,
      name: `CHARACTER ${characterCount + 1}`,
      aliases: [],
      color: ['#2f6fed', '#c24c3a', '#0f9f83', '#7b4fd6', '#d9a441'][characterCount % 5],
      description: '',
      demographics: '',
      notes: '',
      arc: createDefaultCharacterArc()
    };
    set({
      document: touch({ ...state.document, characters: [...state.document.characters, character] }),
      dirty: true
    });
    return id;
  },
  updateCharacter: (characterId, patch) =>
    set((state) => ({
      document: touch({
        ...state.document,
        characters: state.document.characters.map((character) => (character.id === characterId ? normalizeCharacter({ ...character, ...patch }) : character))
      }),
      dirty: true
    })),
  updateCharacterArc: (characterId, patch) =>
    set((state) => ({
      document: touch({
        ...state.document,
        characters: state.document.characters.map((character) =>
          character.id === characterId
            ? normalizeCharacter({
                ...character,
                arc: { ...createDefaultCharacterArc(), ...(character.arc ?? {}), ...patch }
              })
            : character
        )
      }),
      dirty: true
    })),
  renameCharacter: (characterId, nextName, applyToScript) =>
    set((state) => {
      const current = state.document.characters.find((character) => character.id === characterId);
      const normalizedNext = normalizeCharacterName(nextName);
      if (!current || !normalizedNext) return state;
      const normalizedCurrent = normalizeCharacterName(current.name);
      return {
        document: touch({
          ...state.document,
          characters: state.document.characters.map((character) => (character.id === characterId ? { ...character, name: normalizedNext } : character)),
          elements: applyToScript
            ? state.document.elements.map((element) =>
                element.type === 'character' && normalizeCharacterName(element.text) === normalizedCurrent
                  ? { ...element, text: normalizedNext, character: normalizedNext, updatedAt: new Date().toISOString() }
                  : element
              )
            : state.document.elements
        }),
        dirty: true
      };
    }),
  setElementType: (elementId, type) =>
    set((state) => {
      if (!elementId) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === elementId ? { ...element, type, updatedAt: new Date().toISOString() } : element
          )
        }),
        dirty: true
      };
    }),
  setSelectedElementType: (type) => {
    const elementId = get().selectedElementId;
    if (elementId) get().setElementType(elementId, type);
  },
  addProductionTagToSelected: (tag) =>
    set((state) => {
      if (!state.selectedElementId) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === state.selectedElementId
              ? { ...element, productionTags: [...element.productionTags, { ...tag, id: uuid() }], updatedAt: new Date().toISOString() }
              : element
          )
        }),
        dirty: true
      };
    }),
  addScriptNoteToElement: (elementId, text) =>
    set((state) => {
      if (!elementId || !text.trim()) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === elementId
              ? {
                  ...element,
                  notes: [
                    ...element.notes,
                    { id: uuid(), text: text.trim(), color: '#ffe08a', resolved: false, createdAt: new Date().toISOString() }
                  ],
                  updatedAt: new Date().toISOString()
                }
              : element
          )
        }),
        dirty: true
      };
    }),
  addScriptNoteToSelected: (text) => {
    const elementId = get().selectedElementId;
    if (elementId) get().addScriptNoteToElement(elementId, text);
  },
  toggleRevisionOnSelected: (color) =>
    set((state) => {
      if (!state.selectedElementId) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === state.selectedElementId
              ? { ...element, revisionColor: element.revisionColor ? undefined : color, updatedAt: new Date().toISOString() }
              : element
          )
        }),
        dirty: true
      };
    }),
  setRevisionMode: (enabled) =>
    set((state) => {
      const document = normalizeDocument(state.document);
      const revisions = document.revisions.some((revision) => revision.active)
        ? document.revisions
        : document.revisions.map((revision, index) => ({ ...revision, active: index === Math.min(1, document.revisions.length - 1) }));

      return {
        document: touch({
          ...document,
          revisions,
          settings: { ...document.settings, revisionMode: enabled }
        }),
        dirty: true
      };
    }),
  setActiveRevisionSet: (revisionId) =>
    set((state) => {
      const document = normalizeDocument(state.document);
      return {
        document: touch({
          ...document,
          revisions: document.revisions.map((revision) => ({ ...revision, active: revision.id === revisionId }))
        }),
        dirty: true
      };
    }),
  updateRevisionSet: (revisionId, patch) =>
    set((state) => {
      const document = normalizeDocument(state.document);
      return {
        document: touch({
          ...document,
          revisions: document.revisions.map((revision) => (revision.id === revisionId ? { ...revision, ...patch } : revision))
        }),
        dirty: true
      };
    }),
  markElementRevised: (elementId) =>
    set((state) => {
      if (!elementId) return state;
      const document = normalizeDocument(state.document);
      const revision = getActiveRevision(document.revisions);
      if (!revision) return state;
      return {
        document: touch({
          ...document,
          elements: document.elements.map((element) => (element.id === elementId ? markElementRevision(element, revision) : element))
        }),
        dirty: true
      };
    }),
  markSelectedRevised: () => {
    const elementId = get().selectedElementId;
    if (elementId) get().markElementRevised(elementId);
  },
  clearSelectedRevision: () =>
    set((state) => {
      if (!state.selectedElementId) return state;
      const document = normalizeDocument(state.document);
      return {
        document: touch({
          ...document,
          elements: document.elements.map((element) =>
            element.id === state.selectedElementId
              ? { ...element, revisionColor: undefined, revisionSetId: undefined, revisionMark: undefined, updatedAt: new Date().toISOString() }
              : element
          )
        }),
        dirty: true
      };
    }),
  toggleOmitSelected: () =>
    set((state) => {
      if (!state.selectedElementId) return state;
      return {
        document: touch({
          ...state.document,
          elements: state.document.elements.map((element) =>
            element.id === state.selectedElementId ? { ...element, omitted: !element.omitted, updatedAt: new Date().toISOString() } : element
          )
        }),
        dirty: true
      };
    }),
  captureDraftVersion: (label, note) =>
    set((state) => ({
      document: touch({
        ...state.document,
        draftVersions: [buildDraftVersion(state.document, label, note), ...(state.document.draftVersions ?? [])].slice(0, 50)
      }),
      dirty: true
    })),
  createRevisionMemo: () =>
    set((state) => ({
      document: touch({
        ...state.document,
        revisionMemos: [buildRevisionMemo(state.document), ...(state.document.revisionMemos ?? [])].slice(0, 30)
      }),
      dirty: true
    })),
  startSprint: () => {
    const state = get();
    const stats = computeWritingStats(state.document);
    set({
      sprintStartedAt: new Date().toISOString(),
      sprintBaseline: { words: stats.words, pages: stats.pages }
    });
  },
  stopSprint: () => {
    const state = get();
    if (!state.sprintStartedAt) return;
    const startedAtTime = new Date(state.sprintStartedAt).getTime();
    const seconds = Number.isFinite(startedAtTime) ? Math.max(1, Math.round((Date.now() - startedAtTime) / 1000)) : 1;
    const stats = computeWritingStats(state.document);
    const baseline = state.sprintBaseline ?? { words: stats.words, pages: stats.pages };
    set({
      sprintStartedAt: undefined,
      sprintBaseline: undefined,
      dirty: true,
      document: touch({
        ...state.document,
        writingSessions: [
          ...state.document.writingSessions,
          {
            id: uuid(),
            startedAt: state.sprintStartedAt,
            endedAt: new Date().toISOString(),
            wordsAdded: Math.max(0, stats.words - baseline.words),
            pagesAdded: Math.max(0, stats.pages - baseline.pages),
            seconds
          }
        ]
      })
    });
  },
  setWarning: (lastWarning) => set({ lastWarning })
}));
