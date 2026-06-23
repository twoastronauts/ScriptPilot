import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { Crosshair, Sparkles, X } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';

interface TutorialStep {
  title: string;
  body: string;
  target?: string;
  panel?: 'beats' | 'characters' | 'assistant' | 'production' | 'settings' | 'shortcuts';
  actionLabel?: string;
  action?: () => void;
}

interface BubblePosition {
  left: number;
  top: number;
  arrowLeft: number;
}

export function TutorialOverlay() {
  const {
    document,
    workspaceView,
    setPanel,
    setRightRailCollapsed,
    updateSettings,
    toggleFocusMode
  } = useWorkspace();
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState<BubblePosition>();
  const enabled = document.settings.tutorialMode && !document.settings.tutorialCompleted;

  const tutorialSteps = useMemo<TutorialStep[]>(
    () => [
      {
        title: 'Focus mode',
        body: 'Click the focus icon to see how Script Pilot clears the side panels and leaves you with the page. Click it again any time to bring the studio back.',
        target: '[data-tutorial="focus"]',
        actionLabel: document.settings.focusMode ? 'Show panels' : 'Enter focus',
        action: toggleFocusMode
      },
      {
        title: 'Write in screenplay elements',
        body: 'Use the element menu or shortcuts when you want to force Scene Heading, Action, Character, Dialogue, Transition, Shot, or General.',
        target: '.element-menu'
      },
      {
        title: 'Sprint without looking back',
        body: 'Start a sprint to keep the current line clear while previous lines fade away. The timer chime is separate from the typewriter bell.',
        target: '[data-tutorial="sprint"]'
      },
      {
        title: 'Beat board',
        body: 'Nodes can hold text, images, and audio. Add page numbers when a beat should appear in the linear outline.',
        target: '[data-tutorial="panel-beats"]',
        panel: 'beats'
      },
      {
        title: 'Notes and tags',
        body: 'Right-click script text to add notes. Hover note bubbles on the page, then edit, resolve, color, or delete notes from this panel.',
        target: '[data-tutorial="panel-production"]',
        panel: 'production'
      },
      {
        title: 'Script Doctor',
        body: 'Run a story, dialogue, overused-word, and proofing pass without freezing imported scripts.',
        target: '[data-tutorial="panel-assistant"]',
        panel: 'assistant'
      }
    ],
    [document.settings.focusMode, toggleFocusMode]
  );

  const step = tutorialSteps[Math.min(index, tutorialSteps.length - 1)];

  useEffect(() => {
    if (!enabled || !step) return;
    if (step.panel && workspaceView === 'editor') {
      updateSettings({ focusMode: false });
      setRightRailCollapsed(false);
      setPanel(step.panel);
    }
  }, [enabled, setPanel, setRightRailCollapsed, step, updateSettings, workspaceView]);

  useEffect(() => {
    if (!enabled || !step) return;

    function updatePosition() {
      const target = step.target ? window.document.querySelector<HTMLElement>(step.target) : undefined;
      if (!target) {
        setPosition({ left: Math.max(16, window.innerWidth - 390), top: 84, arrowLeft: 42 });
        return;
      }

      const rect = target.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      const top = Math.max(70, Math.min(window.innerHeight - 260, rect.bottom + 12));
      setPosition({
        left,
        top,
        arrowLeft: Math.max(18, Math.min(width - 28, rect.left + rect.width / 2 - left))
      });
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [enabled, step]);

  if (!enabled || !step || workspaceView !== 'editor') return null;

  function finish() {
    updateSettings({ tutorialCompleted: true, tutorialMode: false });
  }

  return (
    <div className="tutorial-layer" aria-live="polite">
      <div
        className="tutorial-bubble"
        role="dialog"
        aria-modal="false"
        aria-label="Script Pilot tutorial"
        style={{
          left: position?.left ?? 24,
          top: position?.top ?? 84,
          '--tutorial-arrow-left': `${position?.arrowLeft ?? 34}px`
        } as React.CSSProperties}
      >
        <div className="tutorial-card__header">
          <Sparkles size={16} />
          <strong>{step.title}</strong>
          <button type="button" aria-label="Skip tutorial" title="Skip tutorial" onClick={finish}>
            <X size={15} />
          </button>
        </div>
        <p>{step.body}</p>
        <div className="tutorial-card__footer">
          <span>{index + 1} / {tutorialSteps.length}</span>
          <div className="tutorial-card__buttons">
            {step.action && (
              <button type="button" className="ghost-button" onClick={step.action}>
                <Crosshair size={13} />
                {step.actionLabel ?? 'Try it'}
              </button>
            )}
            <button type="button" onClick={() => (index >= tutorialSteps.length - 1 ? finish() : setIndex((value) => value + 1))}>
              {index >= tutorialSteps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
