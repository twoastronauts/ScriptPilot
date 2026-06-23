import { computeWritingStats } from '@/shared/stats';
import { analyzeDialogue } from '@/shared/dialogueStudio';
import { createDefaultCharacterArc } from '@/shared/defaultDocument';
import { useWorkspace } from '@/store/workspace';
import type * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CharacterProfile } from '@/shared/types';

export function CharactersPanel() {
  const { document, addCharacter, updateCharacter, updateCharacterArc, renameCharacter, deleteCharacter } = useWorkspace();
  const [pendingRename, setPendingRename] = useState<{ id: string; from: string; to: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const stats = computeWritingStats(document);
  const statsByName = useMemo(() => new Map(stats.characters.map((character) => [character.name, character])), [stats.characters]);
  const dialogueByName = useMemo(() => new Map(analyzeDialogue(document).map((analysis) => [analysis.characterName, analysis])), [document]);
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
          const dialogue = dialogueByName.get(profile.name);
          const arc = { ...createDefaultCharacterArc(), ...(profile.arc ?? {}) };
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
            <button className="icon-button danger" title={`Delete ${profile.name}`} aria-label={`Delete ${profile.name}`} onClick={() => setPendingDelete({ id: profile.id, name: profile.name })}>
              <Trash2 size={14} />
            </button>
            <span>{characterStats?.scenes ?? 0} scenes</span>
            <small>{characterStats?.interactions.length ? `With ${characterStats.interactions.join(', ')}` : 'No interactions yet'}</small>
            <small>{dialogue ? `${dialogue.wordCount} dialogue words / ${dialogue.averageWordsPerLine} avg` : 'No dialogue analysis yet'}</small>
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
            <div className="character-arc-grid">
              <input aria-label="Character want" placeholder="Want" value={arc.want} onChange={(event) => updateCharacterArc(profile.id, { want: event.target.value })} />
              <input aria-label="Character need" placeholder="Need" value={arc.need} onChange={(event) => updateCharacterArc(profile.id, { need: event.target.value })} />
              <input aria-label="Character wound" placeholder="Wound" value={arc.wound} onChange={(event) => updateCharacterArc(profile.id, { wound: event.target.value })} />
              <input aria-label="Character secret" placeholder="Secret" value={arc.secret} onChange={(event) => updateCharacterArc(profile.id, { secret: event.target.value })} />
            </div>
            <textarea
              aria-label="Character voice notes"
              placeholder="Voice notes, contradictions, repeated language, actor clues"
              value={arc.voiceNotes}
              onChange={(event) => updateCharacterArc(profile.id, { voiceNotes: event.target.value })}
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
      {pendingDelete && (
        <div className="confirm-scrim" role="dialog" aria-modal="true" aria-label="Confirm character deletion">
          <div className="confirm-dialog">
            <strong>Remove character?</strong>
            <span>
              Remove {pendingDelete.name} from the Characters panel? You can hide the profile only, or also remove matching character cue lines from the script.
            </span>
            <div className="segmented">
              <button
                onClick={() => {
                  deleteCharacter(pendingDelete.id, false);
                  setPendingDelete(null);
                }}
              >
                Hide profile
              </button>
              <button
                className="danger"
                onClick={() => {
                  deleteCharacter(pendingDelete.id, true);
                  setPendingDelete(null);
                }}
              >
                Remove cues
              </button>
              <button onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function mergeCharacterProfiles(profiles: CharacterProfile[], scriptNames: string[]): CharacterProfile[] {
  const visibleProfiles = profiles.filter((profile) => !profile.hidden);
  const hiddenNames = new Set(profiles.filter((profile) => profile.hidden).map((profile) => profile.name));
  const byName = new Map(visibleProfiles.map((profile) => [profile.name, profile]));
  const derived = scriptNames
    .filter((name) => !byName.has(name) && !hiddenNames.has(name))
    .map((name, index) => ({
      id: `derived-${name}`,
      name,
      aliases: [],
      color: ['#2f6fed', '#c24c3a', '#0f9f83', '#7b4fd6'][index % 4],
      description: '',
      demographics: '',
      arc: createDefaultCharacterArc()
    }));
  return [...visibleProfiles, ...derived];
}
