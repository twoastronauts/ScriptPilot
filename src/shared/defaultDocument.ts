import { v4 as uuid } from 'uuid';
import { inferElementType, normalizeCharacterName } from './screenplay';
import type {
  Beat,
  CharacterArc,
  CharacterProfile,
  NavigatorTab,
  OutlineLane,
  ProjectSettings,
  RevisionSet,
  ScriptDocument,
  ScriptElement,
  ScriptElementType,
  StructureRange,
  TextStyle
} from './types';

const now = (): string => new Date().toISOString();

export function createScriptElement(type: ScriptElementType, text: string): ScriptElement {
  const timestamp = now();
  return {
    id: uuid(),
    type,
    text,
    character: type === 'character' ? normalizeCharacterName(text) : undefined,
    notes: [],
    productionTags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createDefaultSettings(): ProjectSettings {
  return {
    format: 'screenplay',
    viewMode: 'midnight',
    focusMode: false,
    typewriterMode: true,
    typewriterSounds: true,
    typewriterVolume: 0.7,
    pageMode: 'pages',
    showPageNumbers: true,
    pageNumberStart: 1,
    showHeaderFooter: true,
    headerText: '',
    footerText: '',
    exportIncludeTitlePage: true,
    outlineHeight: 138,
    activeLineStyle: 'underline',
    smartType: true,
    spellcheck: true,
    grammarSuggestions: true,
    styleSuggestions: true,
    dictionaryLanguage: 'en-US',
    autosave: true,
    backupIntervalMinutes: 5,
    sprintChimeEnabled: true,
    sprintChimeMinutes: 5,
    customPdfColors: true,
    revisionMode: false,
    showRevisionMarks: true,
    showRevisionPageColors: true,
    collabProvider: 'local'
  };
}

export function createDefaultNavigatorTabs(): NavigatorTab[] {
  return [
    {
      id: uuid(),
      name: 'Script',
      filter: '',
      columns: [
        { id: uuid(), label: 'Scene', field: 'scene', visible: true },
        { id: uuid(), label: 'Page', field: 'page', visible: true },
        { id: uuid(), label: 'Characters', field: 'characters', visible: true },
        { id: uuid(), label: 'Tags', field: 'tags', visible: true },
        { id: uuid(), label: 'Notes', field: 'notes', visible: true }
      ]
    },
    {
      id: uuid(),
      name: 'Characters',
      filter: '',
      columns: [
        { id: uuid(), label: 'Character', field: 'characters', visible: true },
        { id: uuid(), label: 'Screen Time', field: 'screenTime', visible: true },
        { id: uuid(), label: 'Interactions', field: 'scene', visible: true }
      ]
    }
  ];
}

export function createDefaultOutlineLanes(): OutlineLane[] {
  return [
    { id: uuid(), name: 'Acts', color: '#2f6fed', elementTypes: ['scene-heading'], collapsed: false },
    { id: uuid(), name: 'Sequences', color: '#0f9f83', elementTypes: ['scene-heading', 'shot'], collapsed: false },
    { id: uuid(), name: 'Script', color: '#c24c3a', elementTypes: ['scene-heading', 'action', 'character', 'dialogue'], collapsed: false }
  ];
}

export function createDefaultRevisions(): RevisionSet[] {
  const timestamp = now();
  return [
    { id: uuid(), name: 'Production White', color: '#ffffff', textColor: '#444444', pageColor: '#ffffff', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Blue Revision', color: '#a9d8ff', textColor: '#2f6fed', pageColor: '#dff0ff', mark: '*', date: timestamp, active: true, lockedPages: [] },
    { id: uuid(), name: 'Pink Revision', color: '#ffc1d6', textColor: '#c34273', pageColor: '#ffe3ee', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Yellow Revision', color: '#fff2a8', textColor: '#9a6b00', pageColor: '#fff7c7', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Green Revision', color: '#b8e6b1', textColor: '#2f7a39', pageColor: '#e2f6dd', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Goldenrod Revision', color: '#f2c56b', textColor: '#9b5e00', pageColor: '#f8df9b', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Buff Revision', color: '#f0d2a8', textColor: '#8d5e2f', pageColor: '#f5dfbf', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Salmon Revision', color: '#f6a392', textColor: '#a94332', pageColor: '#ffd0c6', mark: '*', date: timestamp, active: false, lockedPages: [] },
    { id: uuid(), name: 'Cherry Revision', color: '#d65b6f', textColor: '#b92c49', pageColor: '#f7c6d0', mark: '*', date: timestamp, active: false, lockedPages: [] }
  ];
}

export function createDefaultTitlePageStyles(): Record<string, TextStyle> {
  return {
    title: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '24pt', fontWeight: '700' },
    byline: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '12pt', fontWeight: '400' },
    author: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '12pt', fontWeight: '400' },
    source: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '11pt', fontWeight: '400', italic: true },
    contact: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '10pt', fontWeight: '400' },
    draftDate: { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '10pt', fontWeight: '400' }
  };
}

