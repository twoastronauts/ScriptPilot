import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { parseProject, PROJECT_FORMAT_VERSION, serializeProject } from '@/shared/projectFile';
import type { ScriptDocument } from '@/shared/types';

describe('Script Pilot V02 identity and project files', () => {
  it('uses a side-by-side app identity and artifact naming', () => {
    expect(packageJson.version).toBe('0.2.0');
    expect(packageJson.build.productName).toBe('Script Pilot V02');
    expect(packageJson.build.appId).toBe('com.twoastronauts.scriptpilot.v02');
    expect(packageJson.build.artifactName).toContain('Script-Pilot-V02');
    expect(packageJson.build.fileAssociations).toEqual([
      expect.objectContaining({
        ext: 'spx2',
        name: 'Script Pilot V02 Project'
      })
    ]);
    expect(packageJson.build.fileAssociations.some((association) => association.ext === 'spx')).toBe(false);
  });

  it('serializes V02 projects without losing V01 manual-open compatibility', () => {
    const document = createDocumentFromPlainText('V02 Project', 'INT. ROOM - DAY\nMARA\nReady.');
    const serialized = serializeProject(document);
    const parsedWrapper = JSON.parse(serialized) as { format: string; version: number };

    expect(parsedWrapper.format).toBe('script-pilot-v02-project');
    expect(parsedWrapper.version).toBe(PROJECT_FORMAT_VERSION);
    expect(parseProject(serialized).title).toBe('V02 Project');

    const legacy = JSON.stringify({ ...document, sceneIntents: undefined, draftVersions: undefined });
    const parsedLegacy = parseProject(legacy) as ScriptDocument;
    expect(parsedLegacy.title).toBe('V02 Project');
    expect(parsedLegacy.elements.length).toBeGreaterThan(0);
  });

  it('starts new V02 documents with local-first assistant metadata', () => {
    const document = createDocumentFromPlainText('Fresh V02', '');

    expect(document.sceneIntents).toEqual([]);
    expect(document.draftVersions).toEqual([]);
    expect(document.revisionMemos).toEqual([]);
    expect(document.collabRooms).toEqual([]);
    expect(document.exportPackages).toEqual([]);
    expect(document.settings.collabProvider).toBe('local');
    expect(document.settings.viewMode).toBe('midnight');
    expect(document.beats.every((beat) => beat.scriptSyncState === 'unlinked')).toBe(true);
  });
});
