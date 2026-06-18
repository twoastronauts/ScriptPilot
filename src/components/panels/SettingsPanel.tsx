import { useEffect } from 'react';
import { useWorkspace } from '@/store/workspace';
import { patchThemeColor, THEME_COLOR_CONTROLS } from '@/shared/themeColors';
import type { ThemeColorSettings } from '@/shared/types';

const colorGroups = ['Workspace', 'Writing Page', 'Controls', 'Accents'] as const;

export function SettingsPanel() {
  const {
    document,
    projectPath,
    fdxPath,
    lastSavedAt,
    lastBackupAt,
    lastBackupPath,
    backupDirectory,
    setDocument,
    setViewMode,
    toggleFocusMode,
    toggleTypewriterMode,
    updateSettings,
    recordBackup,
    setBackupDirectory,
    setWarning
  } = useWorkspace();
  const themeColors = document.settings.themeColors ?? {};
  const activePath = projectPath ?? fdxPath;

  useEffect(() => {
    window.screenwriter?.getBackupDirectory().then((result) => {
      if (result && !result.canceled) setBackupDirectory(result.data.path);
    });
  }, [setBackupDirectory]);

  function updateThemeColor(key: keyof ThemeColorSettings, value: string) {
    updateSettings({ themeColors: patchThemeColor(themeColors, key, value) });
  }

  async function createBackup() {
    const result = await window.screenwriter?.createBackup(document, activePath);
    if (!result || result.canceled) return;
    recordBackup(result.data);
    setWarning(`Backup created: ${result.data.path}`);
  }

  async function openBackupDirectory() {
    const result = await window.screenwriter?.openBackupDirectory();
    if (result && !result.canceled) setBackupDirectory(result.data.path);
  }

  async function restoreBackup() {
    const result = await window.screenwriter?.restoreBackup();
    if (!result || result.canceled) return;
    setDocument(result.data, { projectPath: result.path });
    setWarning(`Restored backup: ${result.path}`);
  }

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
        <div className="settings-section-title">
          <strong>Color Studio</strong>
          <button type="button" title="Reset color customization" onClick={() => updateSettings({ themeColors: {} })}>
            Reset
          </button>
        </div>
        {colorGroups.map((group) => (
          <fieldset key={group} className="color-studio-group">
            <legend>{group}</legend>
            <div className="color-studio-grid">
              {THEME_COLOR_CONTROLS.filter((control) => control.group === group).map((control) => {
                const value = themeColors[control.key] ?? control.fallback;
                return (
                  <label key={control.key} className="color-studio-control">
                    <span>{control.label}</span>
                    <input aria-label={control.label} type="color" value={value} onChange={(event) => updateThemeColor(control.key, event.target.value)} />
                    <code>{value}</code>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="settings-section-title">
          <strong>Files</strong>
          <button type="button" title="Open backup folder" onClick={openBackupDirectory}>
            Open backups
          </button>
        </div>
        <label>
          <span>Project path</span>
          <input value={activePath ?? 'Not saved yet'} readOnly />
        </label>
        <label>
          <span>Backup folder</span>
          <input value={backupDirectory ?? 'Loading backup folder...'} readOnly />
        </label>
        <label>
          <span>Last saved</span>
          <input value={lastSavedAt ? formatDateTime(lastSavedAt) : 'Not saved in this session'} readOnly />
        </label>
        <label>
          <span>Last backup</span>
          <input value={lastBackupAt ? formatDateTime(lastBackupAt) : 'No backup in this session'} readOnly />
        </label>
        {lastBackupPath && (
          <label>
            <span>Backup file</span>
            <input value={lastBackupPath} readOnly />
          </label>
        )}
        <label>
          <span>Autosave backups</span>
          <input type="checkbox" checked={document.settings.autosave} onChange={(event) => updateSettings({ autosave: event.target.checked })} />
        </label>
        <label>
          <span>Backup interval</span>
          <input
            type="number"
            min={1}
            max={120}
            value={document.settings.backupIntervalMinutes}
            onChange={(event) => updateSettings({ backupIntervalMinutes: Math.max(1, Number(event.target.value) || 5) })}
          />
        </label>
        <div className="settings-actions">
          <button type="button" onClick={createBackup}>Create backup</button>
          <button type="button" onClick={restoreBackup}>Restore backup</button>
        </div>
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
          <span>Return bell volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={document.settings.typewriterBellVolume}
            onChange={(event) => updateSettings({ typewriterBellVolume: Number(event.target.value), typewriterSounds: Number(event.target.value) > 0 || document.settings.typewriterVolume > 0 })}
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
          <span>Collaboration endpoint</span>
          <input value={document.settings.collaborationUrl ?? 'Local only'} readOnly />
        </label>
      </div>
    </section>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
