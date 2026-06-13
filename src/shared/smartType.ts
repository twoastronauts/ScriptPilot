import { normalizeCharacterName } from './screenplay';
import type { ScriptDocument, ScriptElementType } from './types';

export type SmartTypeKind = 'scene-heading' | 'character' | 'transition';

export interface SmartTypeOption {
  id: string;
  label: string;
  detail: string;
  replacement: string;
  targetType: ScriptElementType;
  kind: SmartTypeKind;
}

const SCENE_PREFIXES = ['INT.', 'EXT.', 'EST.', 'INT./EXT.', 'I/E.'];
const TIMES_OF_DAY = ['DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'SAME TIME'];
export const TRANSITIONS = [
  'CUT TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'HARD CUT TO:',
  'QUICK CUT TO:',
  'DISSOLVE TO:',
  'FADE IN:',
  'FADE OUT:',
  'FADE TO BLACK:',
  'FADE TO WHITE:',
  'WIPE TO:',
  'IRIS IN:',
  'IRIS OUT:',
  'FREEZE FRAME:',
  'TIME CUT:',
  'BACK TO:',
  'CUTAWAY TO:',
  'MONTAGE:',
  'END MONTAGE:'
];

export function collectSmartTypeOptions(document: ScriptDocument, currentType: ScriptElementType, query: string): SmartTypeOption[] {
  if (!document.settings.smartType) return [];

  const normalizedQuery = query.trim().toUpperCase();
  if (currentType === 'transition' && TRANSITIONS.includes(normalizedQuery)) return [];

  const showAllTransitions = currentType === 'transition' && !normalizedQuery;
  const filterQuery = showAllTransitions ? '' : normalizedQuery;
  const options: SmartTypeOption[] = [];

  if ((currentType === 'scene-heading' || currentType === 'action' || currentType === 'general') && looksLikeSceneHeadingStart(normalizedQuery)) {
    options.push(...sceneHeadingOptions(document, normalizedQuery));
  }

  if (currentType === 'character' && looksLikeCharacterStart(normalizedQuery, currentType)) {
    options.push(...characterOptions(document, normalizedQuery));
  }

  if (currentType === 'transition' || looksLikeTransitionStart(normalizedQuery)) {
    options.push(...transitionOptions(normalizedQuery, showAllTransitions));
  }

  const seen = new Set<string>();
  return options
    .filter((option) => {
      const key = `${option.kind}:${option.replacement}`;
      if (seen.has(key)) return false;
      seen.add(key);
      if (filterQuery && option.replacement === filterQuery) return false;
      return matchesQuery(option.replacement, filterQuery);
    })
    .slice(0, showAllTransitions ? options.length : 9);
}

export function extractSceneParts(heading: string): { prefix: string; location: string; time: string } | undefined {
  const match = heading.trim().match(/^(INT\.\/EXT\.|INT\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.)\s*(.*?)(?:\s+-\s+([A-Z0-9 /.'-]+))?$/i);
  if (!match) return undefined;

  return {
    prefix: normalizeScenePrefix(match[1]),
    location: (match[2] ?? '').trim().toUpperCase(),
    time: (match[3] ?? '').trim().toUpperCase()
  };
}

function sceneHeadingOptions(document: ScriptDocument, query: string): SmartTypeOption[] {
  const sceneParts = document.elements
    .filter((element) => element.type === 'scene-heading')
    .map((element) => extractSceneParts(element.text))
    .filter(Boolean) as Array<{ prefix: string; location: string; time: string }>;

  const existingHeadings = document.elements
    .filter((element) => element.type === 'scene-heading')
    .map((element) => element.text.trim().toUpperCase())
    .filter(Boolean)
    .map((heading) => option('scene-heading', heading, 'Existing scene', heading, 'scene-heading'));

  const prefixOptions = SCENE_PREFIXES.map((prefix) => option('scene-heading', prefix, 'Scene prefix', prefix, 'scene-heading'));
  const locationOptions = sceneParts
    .filter((part) => part.location)
    .flatMap((part) => {
      const prefix = findScenePrefix(query) ?? part.prefix;
      return TIMES_OF_DAY.map((time) =>
        option('scene-heading', `${prefix} ${part.location} - ${time}`, 'Known location', `${prefix} ${part.location} - ${time}`, 'scene-heading')
      );
    });

  const timeOptions = findScenePrefix(query)
    ? TIMES_OF_DAY.map((time) => {
        const stem = query.includes(' - ') ? query.split(' - ')[0] : query;
        return option('scene-heading', `${stem} - ${time}`, 'Time of day', `${stem} - ${time}`, 'scene-heading');
      })
    : [];

  return [...prefixOptions, ...existingHeadings, ...locationOptions, ...timeOptions];
}

function characterOptions(document: ScriptDocument, query: string): SmartTypeOption[] {
  const profileNames = document.characters.flatMap((character) => [character.name, ...character.aliases]);
  const scriptNames = document.elements.filter((element) => element.type === 'character').map((element) => normalizeCharacterName(element.text));
  return Array.from(new Set([...profileNames, ...scriptNames]))
    .filter(Boolean)
    .map((name) => option('character', name, 'Character', name, 'character'))
    .filter((item) => query.length > 0 || item.label.length > 0);
}

function transitionOptions(query: string, showAll = false): SmartTypeOption[] {
  return TRANSITIONS.map((transition) => option('transition', transition, transitionDetail(transition), transition, 'transition')).filter(
    (item) => showAll || query.length > 0 || item.label === 'CUT TO:'
  );
}

function option(kind: SmartTypeKind, label: string, detail: string, replacement: string, targetType: ScriptElementType): SmartTypeOption {
  return {
    id: `${kind}:${replacement}`,
    kind,
    label,
    detail,
    replacement,
    targetType
  };
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true;
  if (value.startsWith(query)) return true;
  return value.includes(query);
}

function findScenePrefix(query: string): string | undefined {
  if (query.startsWith('INT/EXT.')) return 'INT./EXT.';
  return SCENE_PREFIXES.find((prefix) => query.startsWith(prefix));
}

function looksLikeSceneHeadingStart(query: string): boolean {
  if (!query) return false;
  return (
    SCENE_PREFIXES.some((prefix) => prefix.startsWith(query) || query.startsWith(prefix)) ||
    /^(I|IN|INT|INT\.|INT\/|INT\.\/|INT\/EXT\.?|E|EX|EXT|EXT\.|ES|EST|EST\.|I\/|I\/E|I\/E\.)$/.test(query)
  );
}

function looksLikeCharacterStart(query: string, currentType: ScriptElementType): boolean {
  if (currentType === 'dialogue' || currentType === 'parenthetical') return false;
  return /^[A-Z][A-Z0-9 .'()-]{0,28}$/.test(query) && !looksLikeSceneHeadingStart(query);
}

function looksLikeTransitionStart(query: string): boolean {
  if (query.length < 2) return false;
  return TRANSITIONS.some((transition) => transition.startsWith(query)) || /^(TO:|FADE|CUT|SMASH|MATCH|JUMP|HARD|QUICK|DISSOLVE|WIPE|IRIS|FREEZE|MONTAGE|END MONTAGE)/.test(query);
}

function transitionDetail(transition: string): string {
  if (transition.includes('SMASH')) return 'Abrupt impact';
  if (transition.includes('MATCH')) return 'Visual match';
  if (transition.includes('JUMP') || transition.includes('TIME')) return 'Time skip';
  if (transition.includes('DISSOLVE')) return 'Soft passage';
  if (transition.includes('FADE')) return 'Fade';
  if (transition.includes('WIPE') || transition.includes('IRIS')) return 'Stylized';
  if (transition.includes('MONTAGE')) return 'Montage';
  return 'Transition';
}

function normalizeScenePrefix(prefix: string): string {
  const normalized = prefix.toUpperCase();
  if (normalized === 'INT/EXT.') return 'INT./EXT.';
  return normalized;
}
