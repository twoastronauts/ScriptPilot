import { analyzeDialogue } from './dialogueStudio';
import { findSpellingIssues } from './languageTools';
import { collectProductionScenes } from './productionSuite';
import { suggestSynonyms } from './synonyms';
import { analyzeScript } from './storyAssistant';
import type { DialogueAnalysis, ScriptDocument, ScriptElement, StoryCheckResult } from './types';

export interface OverusedWordIssue {
  word: string;
  count: number;
  density: number;
  severity: 'note' | 'warning' | 'strong';
  elementIds: string[];
  suggestions: string[];
  message: string;
}

export interface ScriptDoctorReport {
  score: number;
  grade: 'Polished' | 'Solid' | 'Needs Pass' | 'Needs Surgery';
  summary: string[];
  checks: StoryCheckResult[];
  overusedWords: OverusedWordIssue[];
  dialogue: DialogueAnalysis[];
  spellingIssueCount: number;
  sceneCount: number;
  wordCount: number;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'he',
  'her',
  'his',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'she',
  'that',
  'the',
  'their',
  'they',
  'this',
  'to',
  'was',
  'we',
  'with',
  'you'
]);

const WEAK_SCREENPLAY_WORDS = new Map<string, string>([
  ['just', 'Usually weakens urgency. Cut it unless the character is minimizing something.'],
  ['really', 'Often asks the reader to feel intensity instead of showing it.'],
  ['very', 'Replace with a stronger image or verb.'],
  ['suddenly', 'The moment should feel sudden from the action itself.'],
  ['then', 'Often creates a list instead of a moving image.'],
  ['starts', 'Use the action unless the start itself matters.'],
  ['begins', 'Use the action unless hesitation is the point.'],
  ['continues', 'Check whether the beat can be fresher or more specific.'],
  ['looks', 'Try a sharper reaction, choice, or visual behavior.'],
  ['sees', 'Name the image directly when possible.'],
  ['feels', 'Make the emotion visible through action or subtext.'],
  ['smiles', 'If repeated, vary the behavior or make it more specific.'],
  ['nods', 'A frequent placeholder reaction. Try a choice or interruption.'],
  ['turns', 'Useful, but easy to overuse as blocking filler.'],
  ['slowly', 'If pace matters, express it through the image.'],
  ['quickly', 'If speed matters, use a sharper verb.']
]);

export function runScriptDoctor(document: ScriptDocument): ScriptDoctorReport {
  const checks = analyzeScript(document);
  const overusedWords = analyzeOverusedWords(document);
  const dialogue = analyzeDialogue(document);
  const scenes = collectProductionScenes(document);
  const spellingIssueCount = document.elements.reduce((sum, element) => sum + findSpellingIssues(element.text, 20).length, 0);
  const wordCount = countWords(document.elements.map((element) => element.text).join(' '));

  const strong = checks.filter((check) => check.severity === 'strong').length;
  const warnings = checks.filter((check) => check.severity === 'warning').length + overusedWords.filter((issue) => issue.severity !== 'note').length;
  const score = clamp(100 - strong * 12 - warnings * 5 - spellingIssueCount * 2, 0, 100);
  const grade = score >= 88 ? 'Polished' : score >= 72 ? 'Solid' : score >= 55 ? 'Needs Pass' : 'Needs Surgery';

  return {
    score,
    grade,
    summary: buildSummary({ checks, overusedWords, spellingIssueCount, dialogue, sceneCount: scenes.length }),
    checks,
    overusedWords,
    dialogue,
    spellingIssueCount,
    sceneCount: scenes.length,
    wordCount
  };
}

export function analyzeOverusedWords(document: ScriptDocument): OverusedWordIssue[] {
  const counts = new Map<string, { count: number; elementIds: Set<string> }>();
  const relevantElements = document.elements.filter((element) => ['action', 'dialogue', 'general', 'shot'].includes(element.type));

  for (const element of relevantElements) {
    for (const word of words(element.text)) {
      if (STOP_WORDS.has(word)) continue;
      const entry = counts.get(word) ?? { count: 0, elementIds: new Set<string>() };
      entry.count += 1;
      entry.elementIds.add(element.id);
      counts.set(word, entry);
    }
  }

  const totalWords = Math.max(1, relevantElements.reduce((sum, element) => sum + words(element.text).length, 0));
  const issues = Array.from(counts.entries())
    .map(([word, entry]) => toOverusedIssue(word, entry.count, totalWords, Array.from(entry.elementIds)))
    .filter((issue): issue is OverusedWordIssue => Boolean(issue))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count || a.word.localeCompare(b.word));

  return issues.slice(0, 18);
}

function toOverusedIssue(word: string, count: number, totalWords: number, elementIds: string[]): OverusedWordIssue | undefined {
  const density = count / totalWords;
  const weakMessage = WEAK_SCREENPLAY_WORDS.get(word);
  const isWeak = Boolean(weakMessage);
  const countThreshold = isWeak ? 3 : totalWords > 700 ? 8 : 5;
  const densityThreshold = isWeak ? 0.006 : 0.014;
  if (count < countThreshold && density < densityThreshold) return undefined;

  const severity: OverusedWordIssue['severity'] = count >= countThreshold * 2 || density >= densityThreshold * 2 ? 'strong' : isWeak ? 'warning' : 'note';
  return {
    word,
    count,
    density: Math.round(density * 1000) / 10,
    severity,
    elementIds,
    suggestions: suggestSynonyms(word).slice(0, 6),
    message: weakMessage ?? 'This word appears often enough that the read may start to feel repetitive.'
  };
}

function buildSummary(input: {
  checks: StoryCheckResult[];
  overusedWords: OverusedWordIssue[];
  spellingIssueCount: number;
  dialogue: DialogueAnalysis[];
  sceneCount: number;
}): string[] {
  const summary: string[] = [];
  const strong = input.checks.filter((check) => check.severity === 'strong');
  const warnings = input.checks.filter((check) => check.severity === 'warning');
  if (!input.sceneCount) summary.push('Add scene headings first so Script Doctor can evaluate structure, pacing, and scene work.');
  if (strong[0]) summary.push(`Top priority: ${strong[0].title}. ${strong[0].suggestion}`);
  else if (warnings[0]) summary.push(`First pass: ${warnings[0].title}. ${warnings[0].suggestion}`);
  if (input.overusedWords[0]) summary.push(`Language pass: "${input.overusedWords[0].word}" appears ${input.overusedWords[0].count} times. ${input.overusedWords[0].message}`);
  if (input.spellingIssueCount) summary.push(`Proofing pass: ${input.spellingIssueCount} possible spelling issue${input.spellingIssueCount === 1 ? '' : 's'} found by the local US dictionary.`);
  const dialogueWarning = input.dialogue.find((item) => item.monologueCount > 0 || item.repeatedPhrases.length > 2);
  if (dialogueWarning) summary.push(`Dialogue pass: ${dialogueWarning.characterName} may need a rhythm polish.`);
  if (!summary.length) summary.push('No major doctor notes. Keep writing, then run another pass after the next scene turn.');
  return summary.slice(0, 4);
}

function severityRank(severity: OverusedWordIssue['severity']): number {
  if (severity === 'strong') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z']*/g) ?? [];
}

function countWords(text: string): number {
  return words(text).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