export function createDefaultCharacterArc(): CharacterArc {
  return {
    want: '',
    need: '',
    wound: '',
    secret: '',
    contradiction: '',
    openingState: '',
    closingState: '',
    voiceNotes: '',
    recurringProps: []
  };
}

export function createDefaultBeats(): Beat[] {
  const openingId = uuid();
  const breakId = uuid();
  const finalId = uuid();
  return [
    {
      id: openingId,
      title: 'Opening Image',
      body: 'A vivid first impression that states the promise of the story.',
      color: '#d9a441',
      x: 60,
      y: 72,
      width: 360,
      height: 420,
      textStyle: 'normal',
      showBody: true,
      showImage: true,
      showAudio: true,
      act: 'Act One',
      sequence: 'Opening',
      goal: 'State the promise of the story.',
      conflict: '',
      payoffBeatIds: [finalId],
      scriptSyncState: 'unlinked',
      outlineStartPage: 1,
      outlinePageSpan: 8
    },
    {
      id: breakId,
      title: 'Break Into Two',
      body: 'The protagonist crosses into the main dramatic problem.',
      color: '#4f8f87',
      x: 500,
      y: 150,
      width: 360,
      height: 420,
      textStyle: 'normal',
      showBody: true,
      showImage: true,
      showAudio: true,
      parentId: openingId,
      act: 'Act Two',
      sequence: 'Threshold',
      goal: 'Force the protagonist into the main problem.',
      conflict: '',
      payoffBeatIds: [],
      scriptSyncState: 'unlinked',
      outlineStartPage: 25,
      outlinePageSpan: 10
    },
    {
      id: finalId,
      title: 'Final Image',
      body: 'A transformed echo of the opening image.',
      color: '#9f3f45',
      x: 940,
      y: 92,
      width: 360,
      height: 420,
      textStyle: 'normal',
      showBody: true,
      showImage: true,
      showAudio: true,
      parentId: breakId,
      act: 'Act Three',
      sequence: 'Resolution',
      goal: 'Echo the opening with transformation.',
      conflict: '',
      payoffBeatIds: [],
      scriptSyncState: 'unlinked',
      outlineStartPage: 90,
      outlinePageSpan: 10
    }
  ];
}

export function createDocumentFromPlainText(title: string, text: string): ScriptDocument {
  const lines = text.trim()
    ? text.split(/\r?\n/).filter((line) => line.trim().length > 0)
    : [
        'INT. OBSERVATORY - NIGHT',
        'A bank of monitors glow beneath a glass dome. Rain whispers against the stars.',
        'MARA',
        'The app should feel like the room where the story finally starts behaving.',
        'She pins a yellow beat card to a digital board.',
        'CUT TO:'
      ];

  let previous: ScriptElementType | undefined;
  const elements = lines.map((line) => {
    const type = inferElementType(line, previous);
    previous = type;
    return createScriptElement(type, line.trim());
  });

  const timestamp = now();
  const characters: CharacterProfile[] = Array.from(
    new Set(elements.filter((element) => element.type === 'character').map((element) => normalizeCharacterName(element.text)))
  ).map((name, index) => ({
    id: uuid(),
    name,
    aliases: [],
    color: ['#2f6fed', '#c24c3a', '#0f9f83', '#7b4fd6'][index % 4],
    description: '',
    demographics: '',
    arc: createDefaultCharacterArc()
  }));

  const structureRanges: StructureRange[] = elements.find((element) => element.type === 'scene-heading')
    ? [
        {
          id: uuid(),
          label: 'Act One',
          color: '#2f6fed',
          startElementId: elements[0].id,
          endElementId: elements[Math.max(0, elements.length - 1)].id,
          kind: 'act',
          visible: true
        }
      ]
    : [];

  return {
    id: uuid(),
    title,
    author: '',
    format: 'screenplay',
    titlePage: {
      title,
      author: '',
      byline: 'Written by',
      styles: createDefaultTitlePageStyles(),
      fields: {
        Title: title,
        Author: '',
        Draft: 'First Draft'
      }
    },
    elements,
    beats: createDefaultBeats(),
    outlineLanes: createDefaultOutlineLanes(),
    structureRanges,
    navigatorTabs: createDefaultNavigatorTabs(),
    revisions: createDefaultRevisions(),
    writingSessions: [],
    characters,
    sceneIntents: [],
    draftVersions: [],
    revisionMemos: [],
    collabRooms: [],
    exportPackages: [],
    settings: createDefaultSettings(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
