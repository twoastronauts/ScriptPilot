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

export interface ThemeColorSettings {
  bg?: string;
  bgElevated?: string;
  bgSoft?: string;
  panel?: string;
  panelSolid?: string;
  panelRaised?: string;
  page?: string;
  pageInk?: string;
  pageMuted?: string;
  text?: string;
  textStrong?: string;
  muted?: string;
  muted2?: string;
  border?: string;
  borderStrong?: string;
  controlBg?: string;
  controlHover?: string;
  controlBorder?: string;
  fieldBg?: string;
  scrollTrack?: string;
  scrollThumb?: string;
  scrollThumbHover?: string;
  accent?: string;
  accentInk?: string;
  accentSoft?: string;
  brass?: string;
  teal?: string;
  blue?: string;
  warning?: string;
  danger?: string;
  focus?: string;
}

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

export interface InlineTextStyle {
  id: string;
  from: number;
  to: number;
  style: TextStyle;
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

export type StoryCheckCategory = 'structure' | 'scene' | 'dialogue' | 'character' | 'visual' | 'subtext' | 'production' | 'proofing';
export type StoryCheckSeverity = 'note' | 'warning' | 'strong';

export interface SceneIntent {
  id: string;
  sceneElementId: string;
  sceneNumber: number;
  want: string;
  obstacle: string;
  stakes: string;
  turn: string;
  emotionalAnchor?: string;
  setupPayoff?: string;
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
  inlineStyles?: InlineTextStyle[];
  generatedPageBreak?: boolean;
  createdAt: string;
  updatedAt: string;
  fdx?: FdxParagraphShadow;
}

export type EditableProductionShotType = 'scripted' | 'master' | 'coverage' | 'insert' | 'custom';

export interface EditableProductionShot {
  id: string;
  sceneId?: string;
  sceneNumber: number;
  order: number;
  shotNumber: string;
  setup: string;
  shotType: EditableProductionShotType;
  label: string;
  description: string;
  subject: string;
  cameraAngle: string;
  cameraMovement: string;
  cameraEquipment: string;
  framing: string;
  location: string;
  timeOfDay: string;
  characters: string[];
  tags: string[];
  estimatedMinutes: number;
  setupMinutes: number;
  sourceElementId?: string;
  custom?: boolean;
}

export interface EditableCallSheet {
  id: string;
  projectTitle: string;
  shootDay: number;
  title: string;
  location: string;
  timeOfDay: string;
  callTime: string;
  scenesText: string;
  cast: string[];
  departments: string[];
  notes: string[];
  custom?: boolean;
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
  act?: string;
  sequence?: string;
  goal?: string;
  conflict?: string;
  payoffBeatIds?: string[];
  scriptSyncState?: 'unlinked' | 'linked' | 'stale' | 'synced';
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
  summary?: string;
  startPage?: number;
  endPage?: number;
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

export interface RevisionMemo {
  id: string;
  revisionSetId: string;
  title: string;
  body: string;
  changedElementIds: string[];
  createdAt: string;
}

export interface DraftVersion {
  id: string;
  label: string;
  note?: string;
  createdAt: string;
  elementCount: number;
  wordCount: number;
  revisionSetId?: string;
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
  arc?: CharacterArc;
}

export interface CharacterArc {
  want: string;
  need: string;
  wound: string;
  secret: string;
  contradiction: string;
  openingState: string;
  closingState: string;
  voiceNotes: string;
  recurringProps: string[];
}

export interface DialogueAnalysis {
  characterName: string;
  lineCount: number;
  wordCount: number;
  averageWordsPerLine: number;
  questionCount: number;
  monologueCount: number;
  repeatedPhrases: string[];
  sampleLines: string[];
}

export interface StoryCheckResult {
  id: string;
  category: StoryCheckCategory;
  severity: StoryCheckSeverity;
  title: string;
  message: string;
  suggestion: string;
  elementId?: string;
  sceneNumber?: number;
}

export interface CollabRoom {
  id: string;
  roomUrl: string;
  provider: 'local' | 'hocuspocus' | 'websocket';
  permission: CollabPermission;
  hostName?: string;
  hostPort?: number;
  roomToken?: string;
  startedAt?: string;
  endedAt?: string;
  participantCount?: number;
  isHost?: boolean;
  status?: CollabStatus;
  lastSyncedAt?: string;
}

export type CollabPermission = 'host' | 'edit' | 'comment' | 'read';
export type CollabStatus = 'offline' | 'starting' | 'hosting' | 'joining' | 'connected' | 'reconnecting' | 'ended' | 'error';

export interface CollabParticipant {
  id: string;
  name: string;
  color: string;
  permission: CollabPermission;
  page?: number;
  scene?: string;
  selectedElementId?: string;
  online: boolean;
  isLocal?: boolean;
  lastSeenAt: string;
}

export interface CollabInvite {
  roomId: string;
  roomName: string;
  url: string;
  host: string;
  port: number;
  token: string;
  permission: CollabPermission;
  appUrl: string;
  manualCode: string;
}

export interface CollabHostStatus {
  roomId: string;
  roomName: string;
  url: string;
  host: string;
  port: number;
  startedAt: string;
  endedAt?: string;
  status: CollabStatus;
  isHost: boolean;
  invite: CollabInvite;
}

export interface CollabSession {
  roomId: string;
  roomName: string;
  url: string;
  token: string;
  permission: CollabPermission;
  isHost: boolean;
  status: CollabStatus;
  startedAt?: string;
  endedAt?: string;
  invite?: CollabInvite;
}

export interface ExportPackage {
  id: string;
  createdAt: string;
  includePdf: boolean;
  includeFdx: boolean;
  includeProject: boolean;
  includeRevisionMemo: boolean;
  outputDirectory?: string;
}

export interface ProjectSettings {
  format: ScriptFormat;
  viewMode: ViewMode;
  focusMode: boolean;
  typewriterMode: boolean;
  typewriterSounds: boolean;
  typewriterVolume: number;
  typewriterBellVolume: number;
  pageMode: 'pages' | 'continuous';
  showPageNumbers: boolean;
  pageNumberStart: number;
  showHeaderFooter: boolean;
  headerText: string;
  footerText: string;
  exportIncludeTitlePage: boolean;
  exportIncludeNotes: boolean;
  exportOpenFolder: boolean;
  exportNolanMode: boolean;
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
  themeColors?: ThemeColorSettings;
  customPdfColors: boolean;
  tutorialMode: boolean;
  tutorialCompleted: boolean;
  revisionMode: boolean;
  showRevisionMarks: boolean;
  showRevisionPageColors: boolean;
  collaborationUrl?: string;
  collabProvider?: 'local' | 'hocuspocus' | 'websocket';
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
  sceneIntents: SceneIntent[];
  draftVersions: DraftVersion[];
  revisionMemos: RevisionMemo[];
  collabRooms: CollabRoom[];
  exportPackages: ExportPackage[];
  productionShots: EditableProductionShot[];
  productionCallSheets: EditableCallSheet[];
  settings: ProjectSettings;
  fdxShadow?: FdxShadow;
  createdAt: string;
  updatedAt: string;
}
