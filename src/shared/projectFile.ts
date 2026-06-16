import type { ScriptDocument } from './types';

export const PROJECT_FORMAT_VERSION = 2;

export function serializeProject(document: ScriptDocument): string {
  return JSON.stringify(
    {
      format: 'script-pilot-v02-project',
      version: PROJECT_FORMAT_VERSION,
      document
    },
    null,
    2
  );
}

export function parseProject(text: string): ScriptDocument {
  const parsed = JSON.parse(text) as { document?: ScriptDocument } | ScriptDocument;
  if ('document' in parsed && parsed.document) return parsed.document;
  return parsed as ScriptDocument;
}
