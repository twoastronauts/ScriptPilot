export type ScriptElementType =
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'general'
  | 'page-break';

export type ScriptFormat = 'screenplay' | 'tv' | 'stage-play' | 'novel' | 'comic';

export type ViewMode = 'day' | 'night' | 'midnight';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  backgroundColor?: string;
}

export interface TitlePage {
  title: string;
  author: string;
  byline?: string;
  contact?: string;
  draftDate?: string;
  source?: string;
  styles?: Record<string, TextStyle>;
  fields: Record<string, string>;
}

export interface ScriptNote {
  id: string;
  text: string;
  color: string;
  resolved: boolean;
  createdAt: string;
}

export interface ProductionTag {
  id: string;
  category: 'prop' | 'wardrobe' | 'cast' | 'vehicle' | 'vfx' | 'sound' | 'location' | 'custom';
  label: string;
  color: string;
}

export interface FdxParagraphShadow {
  rawParagraph?: unknown;
  originalIndex?: number;
}

export interface ScriptElement {
  id: string;
  type: ScriptElementType;
  text: string;
  character?: string;
  notes: ScriptNote[];
  productionTags: ProductionTag[];
  revisionColor?: string;
  revisionSetId?: string;
  revisionMark?: string;
  lockedPage?: number;
  omitted?: boolean;
  alternateText?: string;
  style?: TextStyle;
  generatedPageBreak?: boolean;
  createdAt: string;
  updatedAt: string;
  fdx?: FdxParagraphShadow;
}

export interface Beat {
  id: string;
  title: string;
  body: string;
  color: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  textStyle?: 'normal' | 'large' | 'headline';
  showBody?: boolean;
  showImage?: boolean;
  showAudio?: boolean;
  outlineLaneId?: string;
  outlineStartPage?: number;
  outlinePageSpan?: number;
  imageDataUrl?: string;
  audioDataUrl?: string;
  audioName?: string;
  audioRecordedAt?: string;
  linkedElementId?: string;
  parentId?: string;
}

export interface OutlineLane {
  id: string;
  name: string;
  color: string;
  elementTypes: ScriptElementType[];
  collapsed: boolean;
}

export interface StructureRange {
  id: string;
  label: string;
  color: string;
  startElementId: string;
  endElementId: string;
  kind: 'act' | 'sequence' | 'scene' | 'custom';
  visible: boolean;
}

export interface NavigatorColumn {
  id: string;
  label: string;
  field: 'scene' | 'page' | 'location' | 'time' | 'characters' | 'tags' | 'notes' | 'screenTime';
  visible: boolean;
}

export interface NavigatorTab {
  id: string;
  name: string;
  filter: string;
  columns: NavigatorColumn[];
}

export interface RevisionSet {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  pageColor?: string;
  mark?: string;
  date: string;
  active: boolean;
  lockedPages: number[];
}

export interface WritingSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  wordsAdded: number;
  pagesAdded: number;
  seconds: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  color: string;
  voice?: string;
  aliases: string[];
  notes?: string;
  description?: string;
  demographics?: string;
  userMetadata?: Record<string, string>;
}

export interface ProjectSettings {
  format: ScriptFormat;
  viewMode: ViewMode;
  focusMode: boolean;
  typewriterMode: boolean;
  typewriterSounds: boolean;
  typewriterVolume: number;
  pageMode: 'pages' | 'continuous';
  showPageNumbers: boolean;
  pageNumberStart: number;
  showHeaderFooter: boolean;
  headerText: string;
  footerText: string;
  exportIncludeTitlePage: boolean;
  outlineHeight: number;
  activeLineStyle: 'underline' | 'frame' | 'none';
  smartType: boolean;
  spellcheck: boolean;
  grammarSuggestions: boolean;
  styleSuggestions: boolean;
  dictionaryLanguage: string;
  autosave: boolean;
  backupIntervalMinutes: number;
  sprintChimeEnabled: boolean;
  sprintChimeMinutes: number;
  customPdfColors: boolean;
  revisionMode: boolean;
  showRevisionMarks: boolean;
  showRevisionPageColors: boolean;
  collaborationUrl?: string;
}

export interface RecentFileMetadata {
  format: ScriptFormat;
  pages: number;
  scenes: number;
  characters: number;
  revisions: number;
  words: number;
}

export interface RecentFile {
  path: string;
  title: string;
  type: 'project' | 'fdx' | 'text' | 'pdf' | 'unknown';
  color: string;
  lastOpenedAt: string;
  lastSavedAt?: string;
  metadata: RecentFileMetadata;
}

export interface FdxShadow {
  sourcePath?: string;
  importedAt: string;
  originalXml: string;
  rawRoot: unknown;
}

export interface ScriptDocument {
  id: string;
  title: string;
  author: string;
  format: ScriptFormat;
  titlePage: TitlePage;
  elements: ScriptElement[];
  beats: Beat[];
  outlineLanes: OutlineLane[];
  structureRanges: StructureRange[];
  navigatorTabs: NavigatorTab[];
  revisions: RevisionSet[];
  writingSessions: WritingSession[];
  characters: CharacterProfile[];
  settings: ProjectSettings;
  fdxShadow?: FdxShadow;
  createdAt: string;
  updatedAt: string;
}
