import { keymap } from 'prosemirror-keymap';
import { Fragment, type Node as ProseMirrorNode, type ResolvedPos } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { v4 as uuid } from 'uuid';
import { nextElementType, tabElementType } from '@/shared/screenplay';
import type { ScriptElementType } from '@/shared/types';

export const splitScreenplayElement: Command = (state, dispatch, view) => {
  const { $from } = state.selection;
  const context = screenplayElementAtSelection(state);
  if (!context) return false;

  const { node, position, depth } = context;
  const currentType = (node.attrs.scriptType ?? 'action') as ScriptElementType;
  if (currentType === 'page-break') return false;

  if (currentType === 'transition' && node.textContent.trim().length > 0) {
    if (dispatch) {
      const nextNode = node.type.create({
        id: uuid(),
        scriptType: 'scene-heading',
        revisionColor: null,
        revisionSetId: null,
        revisionMark: null,
        formatStyle: null,
        generatedPageBreak: false,
        omitted: false
      });
      const insertAt = position + node.nodeSize;
      const tr = state.tr.insert(insertAt, nextNode);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, insertAt + 1)).scrollIntoView());
      refocusEditor(view);
    }
    return true;
  }

  const sameElementSelection = selectionEndsInSameElement(state, depth);
  const fromOffset = offsetInsideElement($from, depth);
  const toOffset = sameElementSelection ? offsetInsideElement(state.selection.$to, depth) : fromOffset;
  const beforeText = node.textContent.slice(0, fromOffset);
  const afterText = node.textContent.slice(toOffset);
  const nextType = nextElementType(currentType, beforeText);

  if (dispatch) {
    const currentNode = createScreenplayElementNode(node, node.attrs, beforeText);
    const nextNode = createScreenplayElementNode(
      node,
      {
        id: uuid(),
        scriptType: nextType,
        revisionColor: null,
        revisionSetId: null,
        revisionMark: null,
        formatStyle: null,
        generatedPageBreak: false,
        omitted: false
      },
      afterText
    );
    const fragment = Fragment.fromArray([currentNode, nextNode]);
    const tr = state.tr.replaceWith(position, position + node.nodeSize, fragment);
    const nextPosition = position + currentNode.nodeSize + 1;
    dispatch(tr.setSelection(TextSelection.create(tr.doc, nextPosition)).scrollIntoView());
    refocusEditor(view);
  }
  return true;
};

function refocusEditor(view?: EditorView): void {
  if (!view) return;
  if (typeof window === 'undefined') {
    view.focus();
    return;
  }
  window.requestAnimationFrame(() => view.focus());
}

function screenplayElementAtSelection(state: EditorState):
  | { node: ProseMirrorNode; position: number; depth: number }
  | undefined {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'screenplayElement') continue;
    return { node, position: $from.before(depth), depth };
  }
  return undefined;
}

function selectionEndsInSameElement(state: EditorState, fromDepth: number): boolean {
  const { $from, $to } = state.selection;
  for (let depth = $to.depth; depth > 0; depth -= 1) {
    if ($to.node(depth).type.name !== 'screenplayElement') continue;
    return $from.before(fromDepth) === $to.before(depth);
  }
  return false;
}

function offsetInsideElement(resolved: ResolvedPos, depth: number): number {
  return Math.max(0, resolved.pos - resolved.start(depth));
}

function createScreenplayElementNode(baseNode: ProseMirrorNode, attrs: Record<string, unknown>, text: string): ProseMirrorNode {
  return baseNode.type.create(
    {
      ...baseNode.attrs,
      ...attrs
    },
    text ? baseNode.type.schema.text(text) : undefined
  );
}

function setCurrentElementType(direction: 1 | -1): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const position = $from.before($from.depth);
    const node = $from.node($from.depth);
    const currentType = (node.attrs.scriptType ?? 'action') as ScriptElementType;
    const nextType = tabElementType(currentType, direction);

    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(position, undefined, { ...node.attrs, scriptType: nextType }).scrollIntoView());
    }
    return true;
  };
}

const insertParentheticalCommand: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const insertAt = $from.after($from.depth);

  if (dispatch) {
    const node = state.schema.nodes.screenplayElement.create({
      id: uuid(),
      scriptType: 'parenthetical',
      revisionColor: null,
      omitted: false
    });
    const tr = state.tr.insert(insertAt, node);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, insertAt + 1)).scrollIntoView());
  }
  return true;
};

export const screenplayKeymap = keymap({
  Enter: splitScreenplayElement,
  Tab: setCurrentElementType(1),
  'Shift-Tab': setCurrentElementType(-1),
  'Mod-9': insertParentheticalCommand
});
