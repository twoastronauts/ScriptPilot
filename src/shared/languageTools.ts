import nspell from 'nspell';
import externalSynonyms from 'synonyms';
import aff from '../../node_modules/dictionary-en/index.aff?raw';
import dic from '../../node_modules/dictionary-en/index.dic?raw';

type SynonymPart = 'n' | 'v' | 'a' | 's' | 'r';

export interface SynonymGroup {
  label: string;
  words: string[];
}

export interface SpellIssue {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

const spell = nspell(aff, dic);

const SCREENPLAY_TERMS = [
  'INT',
  'EXT',
  'EST',
  'VO',
  'OS',
  'OC',
  'CONT',
  'CONTINUED',
  'MONTAGE',
  'SMASH',
  'CUTAWAY',
  'INTERCUT',
  'SUPER',
  'TITLECARD',
  'SCRIPTNOTE',
  'BEATBOARD',
  'FDX',
  'SPX',
  'SPX2'
];

const CUSTOM_CORRECTIONS: Record<string, string[]> = {
  accomodate: ['accommodate'],
  acheive: ['achieve'],
  adress: ['address'],
  agressive: ['aggressive'],
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

const LOCAL_SYNONYMS: Record<string, string[]> = {
  feel: ['register', 'sense', 'betray', 'reveal', 'land'],
  look: ['glance', 'stare', 'study', 'peer', 'clock', 'scan'],
  walk: ['stride', 'cross', 'pace', 'stalk', 'wander', 'drift'],
  run: ['sprint', 'bolt', 'dash', 'race', 'charge', 'flee'],
  say: ['murmur', 'whisper', 'reply', 'insist', 'snap', 'admit'],
  quiet: ['silent', 'hushed', 'still', 'muted', 'wordless'],
  afraid: ['scared', 'fearful', 'uneasy', 'terrified', 'rattled'],
  angry: ['furious', 'livid', 'heated', 'incensed', 'irritated'],
  good: ['strong', 'sharp', 'clean', 'effective', 'solid'],
  bad: ['weak', 'rough', 'grim', 'awful', 'poor'],
  need: ['require', 'crave', 'lack', 'depend on', 'want'],
  want: ['desire', 'seek', 'crave', 'long for', 'need']
};

const PART_LABELS: Record<SynonymPart, string> = {
  n: 'Nouns',
  v: 'Verbs',
  a: 'Adjectives',
  s: 'Related',
  r: 'Adverbs'
};

export function isCorrectlySpelled(word: string): boolean {
  const normalized = normalizeSpellWord(word);
  if (!normalized || normalized.length < 2) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (SCREENPLAY_TERMS.includes(normalized.toUpperCase())) return true;
  if (CUSTOM_CORRECTIONS[normalized.toLowerCase()]) return false;
  return spell.correct(normalized) || spell.correct(normalized.toLowerCase()) || spell.correct(normalized.toUpperCase());
}

export function suggestSpelling(word: string): string[] {
  const normalized = normalizeSpellWord(word);
  if (!normalized || normalized.length < 2) return [];
  const lower = normalized.toLowerCase();
  const custom = CUSTOM_CORRECTIONS[lower] ?? [];
  const hunspell = spell.suggest(normalized).concat(spell.suggest(lower)).slice(0, 12);
  const options = unique([...custom, ...hunspell]).filter((option) => option.toLowerCase() !== lower);
  return preserveCase(word, options).slice(0, 8);
}

export function findSpellingIssues(text: string, limit = 50): SpellIssue[] {
  const issues: SpellIssue[] = [];
  for (const match of text.matchAll(/[A-Za-z][A-Za-z'.-]*/g)) {
    const word = match[0];
    const start = match.index ?? 0;
    if (isCorrectlySpelled(word)) continue;
    const suggestions = suggestSpelling(word);
    if (!suggestions.length) continue;
    issues.push({ word, start, end: start + word.length, suggestions });
    if (issues.length >= limit) break;
  }
  return issues;
}

export function suggestSynonymGroups(word: string): SynonymGroup[] {
  const normalized = normalizeLookupWord(word);
  if (!normalized) return [];

  const groups: SynonymGroup[] = [];
  const lookupWords = lookupForms(normalized);
  const external = lookupWords.map((lookup) => externalSynonyms(lookup)).find(Boolean);

  if (external && !Array.isArray(external)) {
    for (const part of ['v', 'n', 'a', 's', 'r'] as SynonymPart[]) {
      const words = cleanSynonyms(external[part] ?? [], normalized);
      if (words.length) groups.push({ label: PART_LABELS[part], words });
    }
  } else if (Array.isArray(external)) {
    const words = cleanSynonyms(external, normalized);
    if (words.length) groups.push({ label: 'Matches', words });
  }

  const localWords = lookupWords.flatMap((lookup) => LOCAL_SYNONYMS[lookup] ?? []);
  const cleanedLocal = cleanSynonyms(localWords, normalized);
  if (cleanedLocal.length) groups.unshift({ label: 'Screenplay verbs', words: cleanedLocal });

  return mergeGroups(groups, word).slice(0, 5);
}

export function suggestSynonymsFlat(word: string, limit = 16): string[] {
  return suggestSynonymGroups(word).flatMap((group) => group.words).slice(0, limit);
}

function mergeGroups(groups: SynonymGroup[], originalWord: string): SynonymGroup[] {
  const seen = new Set<string>();
  return groups
    .map((group) => ({
      ...group,
      words: preserveCase(originalWord, group.words).filter((word) => {
        const key = word.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    }))
    .filter((group) => group.words.length);
}

function cleanSynonyms(words: string[], normalized: string): string[] {
  return unique(
    words
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word && word !== normalized && /^[a-z][a-z' -]+$/.test(word))
      .filter((word) => word.length <= 28)
  );
}

function lookupForms(word: string): string[] {
  const forms = [word];
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    forms.push(stem, stem + 'e');
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) forms.push(stem.slice(0, -1));
  }
  if (word.endsWith('ed') && word.length > 4) forms.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith('es') && word.length > 4) forms.push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) forms.push(word.slice(0, -1));
  return unique(forms);
}

function normalizeSpellWord(word: string): string {
  return word.trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/[.']/g, '');
}

function normalizeLookupWord(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z'-]/g, '');
}

function preserveCase(source: string, options: string[]): string[] {
  if (source === source.toUpperCase()) return options.map((option) => option.toUpperCase());
  if (/^[A-Z]/.test(source)) return options.map((option) => option.charAt(0).toUpperCase() + option.slice(1));
  return options;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
