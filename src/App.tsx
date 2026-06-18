import { useEffect } from 'react';
import type * as React from 'react';
import { clsx } from 'clsx';
import { PanelRightOpen } from 'lucide-react';
import { HomePage } from './components/HomePage';
import { RightRail } from './components/RightRail';
import { ScreenplayEditor } from './components/ScreenplayEditor';
import { OutlineEditorStrip } from './components/StoryMapStrip';
import { TitlePageEditor } from './components/TitlePageEditor';
import { Toolbar } from './components/Toolbar';
import { themeColorsToCssVariables } from './shared/themeColors';
import { playTypewriterKey } from './shared/typewriterSound';
import { useWorkspace } from './store/workspace';

export function App() {
  const {
    document,
    projectPath,
    fdxPath,
    dirty,
    lastWarning,
    workspaceView,
    activeRightPanel,
    beatBoardMode,
    showTitlePage,
    rightRailCollapsed,
    rightRailWidth,
    outlineHeight,
    setRightRailCollapsed,
    setRightRailWidth,
    setOutlineHeight,
    recordBackup,
    setBackupDirectory,
    setWarning
  } = useWorkspace();
  const focusMode = document.settings.focusMode;
  const beatBoardFullscreen = !rightRailCollapsed && activeRightPanel === 'beats' && beatBoardMode === 'fullscreen';
  const beatBoardExpanded = !rightRailCollapsed && activeRightPanel === 'beats' && beatBoardMode === 'expanded';
  const showRightResizer = !focusMode && !beatBoardFullscreen && !rightRailCollapsed;
  const themeColorVars = themeColorsToCssVariables(document.settings.themeColors);

  useEffect(() => {
    if (!document.settings.autosave || !dirty) return;
    const timeout = window.setTimeout(() => {
      window.screenwriter?.createBackup(document, projectPath ?? fdxPath).then((result) => {
        if (result && !result.canceled) recordBackup(result.data);
      });
    }, document.settings.backupIntervalMinutes * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [document, dirty, projectPath, fdxPath, recordBackup]);

  useEffect(() => {
    window.screenwriter?.getBackupDirectory().then((result) => {
      if (result && !result.canceled) setBackupDirectory(result.data.path);
    });
  }, [setBackupDirectory]);

  useEffect(() => {
    window.screenwriter?.setWindowTitle({ title: document.title || 'Untitled Script', dirty });
  }, [document.title, dirty]);

  useEffect(() => {
    if (
      !document.settings.typewriterMode ||
      !document.settings.typewriterSounds ||
      (document.settings.typewriterVolume <= 0 && document.settings.typewriterBellVolume <= 0) ||
      workspaceView !== 'editor'
    ) return;

    function play(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat) return;
      playTypewriterKey(event.key, document.settings.typewriterVolume, document.settings.typewriterBellVolume);
    }

    window.addEventListener('keydown', play);
    return () => window.removeEventListener('keydown', play);
  }, [document.settings.typewriterBellVolume, document.settings.typewriterMode, document.settings.typewriterSounds, document.settings.typewriterVolume, workspaceView]);

  useEffect(() => {
    if (!lastWarning) return;
    const timeout = window.setTimeout(() => setWarning(undefined), 4200);
    return () => window.clearTimeout(timeout);
  }, [lastWarning, setWarning]);

  function startResize(side: 'left' | 'right', event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightRailWidth;

    function move(pointerEvent: PointerEvent) {
      const delta = pointerEvent.clientX - startX;
      setRightRailWidth(startWidth - delta);
    }

    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }

  function startOutlineResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = outlineHeight;

    function move(pointerEvent: PointerEvent) {
      setOutlineHeight(startHeight + pointerEvent.clientY - startY);
    }

    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }

  if (workspaceView === 'home') {
    return (
      <div className={clsx('app', 'app-home', `theme-${document.settings.viewMode}`)} style={themeColorVars}>
        <HomePage />
        {lastWarning && <div className="toast">{lastWarning}</div>}
      </div>
    );
  }

  return (
    <div
      className={clsx('app', `theme-${document.settings.viewMode}`, {
        'is-focus-mode': focusMode,
        'is-title-page-mode': showTitlePage,
        'is-beat-board-expanded': beatBoardExpanded,
        'is-beat-board-fullscreen': beatBoardFullscreen,
        'is-right-rail-collapsed': rightRailCollapsed
      })}
      style={
        {
          '--right-rail-width': `${rightRailCollapsed ? 52 : rightRailWidth}px`,
          '--outline-height': `${outlineHeight}px`,
          ...themeColorVars
        } as React.CSSProperties
      }
    >
      <Toolbar />
      {rightRailCollapsed && (
        <button className="side-rail-restore" title="Show side panel" aria-label="Show side panel" onClick={() => setRightRailCollapsed(false)}>
          <PanelRightOpen size={17} />
        </button>
      )}
      {!focusMode && !showTitlePage && <OutlineEditorStrip />}
      {!focusMode && !showTitlePage && <div className="outline-resizer" onPointerDown={startOutlineResize} />}
      {lastWarning && <div className="toast">{lastWarning}</div>}
      <main
        className={clsx('workspace', {
          'is-focus-mode': focusMode,
          'is-beat-board-expanded': beatBoardExpanded,
          'is-beat-board-fullscreen': beatBoardFullscreen,
          'is-right-rail-collapsed': rightRailCollapsed
        })}
        style={
          {
            ...(focusMode && !beatBoardFullscreen ? { gridTemplateColumns: 'minmax(560px, 1fr)' } : {})
          } as React.CSSProperties
        }
      >
        {!beatBoardFullscreen && (showTitlePage ? <TitlePageEditor /> : <ScreenplayEditor />)}
        {showRightResizer && <div className="panel-resizer panel-resizer--right" onPointerDown={(event) => startResize('right', event)} />}
        {(!focusMode || beatBoardFullscreen) && <RightRail />}
      </main>
    </div>
  );
}
