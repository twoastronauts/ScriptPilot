import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Plugin, type Transaction } from 'prosemirror-state';
import { inferElementType } from '@/shared/screenplay';
import type { ScriptElementType } from '@/shared/types';

export const screenplayAutoformat = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    if (!transactions.some((transaction) => transaction.docChanged)) return null;

    let tr = newState.tr;
    let changed = false;
    const changedRanges = collectChangedRanges(transactions);

    newState.doc.descendants((node, position) => {
      if (node.type.name !== 'screenplayElement') return false;
      if (changedRanges.length && !changedRanges.some((range) => rangesTouch(range.from, range.to, position, position + node.nodeSize))) return false;

      const currentType = (node.attrs.scriptType ?? 'action') as ScriptElementType;
      const previous = elementTypeBefore(newState.doc, position);
      const inferredType = inferElementType(node.textContent, previous);
      const nextType = shouldRetype(currentType, inferredType, node.textContent) ? inferredType : currentType;

      if (nextType !== currentType) {
        tr = tr.setNodeMarkup(position, undefined, { ...node.attrs, scriptType: nextType });
        changed = true;
      }

      return false;
    });

    return changed ? tr : null;
  }
});

function collectChangedRanges(transactions: readonly Transaction[]) {
  const ranges: Array<{ from: number; to: number }> = [];
  transactions.forEach((transaction) => {
    transaction.mapping.maps.forEach((map) => {
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        ranges.push({ from: newStart, to: Math.max(newStart, newEnd) });
      });
    });
  });
  return ranges;
}

function rangesTouch(from: number, to: number, nodeFrom: number, nodeTo: number): boolean {
  return from <= nodeTo && to >= nodeFrom;
}

function elementTypeBefore(doc: ProseMirrorNode, position: number): ScriptElementType | undefined {
  let previous: ScriptElementType | undefined;
  doc.descendants((node, nodePosition) => {
    if (nodePosition >= position) return false;
    if (node.type.name === 'screenplayElement') {
      previous = (node.attrs.scriptType ?? 'action') as ScriptElementType;
      return false;
    }
    return true;
  });
  return previous;
}

function shouldRetype(currentType: ScriptElementType, inferredType: ScriptElementType, text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (currentType === inferredType) return false;
  if (currentType === 'page-break') return false;

  if (inferredType === 'scene-heading' || inferredType === 'transition' || inferredType === 'parenthetical') return true;
  if (inferredType === 'character') return false;
  if (currentType === 'character') return inferredType === 'action' || inferredType === 'dialogue';
  if (currentType === 'parenthetical') return inferredType === 'dialogue';
  return false;
}
