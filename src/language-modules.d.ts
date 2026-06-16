declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  export default function nspell(aff: string | Uint8Array, dic: string | Uint8Array): NSpell;
}

declare module 'synonyms' {
  type SynonymParts = Partial<Record<'n' | 'v' | 'a' | 's' | 'r', string[]>>;
  interface SynonymsFn {
    (word: string, partOfSpeech?: keyof SynonymParts): SynonymParts | string[] | undefined;
    dictionary?: Record<string, SynonymParts>;
  }
  const synonyms: SynonymsFn;
  export default synonyms;
}
