export type TranslationLanguage = 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja';

export const TRANSLATION_LANGUAGES: Array<{ code: TranslationLanguage; label: string; pair: string }> = [
  { code: 'es', label: 'Spanish', pair: 'en|es' },
  { code: 'fr', label: 'French', pair: 'en|fr' },
  { code: 'de', label: 'German', pair: 'en|de' },
  { code: 'it', label: 'Italian', pair: 'en|it' },
  { code: 'pt', label: 'Portuguese', pair: 'en|pt' },
  { code: 'ja', label: 'Japanese', pair: 'en|ja' }
];

const offlineGlossary: Record<TranslationLanguage, Record<string, string>> = {
  es: {
    hello: 'hola',
    goodbye: 'adios',
    yes: 'si',
    no: 'no',
    night: 'noche',
    day: 'dia',
    interior: 'interior',
    exterior: 'exterior',
    cut: 'corte',
    scene: 'escena',
    action: 'accion',
    love: 'amor',
    danger: 'peligro',
    run: 'correr',
    stop: 'alto'
  },
  fr: {
    hello: 'bonjour',
    goodbye: 'au revoir',
    yes: 'oui',
    no: 'non',
    night: 'nuit',
    day: 'jour',
    interior: 'interieur',
    exterior: 'exterieur',
    cut: 'coupe',
    scene: 'scene',
    action: 'action',
    love: 'amour',
    danger: 'danger',
    run: 'courir',
    stop: 'arrete'
  },
  de: {
    hello: 'hallo',
    goodbye: 'auf wiedersehen',
    yes: 'ja',
    no: 'nein',
    night: 'nacht',
    day: 'tag',
    interior: 'innen',
    exterior: 'aussen',
    cut: 'schnitt',
    scene: 'szene',
    action: 'handlung',
    love: 'liebe',
    danger: 'gefahr',
    run: 'laufen',
    stop: 'stopp'
  },
  it: {
    hello: 'ciao',
    goodbye: 'addio',
    yes: 'si',
    no: 'no',
    night: 'notte',
    day: 'giorno',
    interior: 'interno',
    exterior: 'esterno',
    cut: 'taglio',
    scene: 'scena',
    action: 'azione',
    love: 'amore',
    danger: 'pericolo',
    run: 'correre',
    stop: 'ferma'
  },
  pt: {
    hello: 'ola',
    goodbye: 'adeus',
    yes: 'sim',
    no: 'nao',
    night: 'noite',
    day: 'dia',
    interior: 'interior',
    exterior: 'exterior',
    cut: 'corte',
    scene: 'cena',
    action: 'acao',
    love: 'amor',
    danger: 'perigo',
    run: 'correr',
    stop: 'pare'
  },
  ja: {
    hello: 'konnichiwa',
    goodbye: 'sayonara',
    yes: 'hai',
    no: 'iie',
    night: 'yoru',
    day: 'hiru',
    interior: 'okunai',
    exterior: 'okugai',
    cut: 'katto',
    scene: 'shiin',
    action: 'akushon',
    love: 'ai',
    danger: 'kiken',
    run: 'hashiru',
    stop: 'tomare'
  }
};

export async function translateText(text: string, language: TranslationLanguage): Promise<string> {
  const normalized = text.trim();
  if (!normalized) return '';

  const online = await translateOnline(normalized, language);
  if (online) return online;

  const offline = translateOffline(normalized, language);
  if (offline) return offline;

  throw new Error('No free translation result was available. Check internet access or try a shorter selected phrase.');
}

async function translateOnline(text: string, language: TranslationLanguage): Promise<string | undefined> {
  const target = TRANSLATION_LANGUAGES.find((item) => item.code === language);
  if (!target || typeof fetch === 'undefined') return undefined;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent(target.pair)}`;
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText?.trim();
    if (!translated || translated.toLowerCase() === text.toLowerCase()) return undefined;
    return translated;
  } catch {
    return undefined;
  }
}

function translateOffline(text: string, language: TranslationLanguage): string | undefined {
  const glossary = offlineGlossary[language];
  const translated = text.replace(/[A-Za-z]+/g, (word) => {
    const replacement = glossary[word.toLowerCase()];
    if (!replacement) return word;
    return preserveCase(word, replacement);
  });
  return translated !== text ? translated : undefined;
}

function preserveCase(source: string, target: string): string {
  if (source.toUpperCase() === source) return target.toUpperCase();
  if (source[0]?.toUpperCase() === source[0]) return `${target.charAt(0).toUpperCase()}${target.slice(1)}`;
  return target;
}
