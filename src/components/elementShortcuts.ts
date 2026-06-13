import { useEffect } from 'react';
import type { ScriptElementType } from '@/shared/types';
import { useWorkspace } from '@/store/workspace';

export const primaryShortcuts: Array<{ type: ScriptElementType; keys: string; label: string }> = [
  { type: 'scene-heading', keys: 'Ctrl+1', label: 'Scene Heading' },
  { type: 'action', keys: 'Ctrl+2', label: 'Action' },
  { type: 'character', keys: 'Ctrl+3', label: 'Character' },
  { type: 'parenthetical', keys: 'Ctrl+4', label: 'Parenthetical' },
  { type: 'dialogue', keys: 'Ctrl+5', label: 'Dialogue' },
  { type: 'transition', keys: 'Ctrl+6', label: 'Transition' }
];

export const elementTypes: ScriptElementType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot', 'general'];

export const allShortcuts = [
  ...primaryShortcuts,
  { type: 'shot' as ScriptElementType, keys: 'Ctrl+7', label: 'Shot' },
  { type: 'general' as ScriptElementType, keys: 'Ctrl+0', label: 'General' },
  { type: 'parenthetical-insert' as const, keys: 'Ctrl+9', label: 'Insert parenthetical' },
  { type: 'mark-revision' as const, keys: 'Ctrl+Alt+R', label: 'Mark revision' },
  { type: 'alt-word' as const, keys: 'Alt+W', label: 'Alt Word' },
  { type: 'spelling' as const, keys: 'Ctrl+.', label: 'Spelling suggestions' },
  { type: 'undo' as const, keys: 'Ctrl+Z', label: 'Undo' },
  { type: 'redo' as const, keys: 'Ctrl+Shift+Z', label: 'Redo' }
];

export function shortcutForType(type: ScriptElementType): string {
  const shortcut = allShortcuts.find((item) => item.type === type);
  return shortcut?.keys ?? '';
}

export function useScreenplayShortcuts() {
  const { setSelectedElementType, markSelectedRevised } = useWorkspace();

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('scriptpilot:request-synonyms'));
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key === '.') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('scriptpilot:request-spelling'));
        return;
      }

      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        markSelectedRevised();
        return;
      }

      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      const key = `Ctrl+${event.key}`;
      const match = allShortcuts.find((shortcut) => shortcut.keys === key && typeof shortcut.type === 'string');
      if (match && (match.type === 'shot' || match.type === 'general' || primaryShortcuts.some((shortcut) => shortcut.type === match.type))) {
        event.preventDefault();
        setSelectedElementType(match.type as ScriptElementType);
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [markSelectedRevised, setSelectedElementType]);
}
