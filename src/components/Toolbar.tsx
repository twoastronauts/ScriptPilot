import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  BellOff,
  ChevronDown,
  CloudMoon,
  Crosshair,
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
  Settings as SettingsIcon,
  Sun,
  Timer,
  Type,
  Redo2,
  Undo2
} from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { ELEMENT_LABELS } from '@/shared/screenplay';
import { playSprintTimerChime, playTypewriterReturnBell } from '@/shared/typewriterSound';
import type { ScriptElementType, TextStyle, ViewMode } from '@/shared/types';
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
    lastSavedAt,
    lastBackupAt,
    lastBackupPath,
    collabSession,
    sprintStartedAt,
    showTitlePage,
    selectedElementId,
    setDocument,
    setWorkspaceView,
    finishProjectSave,
    finishFdxSave,
    recordBackup,
    setViewMode,
    setPanel,
    toggleTypewriterMode,
    toggleFocusMode,
    startSprint,
    stopSprint,
    setRevisionMode,
    setSelectedElementType,
    updateSettings,
    toggleTitlePage,
    setWarning
  } = useWorkspace();

  const [sprintNow, setSprintNow] = useState(() => Date.now());
  const [sprintNotice, setSprintNotice] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [openToolbarMenu, setOpenToolbarMenu] = useState<'save' | 'export' | null>(null);
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
      playSprintChime(document.settings.typewriterBellVolume);
      setSprintNotice(`${document.settings.sprintChimeMinutes}m mark`);
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => setSprintNotice(null), 10_000);
    }
  }, [document.settings.sprintChimeEnabled, document.settings.sprintChimeMinutes, document.settings.typewriterBellVolume, sprintNow, sprintStartedAt]);

  useEffect(() => () => window.clearTimeout(noticeTimeoutRef.current), []);

  useEffect(() => {
    function toggleFormatPanel(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFormatOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', toggleFormatPanel);
    return () => window.removeEventListener('keydown', toggleFormatPanel);
  }, []);

  async function openProject() {
    const result = await window.screenwriter?.openProject();
    if (!result || result.canceled) return;
    setDocument(result.data, { projectPath: result.path });
  }

  async function saveProject(path = projectPath) {
    const result = await window.screenwriter?.saveProject(document, path);
    if (!result || result.canceled) return;
    finishProjectSave(result.data, result.path);
    setWarning(`Saved project: ${result.path}`);
    playTypewriterReturnBell(document.settings.typewriterBellVolume);
  }

  async function saveProjectAs() {
    const result = await window.screenwriter?.saveProject(document, undefined);
    if (!result || result.canceled) return;
    finishProjectSave(result.data, result.path);
    setWarning(`Saved project: ${result.path}`);
    playTypewriterReturnBell(document.settings.typewriterBellVolume);
  }

  async function openFdx() {
    const result = await window.screenwriter?.openFdx();
    if (!result || result.canceled) return;
    setDocument(result.data, { fdxPath: result.path });
  }

  async function saveFdx(path = fdxPath) {
    const result = await window.screenwriter?.saveFdx(document, path);
    if (!result || result.canceled) return;
    finishFdxSave(result.data, result.path);
    setWarning(`Saved FDX: ${result.path}`);
    playTypewriterReturnBell(document.settings.typewriterBellVolume);
  }

  async function saveFdxAs() {
    const result = await window.screenwriter?.saveFdx(document, undefined);
    if (!result || result.canceled) return;
    finishFdxSave(result.data, result.path);
    setWarning(`Saved FDX: ${result.path}`);
    playTypewriterReturnBell(document.settings.typewriterBellVolume);
  }

  async function exportPdf(nolanMode = false) {
    const result = await window.screenwriter?.exportPdf(document, {
      includeTitlePage: document.settings.exportIncludeTitlePage,
      includeNotes: document.settings.exportIncludeNotes,
      includeStructureLines: true,
      includeWatermark: false,
      matchDisplayColors: false,
      openAfterExport: document.settings.exportOpenFolder,
      nolanMode,
      promptForNolanMode: false
    });
    if (result && !result.canceled) {
      setWarning(`Exported PDF: ${result.path}`);
      playTypewriterReturnBell(document.settings.typewriterBellVolume);
    }
  }

  async function importTextPdf() {
    const result = await window.screenwriter?.importTextPdf();
    if (!result || result.canceled) return;
    setDocument(result.data);
    setWarning(result.warning);
  }

  async function createBackup() {
    const result = await window.screenwriter?.createBackup(document, projectPath ?? fdxPath);
    if (result && !result.canceled) {
      recordBackup(result.data);
      setWarning(`Backup created: ${result.data.path}`);
      playTypewriterReturnBell(document.settings.typewriterBellVolume);
    }
  }

  function applyFormatPatch(patch: Partial<TextStyle>) {
    window.dispatchEvent(new CustomEvent('scriptpilot:format-selection', { detail: patch }));
  }

  const saveState = dirty ? 'Unsaved' : 'Saved';
  const workspaceState = document.settings.focusMode ? `Focus - ${saveState}` : saveState;
  const activePath = projectPath ?? fdxPath;
  const fileName = activePath ? fileNameFromPath(activePath) : 'No file yet';
  const fileTitle = document.title || 'Untitled Script';
  const fileStatusTitle = activePath ? `${activePath}${lastBackupPath ? `\nLast backup: ${lastBackupPath}` : ''}` : 'Save this project to choose a .spx path.';
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
      <div className="toolbar__file-status" title={fileStatusTitle}>
        <strong>{fileTitle}</strong>
        <span>{fileName}</span>
        <small>{lastSavedAt ? `Saved ${formatClock(lastSavedAt)}` : saveState}{lastBackupAt ? ` / backup ${formatClock(lastBackupAt)}` : ''}</small>
        {collabSession && <i>{collabSession.isHost ? 'Hosting' : 'Live'}</i>}
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
        <button title="Open FDX" onClick={openFdx}>
          <FileInput size={18} />
        </button>
        <ToolbarMenu
          id="save"
          label="Save"
          icon={Save}
          open={openToolbarMenu === 'save'}
          onToggle={() => setOpenToolbarMenu((value) => (value === 'save' ? null : 'save'))}
          onClose={() => setOpenToolbarMenu(null)}
        >
          <button onClick={() => saveProject()}>Save Script Pilot project</button>
          <button onClick={saveProjectAs}>Save project as...</button>
          <button onClick={() => saveFdx()}>Save FDX</button>
          <button onClick={saveFdxAs}>Save FDX as...</button>
        </ToolbarMenu>
        <ToolbarMenu
          id="export"
          label="Export"
          icon={FileDown}
          open={openToolbarMenu === 'export'}
          onToggle={() => setOpenToolbarMenu((value) => (value === 'export' ? null : 'export'))}
          onClose={() => setOpenToolbarMenu(null)}
        >
          <button onClick={() => exportPdf(false)}>PDF</button>
          <button onClick={() => exportPdf(true)}>PDF - Nolan proof style</button>
          <button onClick={importTextPdf}>Import text/PDF...</button>
          <button onClick={createBackup}>Create backup</button>
        </ToolbarMenu>
        <button title={showTitlePage ? 'Hide title page' : 'Title page'} className={showTitlePage ? 'is-active' : ''} onClick={toggleTitlePage}>
          <FileText size={18} />
        </button>
      </div>
      <div className="toolbar__group toolbar__screenplay">
        <ElementMenu selectedType={selectedType} onSelect={setSelectedElementType} />
        <div className="format-menu" data-tutorial="formatting">
          <button
            title="Formatting panel (Ctrl+Shift+F)"
            className={formatOpen ? 'is-active' : ''}
            aria-expanded={formatOpen}
            onClick={() => setFormatOpen((value) => !value)}
          >
            <Type size={17} />
          </button>
          {formatOpen && (
            <div className="format-menu__popover">
              <TextFormatControls style={selected?.style} onPatch={applyFormatPatch} compact includeBackground />
            </div>
          )}
        </div>
        <button
          title={document.settings.revisionMode ? 'Turn revision mode off' : 'Revision mode'}
          className={document.settings.revisionMode ? 'is-active' : ''}
          onClick={() => setRevisionMode(!document.settings.revisionMode)}
        >
          <Highlighter size={17} />
        </button>
        <button title="Alt Word synonyms" data-tutorial="alt-word" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:request-synonyms'))}>
          <Sparkles size={17} />
        </button>
        <button title="Spelling suggestions" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:request-spelling'))}>
          <Type size={17} />
        </button>
        <button title="Undo (Ctrl+Z)" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:undo'))}>
          <Undo2 size={17} />
        </button>
        <button title="Redo (Ctrl+Shift+Z)" onClick={() => window.dispatchEvent(new CustomEvent('scriptpilot:redo'))}>
          <Redo2 size={17} />
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
        <button title="Custom mode color options" onClick={() => setPanel('settings')}>
          <SettingsIcon size={17} />
          <span>Custom</span>
        </button>
      </div>
      <div className="toolbar__group">
        <button title="Typewriter mode" data-tutorial="typewriter" className={document.settings.typewriterMode ? 'is-active' : ''} onClick={toggleTypewriterMode}>
          <Keyboard size={18} />
        </button>
        <button title={focusTitle} data-tutorial="focus" className={document.settings.focusMode ? 'is-active' : ''} onClick={toggleFocusMode}>
          <Crosshair size={18} />
        </button>
        <div className="sprint-stack">
          <button title={sprintTitle} data-tutorial="sprint" className={sprintStartedAt ? 'is-active sprint-button' : 'sprint-button'} onClick={sprintStartedAt ? stopSprint : startSprint}>
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

function ToolbarMenu({
  id,
  label,
  icon: Icon,
  open,
  onToggle,
  onClose,
  children
}: {
  id: string;
  label: string;
  icon: typeof Save;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [onClose, open]);

  return (
    <div
      ref={menuRef}
      className="toolbar-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={`toolbar-menu-${id}`} onClick={onToggle}>
        <Icon size={18} />
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div id={`toolbar-menu-${id}`} className="toolbar-menu__popover" role="menu" onClick={onClose}>
          {children}
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

function formatClock(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function fileNameFromPath(value: string): string {
  return value.replace(/\\/g, '/').split('/').pop() || value;
}

function playSprintChime(volume: number): void {
  playSprintTimerChime(Math.max(0.08, Math.min(0.7, volume || 0.25)));
}
