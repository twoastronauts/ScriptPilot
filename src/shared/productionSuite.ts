import { estimatePageCount, normalizeCharacterName } from './screenplay';
import type { CharacterProfile, ProductionTag, ScriptDocument, ScriptElement, ScriptNote } from './types';

export interface ParsedSceneHeading {
  sceneType: string;
  location: string;
  timeOfDay: string;
}

export interface ProductionTagSummary {
  id: string;
  category: ProductionTag['category'];
  label: string;
  color: string;
  count: number;
  sceneIds: string[];
  sceneHeadings: string[];
  elementIds: string[];
}

export interface ProductionSceneBreakdown {
  id: string;
  sceneNumber: number;
  heading: string;
  sceneType: string;
  location: string;
  timeOfDay: string;
  page: number;
  estimatedPages: number;
  actionSummary: string;
  characters: string[];
  productionTags: ProductionTagSummary[];
  notes: ScriptNote[];
  elements: ScriptElement[];
  stripColor: string;
}

export interface ProductionCharacterSummary {
  id: string;
  name: string;
  color: string;
  sceneIds: string[];
  speakingBlocks: number;
}

export interface ProductionSceneGroup {
  id: string;
  location: string;
  timeOfDay: string;
  scenes: ProductionSceneBreakdown[];
  sceneIds: string[];
  characters: string[];
  tags: string[];
  departments: string[];
  totalPages: number;
  estimatedHours: number;
}

export type ProductionShotType = 'scripted' | 'master' | 'coverage' | 'insert';

export interface ProductionShot {
  id: string;
  sceneId: string;
  sceneNumber: number;
  order: number;
  shotNumber: string;
  setup: string;
  shotType: ProductionShotType;
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
  tags: ProductionTagSummary[];
  estimatedMinutes: number;
  setupMinutes: number;
  sourceElementId?: string;
}

export interface StoryboardCard {
  id: string;
  shotId: string;
  sceneId: string;
  sceneNumber: number;
  frameNumber: number;
  frameLabel: string;
  caption: string;
  visualBeat: string;
  location: string;
  timeOfDay: string;
  characters: string[];
  tags: string[];
}

export interface StripboardSceneSummary {
  id: string;
  sceneNumber: number;
  heading: string;
  page: number;
  estimatedPages: number;
  stripColor: string;
  characters: string[];
  tags: string[];
}

export interface StripboardDay {
  id: string;
  shootDay: number;
  location: string;
  timeOfDay: string;
  scenes: StripboardSceneSummary[];
  sceneIds: string[];
  cast: string[];
  departments: string[];
  tags: string[];
  totalPages: number;
  estimatedHours: number;
}

export interface ProductionContact {
  id: string;
  name: string;
  role: string;
  department: string;
  characterName?: string;
  email?: string;
  phone?: string;
}

export interface CallSheetRecipient {
  id: string;
  contactId: string;
  name: string;
  role: string;
  department: string;
  channel: 'email' | 'phone' | 'manual';
  characterName?: string;
  email?: string;
  phone?: string;
}

export interface CallSheetSummary {
  id: string;
  projectTitle: string;
  shootDay: number;
  title: string;
  location: string;
  timeOfDay: string;
  callTime: string;
  scenes: StripboardSceneSummary[];
  cast: string[];
  departments: string[];
  recipients: CallSheetRecipient[];
  notes: string[];
}

export interface ProductionBoard {
  title: string;
  scenes: ProductionSceneBreakdown[];
  sceneGroups: ProductionSceneGroup[];
  shotList: ProductionShot[];
  storyboardCards: StoryboardCard[];
  stripboardSchedule: StripboardDay[];
  callSheets: CallSheetSummary[];
  contacts: ProductionContact[];
  recipients: CallSheetRecipient[];
  tags: ProductionTagSummary[];
  characters: ProductionCharacterSummary[];
}

interface SceneDraft {
  id: string;
  sceneNumber: number;
  heading: string;
  sceneType: string;
  location: string;
  timeOfDay: string;
  page: number;
  elements: ScriptElement[];
  characters: string[];
  tagMap: Map<string, ProductionTagSummary>;
  notes: ScriptNote[];
}

