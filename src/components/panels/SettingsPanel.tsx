import { useWorkspace } from '@/store/workspace';

export function SettingsPanel() {
  const { document, setViewMode, toggleFocusMode, toggleTypewriterMode, updateSettings } = useWorkspace();

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Workspace</span>
        <small>{document.settings.format}</small>
      </div>
      <div className="settings-list">
        <label>
          <span>View mode</span>
          <select value={document.settings.viewMode} onChange={(event) => setViewMode(event.target.value as typeof document.settings.viewMode)}>
            <option value="day">Day</option>
            <option value="night">Night</option>
            <option value="midnight">Midnight</option>
          </select>
        </label>
        <label>
          <span>Typewriter mode</span>
          <input type="checkbox" checked={document.settings.typewriterMode} onChange={toggleTypewriterMode} />
        </label>
        <label>
          <span>Typewriter volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={document.settings.typewriterVolume}
            onChange={(event) => updateSettings({ typewriterVolume: Number(event.target.value), typewriterSounds: Number(event.target.value) > 0 })}
          />
        </label>
        <label>
          <span>Page view</span>
          <select value={document.settings.pageMode} onChange={(event) => updateSettings({ pageMode: event.target.value as typeof document.settings.pageMode })}>
            <option value="pages">Pages</option>
            <option value="continuous">Continuous</option>
          </select>
        </label>
        <label>
          <span>Page numbers</span>
          <input type="checkbox" checked={document.settings.showPageNumbers} onChange={(event) => updateSettings({ showPageNumbers: event.target.checked })} />
        </label>
        <label>
          <span>Start page</span>
          <input
            type="number"
            min={1}
            value={document.settings.pageNumberStart}
            onChange={(event) => updateSettings({ pageNumberStart: Math.max(1, Number(event.target.value) || 1) })}
          />
        </label>
        <label>
          <span>Header/footer</span>
          <input type="checkbox" checked={document.settings.showHeaderFooter} onChange={(event) => updateSettings({ showHeaderFooter: event.target.checked })} />
        </label>
        <label>
          <span>Header text</span>
          <input value={document.settings.headerText} onChange={(event) => updateSettings({ headerText: event.target.value })} />
        </label>
        <label>
          <span>Footer text</span>
          <input value={document.settings.footerText} onChange={(event) => updateSettings({ footerText: event.target.value })} />
        </label>
        <label>
          <span>Export title page</span>
          <input
            type="checkbox"
            checked={document.settings.exportIncludeTitlePage}
            onChange={(event) => updateSettings({ exportIncludeTitlePage: event.target.checked })}
          />
        </label>
        <label>
          <span>Focus mode</span>
          <input type="checkbox" checked={document.settings.focusMode} onChange={toggleFocusMode} />
        </label>
        <label>
          <span>SmartType</span>
          <input type="checkbox" checked={document.settings.smartType} onChange={(event) => updateSettings({ smartType: event.target.checked })} />
        </label>
        <label>
          <span>Spellcheck</span>
          <input type="checkbox" checked={document.settings.spellcheck} onChange={(event) => updateSettings({ spellcheck: event.target.checked })} />
        </label>
        <label>
          <span>Grammar hints</span>
          <input
            type="checkbox"
            checked={document.settings.grammarSuggestions}
            onChange={(event) => updateSettings({ grammarSuggestions: event.target.checked })}
          />
        </label>
        <label>
          <span>Style hints</span>
          <input type="checkbox" checked={document.settings.styleSuggestions} onChange={(event) => updateSettings({ styleSuggestions: event.target.checked })} />
        </label>
        <label>
          <span>Dictionary</span>
          <select value={document.settings.dictionaryLanguage} onChange={(event) => updateSettings({ dictionaryLanguage: event.target.value })}>
            <option value="en-US">English (US)</option>
          </select>
        </label>
        <label>
          <span>Sprint chime</span>
          <input
            type="checkbox"
            checked={document.settings.sprintChimeEnabled}
            onChange={(event) => updateSettings({ sprintChimeEnabled: event.target.checked })}
          />
        </label>
        <label>
          <span>Sprint chime interval</span>
          <select
            value={document.settings.sprintChimeMinutes}
            onChange={(event) => updateSettings({ sprintChimeMinutes: Math.max(1, Number(event.target.value) || 5) })}
          >
            <option value={1}>1 minute</option>
            <option value={3}>3 minutes</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={120}>120 minutes</option>
          </select>
        </label>
        <label>
          <span>Autosave</span>
          <input type="checkbox" checked={document.settings.autosave} onChange={(event) => updateSettings({ autosave: event.target.checked })} />
        </label>
        <label>
          <span>Collaboration endpoint</span>
          <input value={document.settings.collaborationUrl ?? 'Local only'} readOnly />
        </label>
      </div>
    </section>
  );
}
