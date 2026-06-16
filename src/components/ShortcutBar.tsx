import { ChevronDown, ChevronUp, Highlighter, Keyboard, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ELEMENT_LABELS } from '@/shared/screenplay';
import { useWorkspace } from '@/store/workspace';
import type { ScriptElementType } from '@/shared/types';

const primaryShortcuts: Array<{ type: ScriptElementType; keys: string; label: string }> = [
  { type: 'scene-heading', keys: 'Ctrl+1', label: 'Scene' },
  { type: 'action', keys: 'Ctrl+2', label: 'Action' },
  { type: 'character', keys: 'Ctrl+3', label: 'Character' },
  { type: 'parenthetical', keys: 'Ctrl+4', label: 'Paren' },
  { type: 'dialogue', keys: 'Ctrl+5', label: 'Dialogue' },
  { type: 'transition', keys: 'Ctrl+6', label: 'Transition' }
];

const allShortcuts = [
  ...primaryShortcuts,
  { type: 'shot' as ScriptElementType, keys: 'Ctrl+7', label: 'Shot' },
  { type: 'general' as ScriptElementType, keys: 'Ctrl+0', label: 'General' },
  { type: 'mark-revision' as const, keys: 'Ctrl+Alt+R', label: 'Mark revision' },
  { type: 'undo' as const, keys: 'Ctrl+Z', label: 'Undo' },
  { type: 'redo' as const, keys: 'Ctrl+Shift+Z', label: 'Redo' },
  { type: 'menu' as const, keys: 'Ctrl+/', label: 'Show shortcuts' }
];

const elementTypes: ScriptElementType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot', 'general'];

export function ShortcutBar() {
  const { document, selectedElementId, setSelectedElementType, markSelectedRevised } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const selected = useMemo(() => document.elements.find((element) => element.id === selectedElementId), [document.elements, selectedElementId]);
  const selectedType = selected?.type ?? 'action';

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;

      const match = primaryShortcuts.find((shortcut) => shortcut.keys === `Ctrl+${event.key}`);
      if (match) {
        event.preventDefault();
        setSelectedElementType(match.type);
        return;
      }

      if (event.key === '7') {
        event.preventDefault();
        setSelectedElementType('shot');
      } else if (event.key === '0') {
        event.preventDefault();
        setSelectedElementType('general');
      } else if (event.key === '/') {
        event.preventDefault();
        setExpanded((value) => !value);
      }
    }

    function handleRevisionShortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        markSelectedRevised();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('keydown', handleRevisionShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      window.removeEventListener('keydown', handleRevisionShortcut);
    };
  }, [markSelectedRevised, setSelectedElementType]);

  return (
    <section className={expanded ? 'shortcut-bar is-expanded' : 'shortcut-bar'} aria-label="Screenplay shortcuts">
      <div className="element-picker">
        <span>Elements</span>
        <select value={selectedType} onChange={(event) => setSelectedElementType(event.target.value as ScriptElementType)}>
          {elementTypes.map((type) => (
            <option key={type} value={type}>
              {ELEMENT_LABELS[type]} {shortcutForType(type)}
            </option>
          ))}
        </select>
      </div>
      <div className="shortcut-hint">
        <kbd>{shortcutForType(selectedType).trim() || 'Ctrl+/'}</kbd>
        <span>{ELEMENT_LABELS[selectedType]}</span>
      </div>
      <div className="shortcut-primary">
        <button title="Mark revision (Ctrl+Alt+R)" onClick={markSelectedRevised}>
          <Highlighter size={14} />
          <span>Revision</span>
        </button>
        <button title="Undo (Ctrl+Z)" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:undo'))}>
          <Undo2 size={14} />
          <span>Undo</span>
        </button>
        <button title="Redo (Ctrl+Shift+Z)" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:redo'))}>
          <Redo2 size={14} />
          <span>Redo</span>
        </button>
      </div>
      <button className="shortcut-toggle" title={expanded ? 'Collapse shortcuts' : 'Show all shortcuts'} onClick={() => setExpanded((value) => !value)}>
        <Keyboard size={15} />
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {expanded && (
        <div className="shortcut-drawer">
          {allShortcuts.map((shortcut) => (
            <div key={`${shortcut.keys}:${shortcut.label}`}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function shortcutForType(type: ScriptElementType): string {
  const shortcut = allShortcuts.find((item) => item.type === type);
  return shortcut ? ` ${shortcut.keys}` : '';
}
