import { normalizeCharacterName } from './screenplay';
import type { DialogueAnalysis, ScriptDocument, ScriptElement } from './types';

const STOP_WORDS = new Set(['the', 'and', 'but', 'you', 'that', 'this', 'with', 'for', 'from', 'are', 'was', 'were', 'have', 'has', 'had', 'not', 'just', 'your']);

export function analyzeDialogue(document: ScriptDocument): DialogueAnalysis[] {
  const linesByCharacter = new Map<string, string[]>();
  let activeCharacter = '';

  for (const element of document.elements) {
    if (element.type === 'character') {
      activeCharacter = normalizeCharacterName(element.text);
      if (activeCharacter && !linesByCharacter.has(activeCharacter)) linesByCharacter.set(activeCharacter, []);
      continue;
    }

    if (element.type !== 'dialogue' || !activeCharacter) continue;
    const text = element.text.trim();
    if (text) linesByCharacter.get(activeCharacter)?.push(text);
  }

  return Array.from(linesByCharacter.entries())
    .map(([characterName, lines]) => createDialogueAnalysis(characterName, lines))
    .sort((a, b) => b.wordCount - a.wordCount || a.characterName.localeCompare(b.characterName));
}

function createDialogueAnalysis(characterName: string, lines: string[]): DialogueAnalysis {
  const wordCount = lines.reduce((sum, line) => sum + words(line).length, 0);
  return {
    characterName,
    lineCount: lines.length,
    wordCount,
    averageWordsPerLine: lines.length ? Math.round((wordCount / lines.length) * 10) / 10 : 0,
    questionCount: lines.filter((line) => line.includes('?')).length,
    monologueCount: lines.filter((line) => words(line).length >= 45).length,
    repeatedPhrases: repeatedPhrases(lines),
    sampleLines: lines.slice(0, 3)
  };
}

function repeatedPhrases(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const lineWords = words(line).filter((word) => !STOP_WORDS.has(word));
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= lineWords.length - size; index += 1) {
        const phrase = lineWords.slice(index, index + size).join(' ');
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([phrase]) => phrase);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

export function dialogueBlocks(document: ScriptDocument): Array<{ character: string; dialogue: ScriptElement[] }> {
  const blocks: Array<{ character: string; dialogue: ScriptElement[] }> = [];
  let activeBlock: { character: string; dialogue: ScriptElement[] } | undefined;

  for (const element of document.elements) {
    if (element.type === 'character') {
      activeBlock = { character: normalizeCharacterName(element.text), dialogue: [] };
      blocks.push(activeBlock);
      continue;
    }
    if (element.type === 'dialogue' && activeBlock) activeBlock.dialogue.push(element);
    if (element.type !== 'dialogue' && element.type !== 'parenthetical') activeBlock = undefined;
  }

  return blocks.filter((block) => block.dialogue.length);
}