const SCENE_HEADING_PATTERN = /^(INT\.\/EXT\.|INT\/EXT\.|I\/E\.|INT\.|EXT\.|EST\.)\s*(.*)$/i;

const DEPARTMENT_LABELS: Record<ProductionTag['category'], string> = {
  prop: 'Props',
  wardrobe: 'Wardrobe',
  cast: 'Cast',
  vehicle: 'Transportation',
  vfx: 'VFX',
  sound: 'Sound',
  location: 'Locations',
  custom: 'Production'
};

export function buildProductionBoard(document: ScriptDocument): ProductionBoard {
  const scenes = collectProductionScenes(document);
  const sceneGroups = groupScenesByLocationTime(scenes);
  const shotList = generateDefaultShotsFromScenes(scenes);
  const storyboardCards = buildStoryboardCards(shotList);
  const stripboardSchedule = buildStripboardSchedule(sceneGroups);
  const contacts = buildProductionContacts(document, scenes);
  const recipients = buildCallSheetRecipients(contacts);
  const callSheets = buildCallSheetSummaries(document, stripboardSchedule, recipients);

  return {
    title: document.title,
    scenes,
    sceneGroups,
    shotList,
    storyboardCards,
    stripboardSchedule,
    callSheets,
    contacts,
    recipients,
    tags: collectBoardTags(scenes),
    characters: collectBoardCharacters(document, scenes)
  };
}

export function parseSceneHeading(heading: string): ParsedSceneHeading {
  const trimmed = heading.trim();
  const match = trimmed.match(SCENE_HEADING_PATTERN);
  const rawSceneType = match?.[1] ?? 'SCENE';
  const sceneType = rawSceneType.toUpperCase().replace('INT./EXT.', 'INT/EXT.');
  const body = (match?.[2] ?? trimmed).trim();
  const parts = body.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    return {
      sceneType,
      location: body.toUpperCase() || 'UNSPECIFIED',
      timeOfDay: 'UNSPECIFIED'
    };
  }

  const timeOfDay = parts[parts.length - 1].toUpperCase();
  const location = parts.slice(0, -1).join(' - ').toUpperCase();
  return {
    sceneType,
    location: location || 'UNSPECIFIED',
    timeOfDay: timeOfDay || 'UNSPECIFIED'
  };
}

export function collectProductionScenes(document: ScriptDocument): ProductionSceneBreakdown[] {
  const scenes: ProductionSceneBreakdown[] = [];
  let draft: SceneDraft | undefined;
  let currentPage = 1;

  for (const element of document.elements) {
    if (element.type === 'page-break') currentPage += 1;

    if (element.type === 'scene-heading') {
      if (draft) scenes.push(finalizeSceneDraft(draft));
      const parsed = parseSceneHeading(element.text);
      draft = {
        id: element.id,
        sceneNumber: scenes.length + 1,
        heading: element.text,
        sceneType: parsed.sceneType,
        location: parsed.location,
        timeOfDay: parsed.timeOfDay,
        page: currentPage,
        elements: [element],
        characters: [],
        tagMap: new Map(),
        notes: []
      };
      collectElementForScene(draft, element, document.characters);
      continue;
    }

    if (!draft) continue;
    draft.elements.push(element);
    collectElementForScene(draft, element, document.characters);
  }

  if (draft) scenes.push(finalizeSceneDraft(draft));
  return scenes;
}

