import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import { documentWithTitleFromSavePath, isGenericUntitledTitle, titleFromFilePath } from '@/shared/fileSafety';
import { parseProject, PROJECT_FORMAT_VERSION, serializeProject } from '@/shared/projectFile';
import type { ScriptDocument } from '@/shared/types';

describe('Script Pilot official identity and project files', () => {
  it('uses the official app identity and artifact naming', () => {
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.build.productName).toBe('Script Pilot');
    expect(packageJson.build.appId).toBe('com.twoastronauts.scriptpilot');
    expect(packageJson.build.artifactName).toContain('Script-Pilot-');
    expect(packageJson.build.artifactName).not.toContain('V02');
    expect(packageJson.build.fileAssociations).toEqual([
      expect.objectContaining({
        ext: 'spx',
        name: 'Script Pilot Project'
      })
    ]);
    expect(packageJson.build.fileAssociations.some((association) => association.ext === 'spx2')).toBe(false);
  });

  it('serializes official projects without losing earlier manual-open compatibility', () => {
    const document = createDocumentFromPlainText('Official Project', 'INT. ROOM - DAY\nMARA\nReady.');
    const serialized = serializeProject(document);
    const parsedWrapper = JSON.parse(serialized) as { format: string; version: number };

    expect(parsedWrapper.format).toBe('script-pilot-v02-project');
    expect(parsedWrapper.version).toBe(PROJECT_FORMAT_VERSION);
    expect(parseProject(serialized).title).toBe('Official Project');

    const legacy = JSON.stringify({ ...document, sceneIntents: undefined, draftVersions: undefined });
    const parsedLegacy = parseProject(legacy) as ScriptDocument;
    expect(parsedLegacy.title).toBe('Official Project');
    expect(parsedLegacy.elements.length).toBeGreaterThan(0);
  });

  it('starts new official documents with local-first assistant metadata', () => {
    const document = createDocumentFromPlainText('Fresh Script Pilot', '');

    expect(document.sceneIntents).toEqual([]);
    expect(document.draftVersions).toEqual([]);
    expect(document.revisionMemos).toEqual([]);
    expect(document.collabRooms).toEqual([]);
    expect(document.exportPackages).toEqual([]);
    expect(document.settings.collabProvider).toBe('local');
    expect(document.settings.viewMode).toBe('midnight');
    expect(document.settings.themeColors).toEqual({});
    expect(document.beats.every((beat) => beat.scriptSyncState === 'unlinked')).toBe(true);
  });

  it('updates generic untitled projects from the first saved .spx filename', () => {
    const untitled = createDocumentFromPlainText('Untitled Script Pilot Script', 'INT. ROOM - DAY');
    const titled = createDocumentFromPlainText('Already Named', 'INT. ROOM - DAY');

    expect(isGenericUntitledTitle(untitled.title)).toBe(true);
    expect(titleFromFilePath('C:\\Scripts\\Moon Landing.spx')).toBe('Moon Landing');
    expect(documentWithTitleFromSavePath(untitled, 'C:\\Scripts\\Moon Landing.spx').title).toBe('Moon Landing');
    expect(documentWithTitleFromSavePath(titled, 'C:\\Scripts\\Different Name.spx').title).toBe('Already Named');
  });
});
