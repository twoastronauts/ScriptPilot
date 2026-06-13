import { computeWritingStats } from '@/shared/stats';
import { useWorkspace } from '@/store/workspace';
import type * as React from 'react';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CharacterProfile } from '@/shared/types';

export function CharactersPanel() {
  const { document, addCharacter, updateCharacter, renameCharacter } = useWorkspace();
  const [pendingRename, setPendingRename] = useState<{ id: string; from: string; to: string } | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const stats = computeWritingStats(document);
  const statsByName = useMemo(() => new Map(stats.characters.map((character) => [character.name, character])), [stats.characters]);
  const profiles = useMemo(() => mergeCharacterProfiles(document.characters, stats.characters.map((character) => character.name)), [document.characters, stats.characters]);

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Characters</span>
        <button title="Add character" onClick={addCharacter}>
          <Plus size={15} />
        </button>
      </div>
      <div className="character-panel-list">
        {profiles.map((profile) => {
          const characterStats = statsByName.get(profile.name);
          return (
          <div key={profile.id} className="character-card character-card--editable">
            <i style={{ '--character-color': profile.color ?? '#55b8c7' } as React.CSSProperties} />
            <input
              aria-label="Character name"
              value={nameDrafts[profile.id] ?? profile.name}
              onChange={(event) => setNameDrafts((drafts) => ({ ...drafts, [profile.id]: event.target.value.toUpperCase() }))}
              onBlur={(event) => {
                const nextName = event.target.value.trim().toUpperCase();
                setNameDrafts((drafts) => {
                  const { [profile.id]: _removed, ...rest } = drafts;
                  return rest;
                });
                if (nextName && nextName !== profile.name) setPendingRename({ id: profile.id, from: profile.name, to: nextName });
              }}
            />
            <input aria-label="Character color" type="color" value={profile.color} onChange={(event) => updateCharacter(profile.id, { color: event.target.value })} />
            <span>{characterStats?.scenes ?? 0} scenes</span>
            <small>{characterStats?.interactions.length ? `With ${characterStats.interactions.join(', ')}` : 'No interactions yet'}</small>
            <textarea
              aria-label="Character demographics"
              placeholder="Demographics / identity notes entered by the writer"
              value={profile.demographics ?? ''}
              onChange={(event) => updateCharacter(profile.id, { demographics: event.target.value })}
            />
            <textarea
              aria-label="Character description"
              placeholder="Description, voice, wants, contradictions"
              value={profile.description ?? profile.notes ?? ''}
              onChange={(event) => updateCharacter(profile.id, { description: event.target.value, notes: event.target.value })}
            />
          </div>
          );
        })}
        {!profiles.length && (
          <div className="home-empty">
            <strong>No characters yet</strong>
            <span>Character cues will appear here as you write.</span>
          </div>
        )}
      </div>
      {pendingRename && (
        <div className="confirm-scrim" role="dialog" aria-modal="true" aria-label="Confirm character rename">
          <div className="confirm-dialog">
            <strong>Rename throughout script?</strong>
            <span>
              Change every character cue from {pendingRename.from} to {pendingRename.to}? This updates matching script instances.
            </span>
            <div className="segmented">
              <button
                onClick={() => {
                  renameCharacter(pendingRename.id, pendingRename.to, true);
                  setPendingRename(null);
                }}
              >
                Apply to script
              </button>
              <button
                onClick={() => {
                  renameCharacter(pendingRename.id, pendingRename.to, false);
                  setPendingRename(null);
                }}
              >
                Profile only
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function mergeCharacterProfiles(profiles: CharacterProfile[], scriptNames: string[]): CharacterProfile[] {
  const byName = new Map(profiles.map((profile) => [profile.name, profile]));
  const derived = scriptNames
    .filter((name) => !byName.has(name))
    .map((name, index) => ({
      id: `derived-${name}`,
      name,
      aliases: [],
      color: ['#2f6fed', '#c24c3a', '#0f9f83', '#7b4fd6'][index % 4],
      description: '',
      demographics: ''
    }));
  return [...profiles, ...derived];
}
