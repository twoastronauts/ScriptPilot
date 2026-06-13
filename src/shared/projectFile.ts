import type { ScriptDocument } from './types';

const PROJECT_FORMAT_VERSION = 1;

export function serializeProject(document: ScriptDocument): string {
  return JSON.stringify(
    {
      format: 'script-pilot-project',
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