export function groupScenesByLocationTime(scenes: ProductionSceneBreakdown[]): ProductionSceneGroup[] {
  const groups = new Map<string, ProductionSceneGroup>();

  for (const scene of scenes) {
    const key = `${groupKey(scene.location)}:${groupKey(scene.timeOfDay)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `group:${slugify(scene.location)}:${slugify(scene.timeOfDay)}`,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        scenes: [],
        sceneIds: [],
        characters: [],
        tags: [],
        departments: [],
        totalPages: 0,
        estimatedHours: 0
      });
    }

    const group = groups.get(key)!;
    group.scenes.push(scene);
    group.sceneIds.push(scene.id);
    group.totalPages = roundToTenth(group.totalPages + scene.estimatedPages);
    group.estimatedHours = roundToTenth(group.estimatedHours + estimateSceneHours(scene));

    for (const character of scene.characters) addUnique(group.characters, character);
    for (const tag of scene.productionTags) {
      addUnique(group.tags, formatTagLabel(tag));
      addUnique(group.departments, DEPARTMENT_LABELS[tag.category]);
    }
  }

  return Array.from(groups.values());
}

export function generateDefaultShotsFromScenes(scenes: ProductionSceneBreakdown[]): ProductionShot[] {
  const shots: ProductionShot[] = [];
  let order = 1;

  for (const scene of scenes) {
    let sceneShotIndex = 1;

    for (const scriptedShot of scene.elements.filter((element) => element.type === 'shot' && element.text.trim())) {
      const setup = shotSetupLabel(scene.sceneNumber, sceneShotIndex);
      shots.push({
        id: `shot:${scene.id}:scripted:${scriptedShot.id}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        order,
        shotNumber: setup,
        setup,
        shotType: 'scripted',
        label: `${scene.sceneNumber} scripted`,
        description: compactText(scriptedShot.text),
        subject: compactText(scriptedShot.text),
        cameraAngle: 'Director specified',
        cameraMovement: 'Director specified',
        cameraEquipment: 'A Camera',
        framing: 'Project default',
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        characters: scene.characters,
        tags: [],
        estimatedMinutes: 20,
        setupMinutes: 20,
        sourceElementId: scriptedShot.id
      });
      order += 1;
      sceneShotIndex += 1;
    }

    const masterSetup = shotSetupLabel(scene.sceneNumber, sceneShotIndex);
    shots.push({
      id: `shot:${scene.id}:master`,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      order,
      shotNumber: masterSetup,
      setup: masterSetup,
      shotType: 'master',
      label: `${scene.sceneNumber} master`,
      description: scene.actionSummary || `Cover ${scene.heading}`,
      subject: scene.location,
      cameraAngle: 'Eye level',
      cameraMovement: 'Static or motivated move',
      cameraEquipment: 'A Camera / tripod',
      framing: 'Wide master',
      location: scene.location,
      timeOfDay: scene.timeOfDay,
      characters: scene.characters,
      tags: scene.productionTags,
      estimatedMinutes: 45,
      setupMinutes: 45
    });
    order += 1;
    sceneShotIndex += 1;

    for (const character of scene.characters.slice(0, 4)) {
      const coverageSetup = shotSetupLabel(scene.sceneNumber, sceneShotIndex);
      shots.push({
        id: `shot:${scene.id}:coverage:${slugify(character)}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        order,
        shotNumber: coverageSetup,
        setup: coverageSetup,
        shotType: 'coverage',
        label: `${scene.sceneNumber} ${character}`,
        description: `Coverage for ${character} in ${scene.heading}`,
        subject: character,
        cameraAngle: 'Eye level',
        cameraMovement: 'Static / motivated',
        cameraEquipment: 'A Camera',
        framing: 'Medium or close-up',
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        characters: [character],
        tags: scene.productionTags.filter((tag) => tag.category === 'wardrobe' || tag.category === 'cast'),
        estimatedMinutes: 25,
        setupMinutes: 25
      });
      order += 1;
      sceneShotIndex += 1;
    }

    for (const tag of scene.productionTags.filter((item) => item.category !== 'cast').slice(0, 3)) {
      const insertSetup = shotSetupLabel(scene.sceneNumber, sceneShotIndex);
      shots.push({
        id: `shot:${scene.id}:insert:${tag.id}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        order,
        shotNumber: insertSetup,
        setup: insertSetup,
        shotType: 'insert',
        label: `${scene.sceneNumber} ${tag.label}`,
        description: `Insert for ${formatTagLabel(tag)} in ${scene.heading}`,
        subject: tag.label,
        cameraAngle: 'Detail',
        cameraMovement: 'Static',
        cameraEquipment: 'A Camera / macro as needed',
        framing: 'Insert',
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        characters: [],
        tags: [tag],
        estimatedMinutes: 15,
        setupMinutes: 15
      });
      order += 1;
      sceneShotIndex += 1;
    }
  }

  return shots;
}

