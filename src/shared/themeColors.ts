import type { CSSProperties } from 'react';
import type { ThemeColorSettings } from './types';

export interface ThemeColorControl {
  key: keyof ThemeColorSettings;
  label: string;
  cssVariable: string;
  group: 'Workspace' | 'Writing Page' | 'Controls' | 'Accents';
  fallback: string;
}

export const THEME_COLOR_CONTROLS: ThemeColorControl[] = [
  { key: 'bg', label: 'App background', cssVariable: '--bg', group: 'Workspace', fallback: '#090d13' },
  { key: 'bgElevated', label: 'Raised background', cssVariable: '--bg-elevated', group: 'Workspace', fallback: '#111821' },
  { key: 'bgSoft', label: 'Soft background', cssVariable: '--bg-soft', group: 'Workspace', fallback: '#070a10' },
  { key: 'panel', label: 'Panel glass', cssVariable: '--panel', group: 'Workspace', fallback: '#0c1118' },
  { key: 'panelSolid', label: 'Panel solid', cssVariable: '--panel-solid', group: 'Workspace', fallback: '#0c1118' },
  { key: 'panelRaised', label: 'Panel raised', cssVariable: '--panel-raised', group: 'Workspace', fallback: '#131d29' },
  { key: 'text', label: 'UI text', cssVariable: '--text', group: 'Workspace', fallback: '#d9eef5' },
  { key: 'textStrong', label: 'UI strong text', cssVariable: '--text-strong', group: 'Workspace', fallback: '#f3fdff' },
  { key: 'muted', label: 'Muted text', cssVariable: '--muted', group: 'Workspace', fallback: '#91a8b1' },
  { key: 'muted2', label: 'Faint text', cssVariable: '--muted-2', group: 'Workspace', fallback: '#657b86' },
  { key: 'page', label: 'Page paper', cssVariable: '--page', group: 'Writing Page', fallback: '#050811' },
  { key: 'pageInk', label: 'Page ink', cssVariable: '--page-ink', group: 'Writing Page', fallback: '#d9f0f6' },
  { key: 'pageMuted', label: 'Page notes', cssVariable: '--page-muted', group: 'Writing Page', fallback: '#8aa5ae' },
  { key: 'border', label: 'Border', cssVariable: '--border', group: 'Controls', fallback: '#253c48' },
  { key: 'borderStrong', label: 'Strong border', cssVariable: '--border-strong', group: 'Controls', fallback: '#4a7180' },
  { key: 'controlBg', label: 'Button', cssVariable: '--control-bg', group: 'Controls', fallback: '#111923' },
  { key: 'controlHover', label: 'Button hover', cssVariable: '--control-hover', group: 'Controls', fallback: '#172333' },
  { key: 'controlBorder', label: 'Button border', cssVariable: '--control-border', group: 'Controls', fallback: '#314b59' },
  { key: 'fieldBg', label: 'Field', cssVariable: '--field-bg', group: 'Controls', fallback: '#070b12' },
  { key: 'scrollTrack', label: 'Scroll track', cssVariable: '--scroll-track', group: 'Controls', fallback: '#0a131a' },
  { key: 'scrollThumb', label: 'Scroll thumb', cssVariable: '--scroll-thumb', group: 'Controls', fallback: '#3f6675' },
  { key: 'scrollThumbHover', label: 'Scroll hover', cssVariable: '--scroll-thumb-hover', group: 'Controls', fallback: '#65a0b2' },
  { key: 'accent', label: 'Accent', cssVariable: '--accent', group: 'Accents', fallback: '#55b8c7' },
  { key: 'accentInk', label: 'Accent text', cssVariable: '--accent-ink', group: 'Accents', fallback: '#041016' },
  { key: 'accentSoft', label: 'Accent soft', cssVariable: '--accent-soft', group: 'Accents', fallback: '#103541' },
  { key: 'brass', label: 'Brass', cssVariable: '--brass', group: 'Accents', fallback: '#caa15c' },
  { key: 'teal', label: 'Teal', cssVariable: '--teal', group: 'Accents', fallback: '#55b8c7' },
  { key: 'blue', label: 'Blue', cssVariable: '--blue', group: 'Accents', fallback: '#7ea0e5' },
  { key: 'warning', label: 'Warning', cssVariable: '--warning', group: 'Accents', fallback: '#caa15c' },
  { key: 'danger', label: 'Danger', cssVariable: '--danger', group: 'Accents', fallback: '#ff7777' },
  { key: 'focus', label: 'Focus ring', cssVariable: '--focus', group: 'Accents', fallback: '#55b8c7' }
];

export function themeColorsToCssVariables(themeColors?: ThemeColorSettings): CSSProperties {
  if (!themeColors) return {};
  return Object.fromEntries(
    THEME_COLOR_CONTROLS.flatMap((control) => {
      const value = themeColors[control.key];
      return value ? [[control.cssVariable, value]] : [];
    })
  ) as CSSProperties;
}

export function patchThemeColor(themeColors: ThemeColorSettings | undefined, key: keyof ThemeColorSettings, value: string): ThemeColorSettings {
  return {
    ...(themeColors ?? {}),
    [key]: value
  };
}
