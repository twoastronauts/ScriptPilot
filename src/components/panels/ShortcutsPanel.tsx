import { Keyboard, Sparkles } from 'lucide-react';
import { allShortcuts } from '@/components/elementShortcuts';

export function ShortcutsPanel() {
  return (
    <section className="panel shortcuts-panel">
      <div className="panel-title">
        <span>Shortcuts</span>
        <Keyboard size={15} />
      </div>
      <div className="shortcut-side-list">
        {allShortcuts.map((shortcut) => (
          <div key={`${shortcut.keys}:${shortcut.label}`} className="shortcut-side-row">
            <span>{shortcut.label}</span>
            <kbd>{shortcut.keys}</kbd>
          </div>
        ))}
      </div>
      <div className="shortcut-side-note">
        <Sparkles size={15} />
        <span>Select a word in the script, then use Alt+W or Alt Word for synonyms.</span>
      </div>
    </section>
  );
}
