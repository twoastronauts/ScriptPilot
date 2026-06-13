import { estimatePageCount, normalizeCharacterName } from './screenplay';
import type { ScriptDocument, ScriptElement } from './types';

export interface CharacterStat {
  name: string;
  dialogueBlocks: number;
  estimatedLines: number;
  scenes: number;
  interactions: string[];
}

export interface SceneStat {
  id: string;
  heading: string;
  page: number;
  characters: string[];
  productionTagCount: number;
  noteCount: number;
}

export interface WritingStats {
  pages: number;
  words: number;
  scenes: number;
  notes: number;
  tags: number;
  writingSeconds: number;
  pagesAdded: number;
  streakDays: number;
  characters: CharacterStat[];
  scenesList: SceneStat[];
}

export function computeWritingStats(document: ScriptDocument): WritingStats {
  const words = document.elements.reduce((sum, element) => sum + countWords(element.text), 0);
  const scenesList = collectScenes(document.elements);
  const characters = collectCharacterStats(document.elements, scenesList);
  const writingSeconds = document.writingSessions.reduce((sum, session) => sum + session.seconds, 0);
  const pagesAdded = document.writingSessions.reduce((sum, session) => sum + session.pagesAdded, 0);

  return {
    pages: estimatePageCount(document.elements),
    words,
    scenes: scenesList.length,
    notes: document.elements.reduce((sum, element) => sum + element.notes.length, 0),
    tags: document.elements.reduce((sum, element) => sum + element.productionTags.length, 0),
    writingSeconds,
    pagesAdded,
    streakDays: computeStreak(document.writingSessions.map((session) => session.startedAt)),
    characters,
    scenesList
  };
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function collectScenes(elements: ScriptElement[]): SceneStat[] {
  const scenes: SceneStat[] = [];
  let current: SceneStat | undefined;
  let page = 1;

  for (const element of elements) {
    if (element.type === 'page-break') page += 1;
    if (element.type === 'scene-heading') {
      current = {
        id: element.id,
        heading: element.text,
        page,
        characters: [],
        productionTagCount: element.productionTags.length,
        noteCount: element.notes.length
      };
      scenes.push(current);
      continue;
    }

    if (!current) continue;
    if (element.type === 'character') {
      const name = normalizeCharacterName(element.text);
      if (name && !current.characters.includes(name)) current.characters.push(name);
    }
    current.productionTagCount += element.productionTags.length;
    current.noteCount += element.notes.length;
  }

  return scenes;
}

function collectCharacterStats(elements: ScriptElement[], scenes: SceneStat[]): CharacterStat[] {
  const stats = new Map<string, CharacterStat>();
  let activeCharacter = '';

  for (const element of elements) {
    if (element.type === 'character') {
      activeCharacter = normalizeCharacterName(element.text);
      if (!stats.has(activeCharacter)) {
        stats.set(activeCharacter, { name: activeCharacter, dialogueBlocks: 0, estimatedLines: 0, scenes: 0, interactions: [] });
      }
      stats.get(activeCharacter)!.dialogueBlocks += 1;
      continue;
    }

    if (element.type === 'dialogue' && activeCharacter && stats.has(activeCharacter)) {
      stats.get(activeCharacter)!.estimatedLines += Math.max(1, Math.ceil(element.text.length / 36));
    }

    if (element.type !== 'parenthetical' && element.type !== 'dialogue') activeCharacter = '';
  }

  for (const scene of scenes) {
    for (const name of scene.characters) {
      const stat = stats.get(name);
      if (!stat) continue;
      stat.scenes += 1;
      for (const other of scene.characters) {
        if (other !== name && !stat.interactions.includes(other)) stat.interactions.push(other);
      }
    }
  }

  return Array.from(stats.values()).sort((a, b) => b.estimatedLines - a.estimatedLines);
}

function computeStreak(dates: string[]): number {
  const dayKeys = new Set(dates.map((date) => new Date(date).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();

  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
