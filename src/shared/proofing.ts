const COMMON_CORRECTIONS: Record<string, string[]> = {
  accomodate: ['accommodate'],
  acheive: ['achieve'],
  adress: ['address'],
  agressive: ['aggressive'],
  apparant: ['apparent'],
  becuase: ['because'],
  beleive: ['believe'],
  charcter: ['character'],
  charcters: ['characters'],
  definately: ['definitely'],
  dialoge: ['dialogue'],
  enviroment: ['environment'],
  exst: ['ext.'],
  freind: ['friend'],
  happend: ['happened'],
  intt: ['int.'],
  knwo: ['know'],
  langauge: ['language'],
  occassion: ['occasion'],
  persistant: ['persistent'],
  recieve: ['receive'],
  seperate: ['separate'],
  scean: ['scene'],
  scen: ['scene'],
  teh: ['the'],
  thier: ['their'],
  throught: ['through'],
  tommorow: ['tomorrow'],
  wierd: ['weird'],
  writting: ['writing']
};

const WORD_BANK = [
  'action',
  'again',
  'against',
  'around',
  'because',
  'camera',
  'character',
  'close',
  'continue',
  'dialogue',
  'director',
  'dissolve',
  'editing',
  'exterior',
  'friend',
  'inside',
  'interior',
  'language',
  'location',
  'moment',
  'persistent',
  'receive',
  'revision',
  'scene',
  'screenplay',
  'script',
  'separate',
  'through',
  'transition',
  'weird',
  'writing'
];

export function suggestCorrections(word: string): string[] {
  const normalized = normalizeProofWord(word);
  if (!normalized || normalized.length < 2) return [];

  const direct = COMMON_CORRECTIONS[normalized];
  const embedded = direct ? [] : embeddedCorrections(normalized);
  const options = direct ?? (embedded.length ? embedded : nearestWords(normalized));
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
