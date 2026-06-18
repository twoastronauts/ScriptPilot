import * as Y from 'yjs';
import type { CollabProvider, CollabStatus } from './adapters';
import type { ScriptDocument } from './types';

const DOCUMENT_KEY = 'script-document';
const SNAPSHOT_KEY = 'snapshot';

export function documentToYDoc(document: ScriptDocument): Y.Doc {
  const ydoc = new Y.Doc();
  writeDocumentSnapshot(ydoc, document);
  return ydoc;
}

export function yDocToDocument(ydoc: Y.Doc, fallback: ScriptDocument): ScriptDocument {
  const snapshot = ydoc.getMap(DOCUMENT_KEY).get(SNAPSHOT_KEY);
  if (isScriptDocument(snapshot)) return snapshot;
  return fallback;
}

export function documentMap(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap(DOCUMENT_KEY);
}

export function writeDocumentSnapshot(ydoc: Y.Doc, document: ScriptDocument, origin?: unknown): void {
  ydoc.transact(() => {
    documentMap(ydoc).set(SNAPSHOT_KEY, document);
  }, origin);
}

export function readDocumentSnapshot(ydoc: Y.Doc, fallback?: ScriptDocument): ScriptDocument | undefined {
  const snapshot = documentMap(ydoc).get(SNAPSHOT_KEY);
  if (isScriptDocument(snapshot)) return snapshot;
  return fallback;
}

export function encodeDocumentUpdate(document: ScriptDocument): Uint8Array {
  const ydoc = documentToYDoc(document);
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyDocumentUpdate(document: ScriptDocument, update: Uint8Array): ScriptDocument {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, update);
  return yDocToDocument(ydoc, document);
}

export class LocalFirstCollabProvider implements CollabProvider {
  status: CollabStatus = 'offline';

  private listeners = new Set<(status: CollabStatus) => void>();

  async connect(_documentId: string, endpoint?: string): Promise<void> {
    this.setStatus(endpoint ? 'connecting' : 'offline');
    if (endpoint) {
      this.setStatus('error');
      throw new Error('Remote collaboration endpoint is not configured in this build.');
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus('offline');
  }

  encodeLocalState(document: ScriptDocument): Uint8Array {
    return encodeDocumentUpdate(document);
  }

  applyRemoteUpdate(document: ScriptDocument, update: Uint8Array): ScriptDocument {
    return applyDocumentUpdate(document, update);
  }

  onStatusChange(listener: (status: CollabStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: CollabStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

export function isScriptDocument(value: unknown): value is ScriptDocument {
  return typeof value === 'object' && value !== null && 'elements' in value && 'settings' in value;
}
