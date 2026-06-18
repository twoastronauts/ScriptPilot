import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { documentMap, readDocumentSnapshot, writeDocumentSnapshot } from './collaboration';
import { estimatePageCount } from './screenplay';
import { useWorkspace } from '@/store/workspace';
import type { CollabParticipant, CollabPermission, CollabSession, ScriptDocument } from './types';

interface LiveCollabRuntime {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  unsubscribeWorkspace: () => void;
  unsubscribeLocation: () => void;
  session: CollabSession;
  applyingRemote: boolean;
  synced: boolean;
}

const LOCAL_ORIGIN = 'script-pilot-local';
let runtime: LiveCollabRuntime | undefined;

export function connectLiveCollab(session: CollabSession, userName = 'Writer'): void {
  disconnectLiveCollab(false);

  const ydoc = new Y.Doc();
  const state = useWorkspace.getState();
  if (session.isHost) writeDocumentSnapshot(ydoc, state.document, LOCAL_ORIGIN);

  const provider = new HocuspocusProvider({
    url: session.url,
    name: session.roomId,
    token: session.token,
    document: ydoc,
    onStatus: ({ status }) => {
      const nextStatus = status === 'connected' ? 'connected' : status === 'disconnected' ? 'reconnecting' : 'joining';
      useWorkspace.getState().setCollabStatus(nextStatus);
    },
    onSynced: ({ state: synced }) => {
      if (!runtime) return;
      runtime.synced = synced;
      if (synced) applyIncomingSnapshot();
    },
    onAwarenessChange: () => {
      updateParticipants();
    },
    onAuthenticationFailed: ({ reason }) => {
      useWorkspace.getState().setWarning(`Collaboration failed: ${reason}`);
      useWorkspace.getState().setCollabStatus('error');
    }
  });

  runtime = {
    ydoc,
    provider,
    session,
    applyingRemote: false,
    synced: false,
    unsubscribeWorkspace: () => undefined,
    unsubscribeLocation: () => undefined
  };

  provider.setAwarenessField('user', {
    name: userName.trim() || 'Writer',
    color: colorForUser(userName),
    permission: session.permission,
    isHost: session.isHost
  });
  updateLocalLocation();

  const map = documentMap(ydoc);
  map.observe((_event, transaction) => {
    if (transaction.origin === LOCAL_ORIGIN) return;
    applyIncomingSnapshot();
  });

  let lastDocument: ScriptDocument | undefined = state.document;
  runtime.unsubscribeWorkspace = useWorkspace.subscribe((nextState) => {
    if (!runtime || runtime.applyingRemote) return;
    if (nextState.document === lastDocument) return;
    lastDocument = nextState.document;
    if (!canWrite(runtime.session.permission)) return;
    if (!runtime.session.isHost && !runtime.synced) return;
    writeDocumentSnapshot(runtime.ydoc, nextState.document, LOCAL_ORIGIN);
  });

  let lastSelected = state.selectedElementId;
  runtime.unsubscribeLocation = useWorkspace.subscribe((nextState) => {
    if (nextState.selectedElementId === lastSelected && nextState.document === lastDocument) return;
    lastSelected = nextState.selectedElementId;
    updateLocalLocation();
  });

  useWorkspace.getState().setCollabSession({ ...session, status: session.isHost ? 'hosting' : 'joining' });
  updateParticipants();
}

export function disconnectLiveCollab(markEnded = true): void {
  if (!runtime) return;
  const current = runtime;
  runtime = undefined;
  current.unsubscribeWorkspace();
  current.unsubscribeLocation();
  current.provider.destroy();
  current.ydoc.destroy();
  useWorkspace.getState().setCollabParticipants([]);
  if (markEnded) useWorkspace.getState().setCollabStatus('ended');
}

export function currentLiveCollabInvite(): string | undefined {
  return runtime?.session.invite?.appUrl ?? runtime?.session.invite?.manualCode;
}

function applyIncomingSnapshot(): void {
  if (!runtime) return;
  const snapshot = readDocumentSnapshot(runtime.ydoc);
  if (!snapshot) return;
  runtime.applyingRemote = true;
  try {
    useWorkspace.getState().applyRemoteDocument(snapshot);
  } finally {
    runtime.applyingRemote = false;
  }
}

function updateLocalLocation(): void {
  if (!runtime?.provider.awareness) return;
  const state = useWorkspace.getState();
  const selected = state.document.elements.find((element) => element.id === state.selectedElementId);
  runtime.provider.setAwarenessField('location', {
    selectedElementId: state.selectedElementId,
    scene: selected?.type === 'scene-heading' ? selected.text : undefined,
    page: Math.max(1, Math.min(estimatePageCount(state.document.elements), estimatePageForElement(state.document, state.selectedElementId)))
  });
}

function updateParticipants(): void {
  if (!runtime?.provider.awareness) return;
  const now = new Date().toISOString();
  const participants: CollabParticipant[] = [];
  runtime.provider.awareness.getStates().forEach((state, clientId) => {
    const user = state.user as Partial<CollabParticipant> | undefined;
    const location = state.location as Partial<CollabParticipant> | undefined;
    participants.push({
      id: String(clientId),
      name: user?.name || `Writer ${clientId}`,
      color: user?.color || colorForUser(String(clientId)),
      permission: (user?.permission as CollabPermission | undefined) ?? 'edit',
      page: location?.page,
      scene: location?.scene,
      selectedElementId: location?.selectedElementId,
      online: true,
      isLocal: clientId === runtime?.ydoc.clientID,
      lastSeenAt: now
    });
  });
  useWorkspace.getState().setCollabParticipants(participants);
}

function canWrite(permission: CollabPermission): boolean {
  return permission === 'host' || permission === 'edit';
}

function estimatePageForElement(document: ScriptDocument, elementId?: string): number {
  if (!elementId) return 1;
  let page = 1;
  for (const element of document.elements) {
    if (element.id === elementId) return page;
    if (element.type === 'page-break') page += 1;
  }
  return page;
}

function colorForUser(seed: string): string {
  const colors = ['#55b8c7', '#d69b3a', '#c95a5a', '#8d7cf6', '#5fbf8f', '#f06f9f'];
  const hash = Array.from(seed || 'writer').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
