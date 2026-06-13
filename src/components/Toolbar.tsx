import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  ChevronDown,
  CloudMoon,
  Crosshair,
  Download,
  FileDown,
  FileInput,
  FileJson,
  FileText,
  FolderOpen,
  Highlighter,
  Home,
  Keyboard,
  Moon,
  Save,
  Sparkles,
  Sun,
  Timer,
  Type,
  Wand2
} from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { ELEMENT_LABELS } from '@/shared/screenplay';
import { playTypewriterKey } from '@/shared/typewriterSound';
import type { ScriptElementType, ViewMode } from '@/shared/types';
import scriptPilotIcon from '@/assets/script-pilot-icon.png';
import { TextFormatControls } from './TextFormatControls';
import { elementTypes, shortcutForType, useScreenplayShortcuts } from './elementShortcuts';

const themeOptions: Array<{ id: ViewMode; label: string; icon: typeof Sun }> = [
  { id: 'day', label: 'Day', icon: Sun },
  { id: 'night', label: 'Night', icon: Moon },
  { id: 'midnight', label: 'Midnight', icon: CloudMoon }
];

export function Toolbar() {
  const {
    document,
    projectPath,
    fdxPath,
    dirty,
    sprintStartedAt,
    showTitlePage,
    selectedElementId,
    setDocument,
    setWorkspaceView,
    setProjectPath,
    setFdxPath,
    markClean,
    setViewMode,
    toggleTypewriterMode,
    toggleFocusMode,
    startSprint,
    stopSprint,
    setRevisionMode,
    setSelectedElementType,
    updateSelectedElementStyle,
    updateSettings,
    toggleTitlePage,
    setWarning
  } = useWorkspace();

  const [sprintNow, setSprintNow] = useState(() => Date.now());
  const [sprintNotice, setSprintNotice] = useState<string | null>(null);
  const lastChimeRef = useRef(0);
  const noticeTimeoutRef = useRef<number | undefined>(undefined);
  const selected = document.elements.find((element) => element.id === selectedElementId);
  const selectedType = selected?.type ?? 'action';

  useScreenplayShortcuts();

  useEffect(() => {
    if (!sprintStartedAt) return;
    setSprintNow(Date.now());
    const interval = window.setInterval(() => setSprintNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [sprintStartedAt]);

  useEffect(() => {
    lastChimeRef.current = 0;
  }, [sprintStartedAt]);

  useEffect(() => {
    if (!sprintStartedAt || !document.settings.sprintChimeEnabled) return;
    const intervalMs = Math.max(1, document.settings.sprintChimeMinutes) * 60 * 1000;
    const elapsedMs = Math.max(0, sprintNow - new Date(sprintStartedAt).getTime());
    const bucket = Math.floor(elapsedMs / intervalMs);
    if (bucket > 0 && bucket > lastChimeRef.current) {
      lastChimeRef.current = bucket;
      playSprintChime(document.settings.typewriterVolume);
      setSprintNotice(`${document.settings.sprintChimeMinutes}m mark`);
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => setSprintNotice(null), 10_000);
    }
  }, [document.settings.sprintChimeEnabled, document.settings.sprintChimeMinutes, sprintNow, sprintStartedAt]);

  useEffect(() => () => window.clearTimeout(noticeTimeoutRef.current), []);

  async function openProject() {
    const result = await window.screenwriter?.openProject();
    if (!result || result.canceled) return;
    setDocument(result.data, { projectPath: result.path });
  }

  async function saveProject() {
    const result = await window.screenwriter?.saveProject(document, projectPath);
    if (!result || result.canceled) return;
    setProjectPath(result.path);
    markClean();
  }

  async function openFdx() {
    const result = await window.screenwriter?.openFdx();
    if (!result || result.canceled) return;
    setDocument(result.data, { fdxPath: result.path });
  }

  async function saveFdx() {
    const result = await window.screenwriter?.saveFdx(document, fdxPath);
    if (!result || result.canceled) return;
    setFdxPath(result.path);
    markClean();
  }

  async function exportPdf() {
    await window.screenwriter?.exportPdf(document, {
      includeTitlePage: document.settings.exportIncludeTitlePage,
      includeStructureLines: true,
      includeWatermark: false,
      matchDisplayColors: true
    });
  }

  async function importTextPdf() {
    const result = await window.screenwriter?.importTextPdf();
    if (!result || result.canceled) return;
    setDocument(result.data);
    setWarning(result.warning);
  }

  async function createBackup() {
    const result = await window.screenwriter?.createBackup(document, projectPath ?? fdxPath);
    if (result && !result.canceled) setWarning(`Backup created: ${result.path}`);
  }

  const saveState = dirty ? 'Unsaved' : 'Saved';
  const workspaceState = document.settings.focusMode ? `Focus - ${saveState}` : saveState;
  const focusTitle = document.settings.focusMode ? 'Exit focus mode' : 'Focus mode';
  const sprintTitle = sprintStartedAt ? 'Stop sprint and record session delta' : 'Start sprint';
  const sprintElapsed = sprintStartedAt ? Math.max(0, sprintNow - new Date(sprintStartedAt).getTime()) : 0;
  const sprintLabel = sprintStartedAt ? formatElapsed(sprintElapsed) : '';
  const sprintChimeInterval = Math.max(1, document.settings.sprintChimeMinutes) * 60 * 1000;
  const sprintChimeRemainder = sprintElapsed % sprintChimeInterval;
  const sprintChimeCountdown = sprintStartedAt ? formatElapsed(sprintChimeRemainder === 0 ? sprintChimeInterval : sprintChimeInterval - sprintChimeRemainder) : '';

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <img src={scriptPilotIcon} alt="" />
        <strong>Script Pilot</strong>
        <span>{workspaceState}</span>
      </div>
      <div className="toolbar__group">
        <button title="Home" onClick={() => setWorkspaceView('home')}>
          <Home size={18} />
        </button>
        <button title="New project" onClick={() => setDocument(createDocumentFromPlainText('Untitled Script Pilot Script', ''))}>
          <FileJson size={18} />
        </button>
        <button title="Open project" onClick={openProject}>
          <FolderOpen size={18} />
        </button>
        <button title="Save project" onClick={saveProject}>
          <Save size={18} />
        </button>
        <button title="Open FDX" onClick={openFdx}>
          <FileInput size={18} />
        </button>
        <button title="Save FDX" onClick={saveFdx}>
          <Download size={18} />
        </button>
        <button title="Export PDF" onClick={exportPdf}>
          <FileDown size={18} />
        </button>
        <button title={showTitlePage ? 'Hide title page' : 'Title page'} className={showTitlePage ? 'is-active' : ''} onClick={toggleTitlePage}>
          <FileText size={18} />
        </button>
      </div>
      <div className="toolbar__group">
        <button title="Import text/PDF" onClick={importTextPdf}>
          <Wand2 size={18} />
        </button>
        <button title="Create backup" onClick={createBackup}>
          <Save size={18} />
        </button>
      </div>
      <div className="toolbar__group toolbar__screenplay">
        <ElementMenu selectedType={selectedType} onSelect={setSelectedElementType} />
        <TextFormatControls style={selected?.style} onPatch={updateSelectedElementStyle} compact includeBackground />
        <button
          title={document.settings.revisionMode ? 'Turn revision mode off' : 'Revision mode'}
          className={document.settings.revisionMode ? 'is-active' : ''}
          onClick={() => setRevisionMode(!document.settings.revisionMode)}
        >
          <Highlighter size={17} />
        </button>
        <button title="Alt Word synonyms" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:request-synonyms'))}>
          <Sparkles size={17} />
        </button>
        <button title="Spelling suggestions" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:request-spelling'))}>
          <Type size={17} />
        </button>
      </div>
      <div className="toolbar__group toolbar__theme" role="group" aria-label="Theme">
        {themeOptions.map((theme) => {
          const Icon = theme.icon;
          return (
            <button
              key={theme.id}
              title={`${theme.label} mode`}
              className={document.settings.viewMode === theme.id ? 'is-active' : ''}
              aria-pressed={document.settings.viewMode === theme.id}
              onClick={() => setViewMode(theme.id)}
            >
              <Icon size={17} />
              <span>{theme.label}</span>
            </button>
          );
        })}
      </div>
      <div className="toolbar__group">
        <button title="Typewriter mode" className={document.settings.typewriterMode ? 'is-active' : ''} onClick={toggleTypewriterMode}>
          <Keyboard size={18} />
        </button>
        <button title={focusTitle} className={document.settings.focusMode ? 'is-active' : ''} onClick={toggleFocusMode}>
          <Crosshair size={18} />
        </button>
        <div className="sprint-stack">
          <button title={sprintTitle} className={sprintStartedAt ? 'is-active sprint-button' : 'sprint-button'} onClick={sprintStartedAt ? stopSprint : startSprint}>
            <Timer size={18} />
            {sprintLabel && <span>{sprintLabel}</span>}
          </button>
          {sprintStartedAt && (
            <div className="sprint-controls" aria-label="Sprint chime controls">
              <button
                title={document.settings.sprintChimeEnabled ? 'Disable sprint chime' : 'Enable sprint chime'}
                aria-pressed={document.settings.sprintChimeEnabled}
                onClick={() => updateSettings({ sprintChimeEnabled: !document.settings.sprintChimeEnabled })}
              >
                {document.settings.sprintChimeEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
              <span>{document.settings.sprintChimeEnabled ? sprintChimeCountdown : '--:--'}</span>
              <select
                title="Sprint chime interval"
                value={document.settings.sprintChimeMinutes}
                onChange={(event) => updateSettings({ sprintChimeMinutes: Math.max(1, Number(event.target.value) || 5) })}
              >
                <option value={1}>1m</option>
                <option value={3}>3m</option>
                <option value={5}>5m</option>
                <option value={10}>10m</option>
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>60m</option>
                <option value={120}>120m</option>
              </select>
            </div>
          )}
          {sprintNotice && (
            <div className="sprint-notice" role="status">
              {sprintNotice}
              <small>Keep rolling.</small>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ElementMenu({ selectedType, onSelect }: { selectedType: ScriptElementType; onSelect: (type: ScriptElementType) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  return (
    <div ref={menuRef} className="element-menu" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button className="element-menu__button" title="Element style" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{ELEMENT_LABELS[selectedType]}</span>
        <kbd>{shortcutForType(selectedType)}</kbd>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="element-menu__popover" role="menu">
          {elementTypes.map((type) => (
            <button
              key={type}
              className={selectedType === type ? 'is-active' : ''}
              role="menuitem"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(type);
                setOpen(false);
              }}
            >
              <span>{ELEMENT_LABELS[type]}</span>
              <kbd>{shortcutForType(type)}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function playSprintChime(volume: number): void {
  playTypewriterKey('Enter', Math.max(0.35, Math.min(1, volume || 0.7)));
}
