import { findSpellingIssues, suggestSpelling } from './languageTools';
import type { ScriptDocument, ScriptElement, StoryCheckResult } from './types';

const COMMON_CORRECTIONS: Record<string, string[]> = {
  accomodate: ['accommodate'],
  acheive: ['achieve'],
  adress: ['address'],
  agressive: ['aggressive'],
  apparant: ['apparent'],
  alot: ['a lot'],
  amatuer: ['amateur'],
  becuase: ['because'],
  beleive: ['believe'],
  calender: ['calendar'],
  charcter: ['character'],
  charcters: ['characters'],
  concious: ['conscious'],
  definately: ['definitely'],
  dialoge: ['dialogue'],
  dissapear: ['disappear'],
  embarras: ['embarrass'],
  enviroment: ['environment'],
  exst: ['ext.'],
  finaly: ['finally'],
  freind: ['friend'],
  goverment: ['government'],
  happend: ['happened'],
  immediatly: ['immediately'],
  intt: ['int.'],
  knwo: ['know'],
  langauge: ['language'],
  liason: ['liaison'],
  millenium: ['millennium'],
  occassion: ['occasion'],
  occurence: ['occurrence'],
  persistant: ['persistent'],
  priviledge: ['privilege'],
  recieve: ['receive'],
  recomend: ['recommend'],
  rythym: ['rhythm'],
  seperate: ['separate'],
  scean: ['scene'],
  scen: ['scene'],
  suprise: ['surprise'],
  teh: ['the'],
  thier: ['their'],
  throught: ['through'],
  tommorow: ['tomorrow'],
  untill: ['until'],
  wierd: ['weird'],
  writting: ['writing']
};

const WORD_BANK = [
  'action',
  'again',
  'against',
  'amateur',
  'around',
  'because',
  'calendar',
  'camera',
  'character',
  'close',
  'conscious',
  'continue',
  'dialogue',
  'director',
  'disappear',
  'dissolve',
  'editing',
  'embarrass',
  'exterior',
  'finally',
  'friend',
  'government',
  'immediately',
  'inside',
  'interior',
  'language',
  'liaison',
  'location',
  'millennium',
  'moment',
  'occurrence',
  'persistent',
  'privilege',
  'receive',
  'recommend',
  'revision',
  'rhythm',
  'scene',
  'screenplay',
  'script',
  'separate',
  'surprise',
  'through',
  'transition',
  'until',
  'weird',
  'writing'
];

const STYLE_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  message: string;
  suggestion: string;
  severity: StoryCheckResult['severity'];
}> = [
  {
    pattern: /\bwe see\b/i,
    title: 'Camera phrase',
    message: '"We see" often adds distance in a spec read.',
    suggestion: 'Name the image directly unless the seeing itself is story-critical.',
    severity: 'note'
  },
  {
    pattern: /\b(camera|pan to|tilt to|close up|wide shot)\b/i,
    title: 'Director language',
    message: 'Shot direction can pull focus from the read unless it is essential.',
    suggestion: 'Consider expressing the shot as action or save the explicit shot for the shot list.',
    severity: 'note'
  },
  {
    pattern: /\b(starts to|begins to|continues to)\b/i,
    title: 'Soft action verb',
    message: 'Start/begin/continue can make action feel indirect.',
    suggestion: 'Use the action itself when the start is not the dramatic point.',
    severity: 'note'
  },
  {
    pattern: /\b(is being|was being|were being|are being)\b/i,
    title: 'Passive construction',
    message: 'Passive phrasing can hide who is driving the action.',
    suggestion: 'Give the action to a subject when possible.',
    severity: 'warning'
  },
  {
    pattern: /\b(feels|realizes|knows|understands)\b/i,
    title: 'Internal state',
    message: 'Internal verbs may not translate cleanly to screen.',
    suggestion: 'Make the realization visible through behavior, a line, or a reaction.',
    severity: 'note'
  }
];

export function suggestCorrections(word: string): string[] {
  const normalized = normalizeProofWord(word);
  if (!normalized || normalized.length < 2) return [];

  const direct = COMMON_CORRECTIONS[normalized];
  const embedded = direct ? [] : embeddedCorrections(normalized);
  if (direct || embedded.length) {
    const options = direct ?? embedded;
    return preserveCase(word, options).filter((option) => option.toLowerCase() !== normalized).slice(0, 7);
  }

  const robust = suggestSpelling(word);
  if (robust.length) return robust;

  const options = nearestWords(normalized);
  return preserveCase(word, options).filter((option) => option.toLowerCase() !== normalized).slice(0, 7);
}

export function correctionSpan(word: string): { start: number; end: number } {
  const normalized = normalizeProofWord(word);
  const lower = word.toLowerCase();
  if (!normalized) return { start: 0, end: word.length };
  if (COMMON_CORRECTIONS[normalized]) return { start: 0, end: word.length };

  const typo = Object.keys(COMMON_CORRECTIONS).find((item) => normalized.startsWith(item) || normalized.endsWith(item));
  if (!typo) return { start: 0, end: word.length };

  const start = Math.max(0, lower.indexOf(typo));
  return { start, end: start + typo.length };
}

export function scanProofingIssues(document: ScriptDocument): StoryCheckResult[] {
  return document.elements.flatMap((element) => [...styleIssuesForElement(element), ...spellingIssuesForElement(element)]);
}

export function styleIssuesForElement(element: ScriptElement): StoryCheckResult[] {
  if (!['action', 'general', 'shot', 'dialogue'].includes(element.type)) return [];
  return STYLE_PATTERNS.filter((item) => item.pattern.test(element.text)).map((item) => ({
    id: `proofing:${element.id}:${slugify(item.title)}`,
    category: 'proofing',
    severity: item.severity,
    title: item.title,
    message: item.message,
    suggestion: item.suggestion,
    elementId: element.id
  }));
}

export function spellingIssuesForElement(element: ScriptElement): StoryCheckResult[] {
  if (!['scene-heading', 'action', 'general', 'shot', 'dialogue', 'parenthetical'].includes(element.type)) return [];
  return findSpellingIssues(element.text, 4).map((issue) => ({
    id: `spelling:${element.id}:${issue.start}:${issue.word}`,
    category: 'proofing',
    severity: 'warning',
    title: `Possible typo: ${issue.word}`,
    message: issue.suggestions.length ? `Suggestions: ${issue.suggestions.slice(0, 4).join(', ')}` : 'The local US dictionary flagged this word.',
    suggestion: 'Use Ctrl+. on the word, right-click it, or use the spelling button to replace it from the editor.',
    elementId: element.id
  }));
}

function embeddedCorrections(word: string): string[] {
  return Object.entries(COMMON_CORRECTIONS)
    .filter(([typo]) => word.startsWith(typo) || word.endsWith(typo))
    .flatMap(([, corrections]) => corrections);
}

function nearestWords(word: string): string[] {
  return WORD_BANK.map((candidate) => ({ candidate, score: editDistance(word, candidate) }))
    .filter(({ candidate, score }) => score <= Math.max(2, Math.floor(candidate.length / 3)))
    .sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate))
    .map(({ candidate }) => candidate);
}

function normalizeProofWord(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z'.-]/g, '');
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function preserveCase(source: string, options: string[]): string[] {
  if (source === source.toUpperCase()) return options.map((option) => option.toUpperCase());
  if (/^[A-Z]/.test(source)) return options.map((option) => option.charAt(0).toUpperCase() + option.slice(1));
  return options;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
