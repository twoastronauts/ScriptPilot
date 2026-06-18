import { splitBlockAs } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { TextSelection, type Command } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { v4 as uuid } from 'uuid';
import { nextElementType, tabElementType } from '@/shared/screenplay';
import type { ScriptElementType } from '@/shared/types';

const enterCommand: Command = (state, dispatch, view) => {
  const { $from } = state.selection;
  const parent = $from.parent;
  const currentType = (parent.attrs.scriptType ?? 'action') as ScriptElementType;
  const nextType = nextElementType(currentType, parent.textContent);

  if (currentType === 'transition') {
    if (dispatch) {
      const insertAt = $from.after($from.depth);
      const node = state.schema.nodes.screenplayElement.create({
        id: uuid(),
        scriptType: 'scene-heading',
        revisionColor: null,
        omitted: false
      });
      const tr = state.tr.insert(insertAt, node);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, insertAt + 1)).scrollIntoView());
      refocusEditor(view);
    }
    return true;
  }

  const handled = splitBlockAs(() => ({
    type: state.schema.nodes.screenplayElement,
    attrs: {
      id: uuid(),
      scriptType: nextType,
      revisionColor: null,
      omitted: false
    }
  }))(state, dispatch);
  if (handled && dispatch) refocusEditor(view);
  return handled;
};

function refocusEditor(view?: EditorView): void {
  if (!view) return;
  if (typeof window === 'undefined') {
    view.focus();
    return;
  }
  window.requestAnimationFrame(() => view.focus());
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
  Enter: enterCommand,
  Tab: setCurrentElementType(1),
  'Shift-Tab': setCurrentElementType(-1),
  'Mod-9': insertParentheticalCommand
});
