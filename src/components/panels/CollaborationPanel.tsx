import { Copy, Link2, LogOut, Play, Shield, UserPlus, Wifi } from 'lucide-react';
import { useMemo, useState } from 'react';
import { connectLiveCollab, currentLiveCollabInvite, disconnectLiveCollab } from '@/shared/liveCollabClient';
import { useWorkspace } from '@/store/workspace';
import type { CollabInvite, CollabParticipant, CollabPermission } from '@/shared/types';

const permissions: Array<{ id: CollabPermission; label: string }> = [
  { id: 'edit', label: 'Can edit' },
  { id: 'comment', label: 'Can comment' },
  { id: 'read', label: 'Read only' }
];

export function CollaborationPanel() {
  const { document, collabSession, collabParticipants, setWarning } = useWorkspace();
  const [userName, setUserName] = useState(() => localStorage.getItem('script-pilot:user-name') ?? 'Writer');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState<CollabInvite | undefined>(collabSession?.invite);
  const [permission, setPermission] = useState<CollabPermission>('edit');
  const [busy, setBusy] = useState(false);

  const statusLabel = useMemo(() => {
    if (!collabSession) return 'Offline';
    if (collabSession.isHost && collabSession.status === 'hosting') return 'Hosting';
    return collabSession.status.charAt(0).toUpperCase() + collabSession.status.slice(1);
  }, [collabSession]);

  async function startHost() {
    setBusy(true);
    try {
      rememberUserName(userName);
      const result = await window.screenwriter?.startCollabHost(document, { userName });
      if (!result || result.canceled) return;
      setInvite(result.data.invite);
      connectLiveCollab(
        {
          roomId: result.data.roomId,
          roomName: result.data.roomName,
          url: `ws://127.0.0.1:${result.data.port}`,
          token: result.data.invite.token,
          permission: 'host',
          isHost: true,
          status: 'hosting',
          startedAt: result.data.startedAt,
          invite: result.data.invite
        },
        userName
      );
      setWarning(`Hosting "${result.data.roomName}" on ${result.data.host}:${result.data.port}`);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!joinCode.trim()) {
      setWarning('Paste a Script Pilot collaboration link or manual code first.');
      return;
    }
    setBusy(true);
    try {
      rememberUserName(userName);
      const result = await window.screenwriter?.joinCollabRoom({ invite: joinCode, userName });
      if (!result || result.canceled) return;
      connectLiveCollab(result.data, userName);
      setInvite(result.data.invite);
      setWarning(`Joining "${result.data.roomName}".`);
    } finally {
      setBusy(false);
    }
  }

  async function stopSession() {
    if (collabSession?.isHost) await window.screenwriter?.stopCollabHost(collabSession.roomId);
    disconnectLiveCollab();
    setInvite(undefined);
    setWarning(collabSession?.isHost ? 'Collaboration session ended.' : 'Left collaboration session.');
  }

  async function createInvite() {
    if (!collabSession?.isHost) return;
    const result = await window.screenwriter?.createCollabInvite({ roomId: collabSession.roomId, permission });
    if (!result || result.canceled) return;
    setInvite(result.data);
    const copied = await copyText(result.data.appUrl);
    setWarning(copied ? `${labelForPermission(permission)} invite copied.` : `${labelForPermission(permission)} invite created, but clipboard copy failed.`);
  }

  async function copyCurrentInvite() {
    const text = invite?.appUrl ?? currentLiveCollabInvite();
    if (!text) return;
    const copied = await copyText(text);
    setWarning(copied ? 'Collaboration invite copied.' : 'Clipboard copy failed. Select the visible invite link and copy it manually.');
  }

  return (
    <section className="panel collaboration-panel">
      <div className="panel-title">
        <span>Collaboration</span>
        <small>{statusLabel}</small>
      </div>

      <div className="collab-card collab-card--notice">
        <Wifi size={18} />
        <span>Free self-host mode works best on the same Wi-Fi, LAN, VPN, or a reachable host address. If the host quits, the live room ends.</span>
      </div>

      <label className="collab-field">
        <span>Your name</span>
        <input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="Writer name" />
      </label>

      {!collabSession && (
        <>
          <button className="collab-primary" disabled={busy} onClick={startHost}>
            <Play size={17} />
            <span>Start hosting this script</span>
          </button>
          <div className="collab-join">
            <textarea value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Paste scriptpilot:// link or manual invite code" />
            <button disabled={busy} onClick={joinRoom}>
              <UserPlus size={17} />
              <span>Join session</span>
            </button>
          </div>
        </>
      )}

      {collabSession && (
        <>
          <div className="collab-card">
            <Shield size={18} />
            <div>
              <strong>{collabSession.roomName}</strong>
              <span>{collabSession.isHost ? 'You are the host. Ending this stops the session for everyone.' : `Permission: ${labelForPermission(collabSession.permission)}`}</span>
            </div>
          </div>

          {collabSession.isHost && (
            <div className="collab-invite-row">
              <select value={permission} onChange={(event) => setPermission(event.target.value as CollabPermission)}>
                {permissions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button onClick={createInvite}>
                <Link2 size={16} />
                <span>Create link</span>
              </button>
            </div>
          )}

          {invite && (
            <div className="collab-code">
              <small>{invite.appUrl}</small>
              <button title="Copy invite" onClick={copyCurrentInvite}>
                <Copy size={16} />
              </button>
            </div>
          )}

          <div className="collab-participants">
            <strong>{collabParticipants.length || 1} participant{(collabParticipants.length || 1) === 1 ? '' : 's'}</strong>
            {(collabParticipants.length ? collabParticipants : fallbackParticipant(userName, collabSession.permission)).map((participant) => (
              <div key={participant.id} className="collab-person">
                <i style={{ '--participant-color': participant.color } as React.CSSProperties} />
                <span>{participant.name}{participant.isLocal ? ' (you)' : ''}</span>
                <small>{participant.page ? `pg. ${participant.page}` : labelForPermission(participant.permission)}</small>
              </div>
            ))}
          </div>

          <button className="collab-danger" onClick={stopSession}>
            <LogOut size={17} />
            <span>{collabSession.isHost ? 'End session' : 'Leave session'}</span>
          </button>
        </>
      )}
    </section>
  );
}

function rememberUserName(userName: string): void {
  localStorage.setItem('script-pilot:user-name', userName.trim() || 'Writer');
}

async function copyText(text: string): Promise<boolean> {
  if (window.screenwriter?.copyToClipboard) {
    const result = await window.screenwriter.copyToClipboard(text);
    return Boolean(result && !result.canceled && result.data.text === text);
  }
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

function labelForPermission(permission: CollabPermission): string {
  if (permission === 'host') return 'Host';
  return permissions.find((item) => item.id === permission)?.label ?? permission;
}

function fallbackParticipant(userName: string, permission: CollabPermission): CollabParticipant[] {
  return [{ id: 'local', name: userName || 'Writer', color: '#55b8c7', permission, online: true, isLocal: true, lastSeenAt: new Date().toISOString() }];
}
