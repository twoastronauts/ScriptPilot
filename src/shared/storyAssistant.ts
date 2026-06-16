import { analyzeDialogue } from './dialogueStudio';
import { collectProductionScenes } from './productionSuite';
import type { SceneIntent, ScriptDocument, ScriptElement, StoryCheckResult } from './types';

const LATE_ENTRY_PATTERN = /\b(enters?|walks in|comes in|sits down|wakes up|stands there|looks around)\b/i;
const CONFLICT_PATTERN = /\b(argues?|refuses?|blocks?|threatens?|demands?|lies?|hides?|chases?|attacks?|escapes?|betrays?|but|however|except|instead|can't|won't|must|need)\b/i;
const STAKES_PATTERN = /\b(or else|before|deadline|risk|lose|death|die|kill|save|cost|danger|if|unless|tonight|today|now)\b/i;
const VISUAL_VERBS = /\b(grabs?|throws?|runs?|crosses?|opens?|slams?|breaks?|pulls?|pushes?|drives?|fires?|cuts?|bleeds?|falls?|jumps?|turns?|reveals?)\b/i;
const SUBTEXT_TELLS = /\b(angry|sad|happy|nervous|worried|afraid|scared|excited|confused|feels|realizes|understands)\b/i;

export function buildSceneIntents(document: ScriptDocument): SceneIntent[] {
  return collectProductionScenes(document).map((scene) => ({
    id: `intent:${scene.id}`,
    sceneElementId: scene.id,
    sceneNumber: scene.sceneNumber,
    want: '',
    obstacle: '',
    stakes: '',
    turn: '',
    emotionalAnchor: '',
    setupPayoff: ''
  }));
}

export function analyzeScript(document: ScriptDocument): StoryCheckResult[] {
  const scenes = collectProductionScenes(document);
  const results: StoryCheckResult[] = [];

  if (!scenes.length) {
    results.push({
      id: 'story:no-scenes',
      category: 'structure',
      severity: 'strong',
      title: 'No scene headings yet',
      message: 'A screenplay becomes navigable once scenes have clear INT./EXT. headings.',
      suggestion: 'Start the first scene with a specific place and time, then let the assistant carry the next element into action.'
    });
    return results;
  }

  for (const scene of scenes) {
    const bodyElements = scene.elements.filter((element) => element.type !== 'scene-heading' && element.type !== 'page-break');
    const bodyText = bodyElements.map((element) => element.text).join(' ');
    const actionText = scene.elements.filter((element) => element.type === 'action' || element.type === 'general').map((element) => element.text).join(' ');
    const dialogueText = scene.elements.filter((element) => element.type === 'dialogue').map((element) => element.text).join(' ');
    const firstAction = scene.elements.find((element) => element.type === 'action' && element.text.trim());

    if (firstAction && LATE_ENTRY_PATTERN.test(firstAction.text)) {
      results.push(check(scene.id, scene.sceneNumber, firstAction.id, 'scene', 'warning', 'Consider entering later', 'The first action reads like setup before the interesting moment.', 'Try beginning at the pressure point: conflict already in motion, decision already hard.'));
    }

    if (!scene.characters.length && !dialogueText.trim()) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'scene', 'note', 'No speaking characters detected', 'This can work, but make sure the scene still turns through visible behavior.', 'Give the scene a clear visual action, discovery, reversal, or image that changes the story state.'));
    }

    if (!CONFLICT_PATTERN.test(bodyText)) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'scene', 'warning', 'Conflict may be soft', 'The scene does not show obvious resistance, refusal, pressure, or reversal language.', 'Clarify who wants what, what blocks them, and what changes by the end of the scene.'));
    }

    if (!STAKES_PATTERN.test(bodyText)) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'structure', 'note', 'Stakes are not explicit', 'The scene may benefit from clearer consequence or urgency.', 'Name the cost of failure, even if it is emotional, social, or hidden from the other character.'));
    }

    if (actionText.length > 0 && !VISUAL_VERBS.test(actionText)) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'visual', 'note', 'Action could be more filmable', 'The action reads quiet or internal.', 'Swap abstract description for behavior the camera can catch: a choice, object, movement, image, or interruption.'));
    }

    if (SUBTEXT_TELLS.test(actionText)) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'subtext', 'note', 'Emotion is being named', 'Named emotions can flatten performance moments.', 'Try making the feeling visible through what the character does, avoids, notices, or cannot say.'));
    }

    if (wordCount(dialogueText) > Math.max(45, wordCount(actionText) * 3)) {
      results.push(check(scene.id, scene.sceneNumber, scene.id, 'dialogue', 'warning', 'Dialogue-heavy scene', 'Dialogue is carrying most of the scene weight.', 'Look for one line that could become a gesture, silence, interrupted action, or object choice.'));
    }

    for (const element of bodyElements) {
      if ((element.type === 'action' || element.type === 'general') && wordCount(element.text) > 80) {
        results.push(check(scene.id, scene.sceneNumber, element.id, 'visual', 'warning', 'Dense action block', 'Long action blocks slow down the read, especially in specs.', 'Break this into smaller beats and put the strongest visual turn at the end of the paragraph.'));
      }
    }
  }

  const dialogue = analyzeDialogue(document);
  for (const analysis of dialogue.filter((item) => item.monologueCount > 0)) {
    results.push({
      id: `dialogue:monologue:${analysis.characterName}`,
      category: 'dialogue',
      severity: 'note',
      title: `${analysis.characterName} has long speeches`,
      message: `${analysis.monologueCount} dialogue block${analysis.monologueCount === 1 ? '' : 's'} run 45+ words.`,
      suggestion: 'Cut to the line they are afraid to say, or add interruption and behavior to shape the rhythm.'
    });
  }

  return results;
}

function check(
  sceneId: string,
  sceneNumber: number,
  elementId: string,
  category: StoryCheckResult['category'],
  severity: StoryCheckResult['severity'],
  title: string,
  message: string,
  suggestion: string
): StoryCheckResult {
  return {
    id: `${category}:${sceneId}:${elementId}:${slugify(title)}`,
    category,
    severity,
    title,
    message,
    suggestion,
    elementId,
    sceneNumber
  };
}

function wordCount(text: string): number {
  return text.match(/[A-Za-z']+/g)?.length ?? 0;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