export function buildStoryboardCards(shots: ProductionShot[]): StoryboardCard[] {
  return shots.map((shot, index) => ({
    id: `storyboard:${shot.id}`,
    shotId: shot.id,
    sceneId: shot.sceneId,
    sceneNumber: shot.sceneNumber,
    frameNumber: index + 1,
    frameLabel: shot.setup,
    caption: shot.label,
    visualBeat: shot.description,
    location: shot.location,
    timeOfDay: shot.timeOfDay,
    characters: shot.characters,
    tags: shot.tags.map(formatTagLabel)
  }));
}

export function buildStripboardSchedule(sceneGroups: ProductionSceneGroup[]): StripboardDay[] {
  return sceneGroups.map((group, index) => ({
    id: `shoot-day:${index + 1}`,
    shootDay: index + 1,
    location: group.location,
    timeOfDay: group.timeOfDay,
    scenes: group.scenes.map((scene) => ({
      id: scene.id,
      sceneNumber: scene.sceneNumber,
      heading: scene.heading,
      page: scene.page,
      estimatedPages: scene.estimatedPages,
      stripColor: scene.stripColor,
      characters: scene.characters,
      tags: scene.productionTags.map(formatTagLabel)
    })),
    sceneIds: group.sceneIds,
    cast: group.characters,
    departments: group.departments,
    tags: group.tags,
    totalPages: group.totalPages,
    estimatedHours: group.estimatedHours
  }));
}

export function buildProductionContacts(document: ScriptDocument, scenes: ProductionSceneBreakdown[]): ProductionContact[] {
  const contacts: ProductionContact[] = [];
  const author = (document.titlePage.author || document.author).trim();
  if (author) {
    contacts.push({
      id: 'contact:writer',
      name: author,
      role: 'Writer',
      department: 'Production',
      email: metadataValue(document.titlePage.fields, ['Email', 'email']),
      phone: metadataValue(document.titlePage.fields, ['Phone', 'phone'])
    });
  }

  const profileByName = new Map<string, CharacterProfile>();
  for (const profile of document.characters.filter((item) => !item.hidden)) {
    profileByName.set(normalizeCharacterName(profile.name), profile);
    for (const alias of profile.aliases) profileByName.set(normalizeCharacterName(alias), profile);
  }

  const characterNames: string[] = [];
  for (const scene of scenes) {
    for (const character of scene.characters) addUnique(characterNames, character);
  }
  for (const profile of document.characters.filter((item) => !item.hidden)) addUnique(characterNames, normalizeCharacterName(profile.name));

  for (const character of characterNames) {
    const profile = profileByName.get(character);
    const metadata = profile?.userMetadata ?? {};
    const displayName = profile?.name || character;
    contacts.push({
      id: `contact:cast:${profile?.id ?? slugify(character)}`,
      name: displayName,
      role: `Cast - ${character}`,
      department: 'Cast',
      characterName: character,
      email: metadataValue(metadata, ['email', 'Email']),
      phone: metadataValue(metadata, ['phone', 'Phone'])
    });
  }

  for (const category of collectUsedTagCategories(scenes)) {
    const department = DEPARTMENT_LABELS[category];
    if (contacts.some((contact) => contact.department === department && contact.role === 'Department')) continue;
    contacts.push({
      id: `contact:department:${category}`,
      name: `${department} Department`,
      role: 'Department',
      department
    });
  }

  return contacts;
}

export function buildCallSheetRecipients(contacts: ProductionContact[]): CallSheetRecipient[] {
  return contacts.map((contact) => ({
    id: `recipient:${contact.id}`,
    contactId: contact.id,
    name: contact.name,
    role: contact.role,
    department: contact.department,
    channel: contact.email ? 'email' : contact.phone ? 'phone' : 'manual',
    characterName: contact.characterName,
    email: contact.email,
    phone: contact.phone
  }));
}

