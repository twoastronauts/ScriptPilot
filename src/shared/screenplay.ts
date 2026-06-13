import type { ScriptElement, ScriptElementType } from './types';

export const ELEMENT_LABELS: Record<ScriptElementType, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  'page-break': 'Page Break'
};

export const FDX_TYPE_TO_ELEMENT: Record<string, ScriptElementType> = {
  'Scene Heading': 'scene-heading',
  Action: 'action',
  Character: 'character',
  Parenthetical: 'parenthetical',
  Dialogue: 'dialogue',
  Transition: 'transition',
  Shot: 'shot',
  General: 'general',
  'Page Break': 'page-break'
};

export const ELEMENT_TO_FDX_TYPE: Record<ScriptElementType, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  'page-break': 'Page Break'
};

export function nextElementType(current: ScriptElementType, text = ''): ScriptElementType {
  if (current === 'scene-heading') return 'action';
  if (current === 'character') return 'dialogue';
  if (current === 'parenthetical') return 'dialogue';
  if (current === 'dialogue') return text.trim().endsWith(')') ? 'dialogue' : 'action';
  if (current === 'transition') return 'scene-heading';
  if (current === 'shot') return 'action';
  return 'action';
}

export function tabElementType(current: ScriptElementType, direction: 1 | -1 = 1): ScriptElementType {
  const forward: Record<ScriptElementType, ScriptElementType> = {
    'scene-heading': 'action',
    action: 'character',
    character: 'parenthetical',
    parenthetical: 'dialogue',
    dialogue: 'parenthetical',
    transition: 'scene-heading',
    shot: 'action',
    general: 'action',
    'page-break': 'action'
  };
  const reverse: Record<ScriptElementType, ScriptElementType> = {
    'scene-heading': 'transition',
    action: 'scene-heading',
    character: 'action',
    parenthetical: 'character',
    dialogue: 'character',
    transition: 'action',
    shot: 'action',
    general: 'action',
    'page-break': 'action'
  };

  return direction > 0 ? forward[current] : reverse[current];
}

export function inferElementType(line: string, previous?: ScriptElementType): ScriptElementType {
  const trimmed = line.trim();
  if (!trimmed) return previous === 'character' ? 'dialogue' : 'action';
  if (/^(INT\.|EXT\.|EST\.|INT\/EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(trimmed)) return 'scene-heading';
  if (isLikelyTransition(trimmed)) return 'transition';
  if (/^\(.+\)$/.test(trimmed)) return 'parenthetical';
  if (isLikelyCharacterCue(trimmed)) return 'character';
  return previous === 'character' || previous === 'parenthetical' ? 'dialogue' : 'action';
}

export function isLikelyTransition(text: string): boolean {
  const trimmed = text.trim().toUpperCase();
  return (
    /TO:$/.test(trimmed) ||
    /^(CUT TO|SMASH CUT TO|MATCH CUT TO|JUMP CUT TO|HARD CUT TO|QUICK CUT TO|DISSOLVE TO|WIPE TO|CUTAWAY TO|BACK TO):$/.test(trimmed) ||
    /^(FADE IN|FADE OUT|FADE TO BLACK|FADE TO WHITE|IRIS IN|IRIS OUT|FREEZE FRAME|TIME CUT|MONTAGE|END MONTAGE)[:.]?$/.test(trimmed)
  );
}

export function normalizeCharacterName(text: string): string {
  return text.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
}

export function isLikelyCharacterCue(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 36) return false;
  if (trimmed !== trimmed.toUpperCase()) return false;
  if (/^(INT\.|EXT\.|EST\.|INT\/EXT\.|INT\.\/EXT\.|I\/E\.)/i.test(trimmed)) return false;
  if (isLikelyTransition(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  if (!/[A-Z]/.test(trimmed)) return false;
  return /^[A-Z0-9 .'-]+(\s+\((V\.O\.|O\.S\.|O\.C\.|CONT'D)\))?$/.test(trimmed);
}

export function estimatePageCount(elements: Pick<ScriptElement, 'type' | 'text'>[]): number {
  const weightedLines = elements.reduce((total, element) => {
    if (element.type === 'page-break') return total + 55;
    const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
    const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthFor(element.type)));
    const typeWeight = element.type === 'dialogue' ? 1.2 : element.type === 'scene-heading' ? 1.4 : 1;
    return total + Math.max(hardLines, softLines) * typeWeight;
  }, 0);

  return Math.max(1, Math.ceil(weightedLines / 55));
}

export function lineWidthFor(type: ScriptElementType): number {
  if (type === 'dialogue') return 36;
  if (type === 'parenthetical') return 28;
  if (type === 'character') return 24;
  return 58;
}
