import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';

const tutorialSteps = [
  {
    title: 'Write without formatting drag',
    body: 'Use the Elements menu or Ctrl+1 through Ctrl+7 to switch screenplay elements. SmartType will only offer suggestions that fit the current element.'
  },
  {
    title: 'Shape the movie above the page',
    body: 'Double-click the outline to create acts or beats, then drag act edges to adjust page ranges. Hover markers for summaries.'
  },
  {
    title: 'Build messy, useful boards',
    body: 'Double-click the Beat Board canvas for a new node. Nodes can hold text, images, and audio, then send to script after you add a page.'
  },
  {
    title: 'Use the writer tools',
    body: 'Right-click selected text for notes, synonyms, spelling replacements, translation, formatting, and revision marks.'
  },
  {
    title: 'Export safely',
    body: 'PDFs export as printable white pages by default. Notes and open-folder behavior live in Settings; Nolan proof style is a checkbox during export.'
  }
];

export function TutorialOverlay() {
  const { document, updateSettings } = useWorkspace();
  const [index, setIndex] = useState(0);
  const enabled = document.settings.tutorialMode && !document.settings.tutorialCompleted;
  const step = tutorialSteps[index];

  if (!enabled || !step) return null;

  function finish() {
    updateSettings({ tutorialCompleted: true, tutorialMode: false });
  }

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="false" aria-label="Script Pilot tutorial">
      <div className="tutorial-card">
        <div className="tutorial-card__header">
          <Sparkles size={18} />
          <strong>{step.title}</strong>
          <button type="button" aria-label="Skip tutorial" title="Skip tutorial" onClick={finish}>
            <X size={14} />
          </button>
        </div>
        <p>{step.body}</p>
        <div className="tutorial-card__footer">
          <span>
            {index + 1} / {tutorialSteps.length}
          </span>
          <button type="button" onClick={finish}>Skip</button>
          <button type="button" onClick={() => (index >= tutorialSteps.length - 1 ? finish() : setIndex((value) => value + 1))}>
            {index >= tutorialSteps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
