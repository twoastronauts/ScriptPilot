import { describe, expect, it } from 'vitest';
import { createDocumentFromPlainText } from '@/shared/defaultDocument';
import {
  buildProductionBoard,
  collectProductionScenes,
  generateDefaultShotsFromScenes,
  groupScenesByLocationTime,
  parseSceneHeading
} from '@/shared/productionSuite';

describe('production suite', () => {
  it('parses scene heading location and time', () => {
    expect(parseSceneHeading('EXT. ALLEY - NIGHT')).toEqual({
      sceneType: 'EXT.',
      location: 'ALLEY',
      timeOfDay: 'NIGHT'
    });

    expect(parseSceneHeading('EXT. PARK - CONTINUOUS - DAY')).toEqual({
      sceneType: 'EXT.',
      location: 'PARK - CONTINUOUS',
      timeOfDay: 'DAY'
    });
  });

  it('collects scene breakdowns with characters, tags, notes, and summaries', () => {
    const document = createProductionDocument();
    const scenes = collectProductionScenes(document);

    expect(scenes).toHaveLength(3);
    expect(scenes[0]).toMatchObject({
      sceneNumber: 1,
      sceneType: 'INT.',
      location: 'KITCHEN',
      timeOfDay: 'NIGHT',
      page: 1
    });
    expect(scenes[0].characters).toEqual(['MARA', 'JON']);
    expect(scenes[0].productionTags).toEqual([
      expect.objectContaining({
        category: 'prop',
        label: 'Red phone',
        count: 1,
        sceneHeadings: ['INT. KITCHEN - NIGHT']
      })
    ]);
    expect(scenes[0].notes).toHaveLength(1);
    expect(scenes[0].actionSummary).toBe('A red phone rings on the counter.');
  });

  it('derives a production board from script scenes, cast, and tags', () => {
    const document = createDocumentFromPlainText(
      'Production',
      ['INT. ROOM - NIGHT', 'MARA', 'The red phone rings.', 'JON', 'Pick it up.', 'EXT. ALLEY - NIGHT', 'MARA', 'Run.'].join('\n')
    );
    document.elements[2].productionTags.push({ id: 'tag-1', category: 'prop', label: 'Red phone', color: '#c24c3a' });

    const board = buildProductionBoard(document);

    expect(board.scenes).toHaveLength(2);
    expect(board.tags[0].label).toBe('Red phone');
    expect(board.shotList.some((shot) => shot.shotType === 'master')).toBe(true);
    expect(board.storyboardCards).toHaveLength(board.shotList.length);
    expect(board.stripboardSchedule.length).toBeGreaterThan(0);
    expect(board.callSheets[0].recipients.some((recipient) => recipient.department === 'Cast')).toBe(true);
  });

  it('groups scenes and creates default coverage shots', () => {
    const document = createDocumentFromPlainText('Shots', ['INT. ROOM - DAY', 'MARA', 'Hello.', 'INT. ROOM - DAY', 'JON', 'Hi.'].join('\n'));
    const board = buildProductionBoard(document);
    const groups = groupScenesByLocationTime(board.scenes);
    const shots = generateDefaultShotsFromScenes(board.scenes);

    expect(groups).toHaveLength(1);
    expect(groups[0].sceneIds).toHaveLength(2);
    expect(shots.filter((shot) => shot.shotType === 'coverage')).toHaveLength(2);
  });

  it('groups scenes by location and time in first-seen order', () => {
    const scenes = collectProductionScenes(createProductionDocument());
    const groups = groupScenesByLocationTime(scenes);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      location: 'KITCHEN',
      timeOfDay: 'NIGHT',
      sceneIds: [scenes[0].id, scenes[2].id],
      characters: ['MARA', 'JON']
    });
    expect(groups[1]).toMatchObject({
      location: 'STREET',
      timeOfDay: 'DAY',
      sceneIds: [scenes[1].id]
    });
  });

  it('generates default master, coverage, and insert shots from scene data', () => {
    const scenes = collectProductionScenes(createProductionDocument());
    const shots = generateDefaultShotsFromScenes(scenes);
    const firstSceneShots = shots.filter((shot) => shot.sceneId === scenes[0].id);

    expect(firstSceneShots.map((shot) => shot.setup)).toEqual(['1A', '1B', '1C', '1D']);
    expect(firstSceneShots.some((shot) => shot.shotType === 'master' && shot.subject === 'KITCHEN')).toBe(true);
    expect(firstSceneShots.some((shot) => shot.shotType === 'coverage' && shot.subject === 'MARA')).toBe(true);
    expect(firstSceneShots.some((shot) => shot.shotType === 'insert' && shot.subject === 'Red phone')).toBe(true);
  });

  it('builds call sheet contacts and recipients from characters and departments', () => {
    const board = buildProductionBoard(createProductionDocument());

    expect(board.stripboardSchedule).toHaveLength(2);
    expect(board.storyboardCards).toHaveLength(board.shotList.length);
    expect(board.tags.find((tag) => tag.label === 'Red phone')?.sceneHeadings).toEqual(['INT. KITCHEN - NIGHT']);
    expect(board.contacts.some((contact) => contact.characterName === 'MARA')).toBe(true);
    expect(board.recipients.some((recipient) => recipient.name === 'MARA' && recipient.channel === 'email')).toBe(true);
    expect(board.callSheets[0].recipients.some((recipient) => recipient.department === 'Props')).toBe(true);
  });
});

function createProductionDocument() {
  const document = createDocumentFromPlainText(
    'Production',
    [
      'INT. KITCHEN - NIGHT',
      'A red phone rings on the counter.',
      'MARA',
      'We need it.',
      'JON',
      'Already here.',
      'EXT. STREET - DAY',
      'Traffic folds around a stalled car.',
      'MARA',
      'Run.',
      'INT. KITCHEN - NIGHT',
      'The counter is bare.',
      'JON',
      'The phone is gone.'
    ].join('\n')
  );

  const redPhone = document.elements.find((element) => element.text === 'A red phone rings on the counter.');
  redPhone?.productionTags.push({ id: 'tag-phone', category: 'prop', label: 'Red phone', color: '#c24c3a' });
  redPhone?.notes.push({ id: 'note-phone', text: 'Hero prop', color: '#ffe08a', resolved: false, createdAt: '2026-01-01T00:00:00.000Z' });

  const stalledCar = document.elements.find((element) => element.text === 'Traffic folds around a stalled car.');
  stalledCar?.productionTags.push({ id: 'tag-car', category: 'vehicle', label: 'Stalled car', color: '#2f6fed' });

  const mara = document.characters.find((character) => character.name === 'MARA');
  if (mara) mara.userMetadata = { email: 'mara@example.com' };

  return document;
}