export function buildCallSheetSummaries(
  document: ScriptDocument,
  schedule: StripboardDay[],
  recipients: CallSheetRecipient[]
): CallSheetSummary[] {
  return schedule.map((day) => {
    const dayRecipients = recipients.filter(
      (recipient) =>
        recipient.department === 'Production' ||
        day.departments.includes(recipient.department) ||
        day.cast.includes(recipient.characterName ?? recipient.name)
    );

    return {
      id: `call-sheet:${day.shootDay}`,
      projectTitle: document.title,
      shootDay: day.shootDay,
      title: `Day ${day.shootDay} - ${day.location}`,
      location: day.location,
      timeOfDay: day.timeOfDay,
      callTime: defaultCallTime(day.timeOfDay),
      scenes: day.scenes,
      cast: day.cast,
      departments: day.departments,
      recipients: dayRecipients,
      notes: [
        `${day.scenes.length} scene${day.scenes.length === 1 ? '' : 's'}`,
        `${day.totalPages} page${day.totalPages === 1 ? '' : 's'}`,
        `${day.estimatedHours} estimated hour${day.estimatedHours === 1 ? '' : 's'}`
      ]
    };
  });
}

function collectElementForScene(draft: SceneDraft, element: ScriptElement, profiles: CharacterProfile[]): void {
  if (element.type === 'character') {
    const character = resolveCharacterName(element.text, profiles);
    if (character) addUnique(draft.characters, character);
  }

  for (const tag of element.productionTags) addTagToDraft(draft, tag, element.id);
  draft.notes.push(...element.notes);
}

function finalizeSceneDraft(draft: SceneDraft): ProductionSceneBreakdown {
  const productionTags = Array.from(draft.tagMap.values()).sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

  return {
    id: draft.id,
    sceneNumber: draft.sceneNumber,
    heading: draft.heading,
    sceneType: draft.sceneType,
    location: draft.location,
    timeOfDay: draft.timeOfDay,
    page: draft.page,
    estimatedPages: estimatePageCount(draft.elements),
    actionSummary: summarizeScene(draft.elements),
    characters: draft.characters,
    productionTags,
    notes: draft.notes,
    elements: draft.elements,
    stripColor: stripColorFor(draft.sceneType, draft.timeOfDay)
  };
}

function addTagToDraft(draft: SceneDraft, tag: ProductionTag, elementId: string): void {
  const label = tag.label.trim() || 'Unlabeled';
  const key = `${tag.category}:${label.toLocaleLowerCase()}`;
  if (!draft.tagMap.has(key)) {
    draft.tagMap.set(key, {
      id: `tag:${tag.category}:${slugify(label)}`,
      category: tag.category,
      label,
      color: tag.color,
      count: 0,
      sceneIds: [draft.id],
      sceneHeadings: [draft.heading],
      elementIds: []
    });
  }

  const summary = draft.tagMap.get(key)!;
  summary.count += 1;
  summary.elementIds.push(elementId);
}

