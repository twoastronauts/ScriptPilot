import { BarChart3, Boxes, Clapperboard, GitBranch, Keyboard, PanelRightClose, PanelRightOpen, Settings, StickyNote, Users } from 'lucide-react';
import { BeatBoard } from './panels/BeatBoard';
import { CharactersPanel } from './panels/CharactersPanel';
import { StatsPanel } from './panels/StatsPanel';
import { ProductionPanel } from './panels/ProductionPanel';
import { StudioPanel } from './panels/StudioPanel';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { useWorkspace } from '@/store/workspace';

const tabs = [
  { id: 'beats', label: 'Beats', icon: Boxes },
  { id: 'characters', label: 'Characters', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'production', label: 'Notes/Tags', icon: StickyNote },
  { id: 'studio', label: 'Shot List', icon: Clapperboard },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const;

export function RightRail() {
  const { activeRightPanel, rightRailCollapsed, setPanel, toggleRightRailCollapsed, setRightRailCollapsed } = useWorkspace();

  function activatePanel(panel: (typeof tabs)[number]['id']) {
    if (rightRailCollapsed) setRightRailCollapsed(false);
    setPanel(panel);
  }

  return (
    <aside className={rightRailCollapsed ? 'right-rail is-collapsed' : 'right-rail'}>
      <div className="rail-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={activeRightPanel === tab.id ? 'is-active' : ''} title={tab.label} onClick={() => activatePanel(tab.id)}>
              <Icon size={17} />
            </button>
          );
        })}
        <button title="Collaboration ready">
          <GitBranch size={17} />
        </button>
        <button className="rail-tabs__collapse" title={rightRailCollapsed ? 'Show side panel' : 'Hide side panel'} onClick={toggleRightRailCollapsed}>
          {rightRailCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
        </button>
      </div>
      <div className="rail-panel">
        {activeRightPanel === 'beats' && <BeatBoard />}
        {activeRightPanel === 'characters' && <CharactersPanel />}
        {activeRightPanel === 'stats' && <StatsPanel />}
        {activeRightPanel === 'production' && <ProductionPanel />}
        {activeRightPanel === 'studio' && <StudioPanel />}
        {activeRightPanel === 'shortcuts' && <ShortcutsPanel />}
        {activeRightPanel === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  );
}
