import { useEffect, useMemo, useState } from 'react';
import { normalizeCharacterName } from '@/shared/screenplay';
import { computeWritingStats } from '@/shared/stats';
import type { CharacterStat, SceneStat } from '@/shared/stats';
import type { NavigatorTab, ScriptElement } from '@/shared/types';
import { useWorkspace } from '@/store/workspace';

type NavigatorTabKind = 'script' | 'characters' | 'notes';

interface NoteTagRow {
  id: string;
  title: string;
  context: string;
  summary: string;
  page: number;
}

const virtualTabs: Record<NavigatorTabKind, NavigatorTab> = {
  script: { id: 'virtual-script-tab', name: 'Script', filter: '', columns: [] },
  characters: { id: 'virtual-character-tab', name: 'Characters', filter: '', columns: [] },
  notes: { id: 'virtual-notes-tab', name: 'Notes/Tags', filter: 'notes-tags', columns: [] }
};

export function NavigatorPanel() {
  const { document, selectedElementId, setSelectedElement } = useWorkspace();
  const stats = computeWritingStats(document);
  const navigatorTabs = useMemo(() => ensureNavigatorTabs(document.navigatorTabs), [document.navigatorTabs]);
  const noteTagRows = useMemo(() => collectNoteTagRows(document.elements), [document.elements]);
  const [activeTabId, setActiveTabId] = useState<string>();
  const activeTab = navigatorTabs.find((tab) => tab.id === activeTabId) ?? navigatorTabs[0];
  const activeKind = getTabKind(activeTab);

  useEffect(() => {
    if (!navigatorTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(navigatorTabs[0]?.id);
    }
  }, [activeTabId, navigatorTabs]);

  return (
    <aside className="navigator">
      <div className="panel-title">
        <span>Navigator</span>
        <small>{getPanelCount(activeKind, stats.scenes, stats.characters.length, noteTagRows.length)}</small>
      </div>
      <div className="nav-tabs">
        {navigatorTabs.map((tab) => (
          <button key={tab.id} className={tab.id === activeTab.id ? 'is-active' : ''} onClick={() => setActiveTabId(tab.id)}>
            {tab.name}
          </button>
        ))}
      </div>
      {activeKind === 'script' && (
        <ScriptSceneList scenes={stats.scenesList} selectedElementId={selectedElementId} onSelect={setSelectedElement} />
      )}
      {activeKind === 'characters' && (
        <CharacterList characters={stats.characters} elements={document.elements} selectedElementId={selectedElementId} onSelect={setSelectedElement} />
      )}
      {activeKind === 'notes' && <NoteTagList rows={noteTagRows} selectedElementId={selectedElementId} onSelect={setSelectedElement} />}
    </aside>
  );
}

function ScriptSceneList({
  scenes,
  selectedElementId,
  onSelect
}: {
  scenes: SceneStat[];
  selectedElementId?: string;
  onSelect: (id?: string) => void;
}) {
  return (
    <div className="navigator__list">
      {scenes.map((scene) => (
        <button
          key={scene.id}
          className={scene.id === selectedElementId ? 'navigator__row is-active' : 'navigator__row'}
          onClick={() => onSelect(scene.id)}
        >
          <span>{scene.heading}</span>
          <small>p. {scene.page}</small>
          <em>{scene.characters.join(', ') || 'No cast yet'}</em>
        </button>
      ))}
      {!scenes.length && (
        <div className="navigator__row">
          <span>No scenes yet</span>
          <em>Scene headings will appear here as you write.</em>
        </div>
      )}
    </div>
  );
}

function CharacterList({
  characters,
  elements,
  selectedElementId,
  onSelect
}: {
  characters: CharacterStat[];
  elements: ScriptElement[];
  selectedElementId?: string;
  onSelect: (id?: string) => void;
}) {
  return (
    <div className="navigator__list">
      {characters.map((character) => {
        const elementId = findCharacterElementId(elements, character.name);
        return (
          <button
            key={character.name}
            className={elementId === selectedElementId ? 'navigator__row is-active' : 'navigator__row'}
            onClick={() => onSelect(elementId)}
          >
            <span>{character.name}</span>
            <small>{character.scenes} scenes</small>
            <em>{character.estimatedLines} lines; with {character.interactions.join(', ') || 'no shared scenes yet'}</em>
          </button>
        );
      })}
      {!characters.length && (
        <div className="navigator__row">
          <span>No characters yet</span>
          <em>Character cues will appear here as they enter the script.</em>
        </div>
      )}
    </div>
  );
}

function NoteTagList({
  rows,
  selectedElementId,
  onSelect
}: {
  rows: NoteTagRow[];
  selectedElementId?: string;
  onSelect: (id?: string) => void;
}) {
  return (
    <div className="navigator__list">
      {rows.map((row) => (
        <button
          key={row.id}
          className={row.id === selectedElementId ? 'navigator__row is-active' : 'navigator__row'}
          onClick={() => onSelect(row.id)}
        >
          <span>{row.title}</span>
          <small>p. {row.page}</small>
          <em>{row.context}: {row.summary}</em>
        </button>
      ))}
      {!rows.length && (
        <div className="navigator__row">
          <span>No notes or tags yet</span>
          <em>Add script notes or production tags to track them here.</em>
        </div>
      )}
    </div>
  );
}

function ensureNavigatorTabs(tabs: NavigatorTab[]): NavigatorTab[] {
  const next = tabs.length ? [...tabs] : [virtualTabs.script];
  const kinds = new Set(next.map(getTabKind));
  if (!kinds.has('script')) next.unshift(virtualTabs.script);
  if (!kinds.has('characters')) next.push(virtualTabs.characters);
  if (!kinds.has('notes')) next.push(virtualTabs.notes);
  return next;
}

function getTabKind(tab: NavigatorTab): NavigatorTabKind {
  const name = tab.name.toLowerCase();
  const filter = tab.filter.toLowerCase();
  if (name.includes('script') || name.includes('scene')) return 'script';
  if (name.includes('character') || filter.includes('character')) return 'characters';
  if (name.includes('note') || name.includes('tag') || filter.includes('note') || filter.includes('tag')) return 'notes';
  if (tab.columns.some((column) => column.field === 'screenTime')) return 'characters';
  return 'script';
}

function getPanelCount(kind: NavigatorTabKind, scenes: number, characters: number, noteTags: number): string {
  if (kind === 'characters') return `${characters} characters`;
  if (kind === 'notes') return `${noteTags} notes/tags`;
  return `${scenes} scenes`;
}

function collectNoteTagRows(elements: ScriptElement[]): NoteTagRow[] {
  const rows: NoteTagRow[] = [];
  let page = 1;
  let currentScene = 'Before first scene';

  for (const element of elements) {
    if (element.type === 'page-break') page += 1;
    if (element.type === 'scene-heading') currentScene = element.text || currentScene;

    const tags = element.productionTags.map((tag) => `${tag.category}: ${tag.label}`);
    const notes = element.notes.map((note) => `${note.resolved ? 'Resolved' : 'Note'}: ${note.text}`);
    if (!tags.length && !notes.length) continue;

    rows.push({
      id: element.id,
      title: element.type === 'scene-heading' ? currentScene : element.text || currentScene,
      context: currentScene,
      summary: [...tags, ...notes].join(' | '),
      page
    });
  }

  return rows;
}

function findCharacterElementId(elements: ScriptElement[], characterName: string): string | undefined {
  return elements.find((element) => element.type === 'character' && normalizeCharacterName(element.text) === characterName)?.id;
}