function collectBoardTags(scenes: ProductionSceneBreakdown[]): ProductionTagSummary[] {
  const tags = new Map<string, ProductionTagSummary>();

  for (const scene of scenes) {
    for (const tag of scene.productionTags) {
      const key = `${tag.category}:${tag.label.toLocaleLowerCase()}`;
      if (!tags.has(key)) {
        tags.set(key, {
          ...tag,
          count: 0,
          sceneIds: [],
          sceneHeadings: [],
          elementIds: []
        });
      }

      const boardTag = tags.get(key)!;
      boardTag.count += tag.count;
      for (const sceneId of tag.sceneIds) addUnique(boardTag.sceneIds, sceneId);
      for (const heading of tag.sceneHeadings) addUnique(boardTag.sceneHeadings, heading);
      boardTag.elementIds.push(...tag.elementIds);
    }
  }

  return Array.from(tags.values()).sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

function collectBoardCharacters(document: ScriptDocument, scenes: ProductionSceneBreakdown[]): ProductionCharacterSummary[] {
  const profiles = new Map<string, CharacterProfile>();
  for (const profile of document.characters.filter((item) => !item.hidden)) profiles.set(normalizeCharacterName(profile.name), profile);

  const characters = new Map<string, ProductionCharacterSummary>();
  for (const scene of scenes) {
    for (const character of scene.characters) {
      const profile = profiles.get(character);
      if (!characters.has(character)) {
        characters.set(character, {
          id: profile?.id ?? `character:${slugify(character)}`,
          name: profile?.name ?? character,
          color: profile?.color ?? '#2f6fed',
          sceneIds: [],
          speakingBlocks: 0
        });
      }
      const summary = characters.get(character)!;
      addUnique(summary.sceneIds, scene.id);
    }

    for (const element of scene.elements) {
      if (element.type !== 'character') continue;
      const character = normalizeCharacterName(element.text);
      if (characters.has(character)) characters.get(character)!.speakingBlocks += 1;
    }
  }

  for (const profile of document.characters.filter((item) => !item.hidden)) {
    const character = normalizeCharacterName(profile.name);
    if (!characters.has(character)) {
      characters.set(character, {
        id: profile.id,
        name: profile.name,
        color: profile.color,
        sceneIds: [],
        speakingBlocks: 0
      });
    }
  }

  return Array.from(characters.values()).sort((a, b) => b.sceneIds.length - a.sceneIds.length || a.name.localeCompare(b.name));
}

function collectUsedTagCategories(scenes: ProductionSceneBreakdown[]): ProductionTag['category'][] {
  const categories: ProductionTag['category'][] = [];
  for (const scene of scenes) {
    for (const tag of scene.productionTags) addUnique(categories, tag.category);
  }
  return categories;
}

function resolveCharacterName(text: string, profiles: CharacterProfile[]): string {
  const normalized = normalizeCharacterName(text);
  const profile = profiles.find(
    (item) => normalizeCharacterName(item.name) === normalized || item.aliases.some((alias) => normalizeCharacterName(alias) === normalized)
  );
  return profile ? normalizeCharacterName(profile.name) : normalized;
}

function summarizeScene(elements: ScriptElement[]): string {
  const candidate =
    elements.find((element) => (element.type === 'action' || element.type === 'general') && element.text.trim()) ??
    elements.find((element) => (element.type === 'shot' || element.type === 'dialogue') && element.text.trim());
  return compactText(candidate?.text ?? '');
}

function compactText(text: string): string {
  const compacted = text.replace(/\s+/g, ' ').trim();
  return compacted.length > 140 ? `${compacted.slice(0, 137)}...` : compacted;
}

function groupKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatTagLabel(tag: Pick<ProductionTagSummary, 'category' | 'label'>): string {
  return `${DEPARTMENT_LABELS[tag.category]}: ${tag.label}`;
}

function estimateSceneHours(scene: ProductionSceneBreakdown): number {
  const castLoad = scene.characters.length * 0.15;
  const tagLoad = scene.productionTags.length * 0.1;
  return roundToTenth(Math.max(0.75, scene.estimatedPages * 0.65 + castLoad + tagLoad));
}

function stripColorFor(sceneType: string, timeOfDay: string): string {
  if (/NIGHT|DUSK|EVENING/i.test(timeOfDay)) return '#9bb7d9';
  if (/DAWN|SUNRISE|MORNING/i.test(timeOfDay)) return '#f2c879';
  if (sceneType.startsWith('EXT')) return '#c8dfad';
  if (sceneType.startsWith('INT')) return '#f4e4a6';
  return '#d8c7ef';
}

function defaultCallTime(timeOfDay: string): string {
  if (/NIGHT|DUSK|EVENING/i.test(timeOfDay)) return '15:00';
  if (/DAWN|SUNRISE/i.test(timeOfDay)) return '05:30';
  return '07:00';
}

function shotSetupLabel(sceneNumber: number, shotIndex: number): string {
  return `${sceneNumber}${String.fromCharCode(64 + ((shotIndex - 1) % 26) + 1)}`;
}

function metadataValue(metadata: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = metadata[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) items.push(item);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function slugify(input: string): string {
  const slug = input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'item';
}
