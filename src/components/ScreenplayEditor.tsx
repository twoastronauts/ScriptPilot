import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, redo, undo } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { clsx } from 'clsx';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { elementsToProseMirrorDoc, prosemirrorDocToElements, screenplaySchema, type PageChromeOptions } from '@/prosemirror/schema';
import { screenplayKeymap } from '@/prosemirror/keymap';
import { screenplayAutoformat } from '@/prosemirror/autoformat';
import { useWorkspace } from '@/store/workspace';
import { ELEMENT_LABELS, estimatePageCount } from '@/shared/screenplay';
import { collectSmartTypeOptions, type SmartTypeOption } from '@/shared/smartType';
import { suggestSynonyms } from '@/shared/synonyms';
import { correctionSpan, suggestCorrections } from '@/shared/proofing';
import type { ScriptElement, ScriptElementType } from '@/shared/types';

interface SmartTypeMenu {
  options: SmartTypeOption[];
  selectedIndex: number;
  left: number;
  top: number;
  blockPosition: number;
  blockSize: number;
}

interface SynonymMenu {
  word: string;
  options: string[];
  selectedIndex: number;
  from: number;
  to: number;
  left: number;
  top: number;
}

interface SpellingMenu {
  word: string;
  options: string[];
  selectedIndex: number;
  from: number;
  to: number;
  left: number;
  top: number;
}

export function ScreenplayEditor() {
  const shellRef = useRef<HTMLElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRemoteRef = useRef(false);
  const menuRef = useRef<SmartTypeMenu | null>(null);
  const synonymMenuRef = useRef<SynonymMenu | null>(null);
  const spellingMenuRef = useRef<SpellingMenu | null>(null);
  const [smartTypeMenu, setSmartTypeMenu] = useState<SmartTypeMenu | null>(null);
  const [synonymMenu, setSynonymMenu] = useState<SynonymMenu | null>(null);
  const [spellingMenu, setSpellingMenu] = useState<SpellingMenu | null>(null);
  const { document, selectedElementId, setElements, setSelectedElement, sprintStartedAt } = useWorkspace();
  const elements = document.elements;
  const pageCount = useMemo(() => Math.max(1, estimatePageCount(elements)), [elements]);
  const selectedPage = useMemo(() => estimatePageForElement(elements, selectedElementId), [elements, selectedElementId]);
  const pageChromeOptions = useMemo<PageChromeOptions>(
    () => ({
      documentTitle: document.title,
      headerText: document.settings.headerText,
      footerText: document.settings.footerText,
      showHeaderFooter: document.settings.showHeaderFooter,
      showPageNumbers: document.settings.showPageNumbers,
      pageNumberStart: document.settings.pageNumberStart,
      pageMode: document.settings.pageMode
    }),
    [
      document.title,
      document.settings.footerText,
      document.settings.headerText,
      document.settings.pageMode,
      document.settings.pageNumberStart,
      document.settings.showHeaderFooter,
      document.settings.showPageNumbers
    ]
  );
  const documentRef = useRef(document);
  const elementsRef = useRef(elements);

  const editorPlugins = useMemo(
    () => [
      history(),
      keymap({
        'Mod-z': undo,
        'Shift-Mod-z': redo,
        'Mod-y': redo
      }),
      screenplayAutoformat,
      screenplayKeymap,
      keymap(baseKeymap)
    ],
    []
  );

  const status = useMemo(() => {
    const selected = elements.find((element) => element.id === selectedElementId) ?? elements[0];
    return selected ? ELEMENT_LABELS[selected.type] : 'Action';
  }, [elements, selectedElementId]);

  useEffect(() => {
    documentRef.current = document;
    elementsRef.current = elements;
  }, [document, elements]);

  useEffect(() => {
    synonymMenuRef.current = synonymMenu;
  }, [synonymMenu]);

  useEffect(() => {
    spellingMenuRef.current = spellingMenu;
  }, [spellingMenu]);

  useEffect(() => {
    if (!selectedElementId && elements[0]?.id) {
      setSelectedElement(elements[0].id);
    }
  }, [elements, selectedElementId, setSelectedElement]);

  const closeSynonymMenu = useCallback(() => {
    synonymMenuRef.current = null;
    setSynonymMenu(null);
  }, []);

  const closeSpellingMenu = useCallback(() => {
    spellingMenuRef.current = null;
    setSpellingMenu(null);
  }, []);

  const closeWritingMenus = useCallback(() => {
    closeSynonymMenu();
    closeSpellingMenu();
  }, [closeSpellingMenu, closeSynonymMenu]);

  const updateSmartTypeMenu = useCallback(
    (view: EditorView) => {
      const latestDocument = documentRef.current;
      if (!view.hasFocus()) {
        menuRef.current = null;
        setSmartTypeMenu(null);
        return;
      }

      const { state } = view;
      const { $from } = state.selection;
      const block = $from.parent;
      if (block.type.name !== 'screenplayElement') {
        menuRef.current = null;
        setSmartTypeMenu(null);
        return;
      }

      const currentType = (block.attrs.scriptType ?? 'action') as ScriptElementType;
      const query = block.textContent;
      const options = collectSmartTypeOptions(latestDocument, currentType, query);
      if (!options.length || !latestDocument.settings.smartType) {
        menuRef.current = null;
        setSmartTypeMenu(null);
        return;
      }

      const shellRect = shellRef.current?.getBoundingClientRect();
      const coords = view.coordsAtPos(state.selection.from);
      const menuLeft = currentType === 'transition' ? 16 : Math.max(16, coords.left - (shellRect?.left ?? 0));
      const menu = {
        options,
        selectedIndex: Math.min(menuRef.current?.selectedIndex ?? 0, options.length - 1),
        left: menuLeft,
        top: Math.max(44, coords.bottom - (shellRect?.top ?? 0) + 8),
        blockPosition: $from.before($from.depth),
        blockSize: block.nodeSize
      };

      menuRef.current = menu;
      setSmartTypeMenu(menu);
    },
    []
  );

  const applySmartTypeOption = useCallback((option?: SmartTypeOption) => {
    const view = viewRef.current;
    const menu = menuRef.current;
    const selected = option ?? menu?.options[menu.selectedIndex ?? 0];
    if (!view || !menu || !selected) return false;

    const node = view.state.doc.nodeAt(menu.blockPosition) as ProseMirrorNode | null;
    if (!node) return false;

    const start = menu.blockPosition + 1;
    const end = menu.blockPosition + node.nodeSize - 1;
    let tr = view.state.tr.delete(start, end);
    if (selected.replacement) tr = tr.insertText(selected.replacement, start);
    tr = tr.setNodeMarkup(menu.blockPosition, undefined, {
      ...node.attrs,
      scriptType: selected.targetType
    });
    view.dispatch(tr.scrollIntoView());
    view.focus();
    menuRef.current = null;
    setSmartTypeMenu(null);
    return true;
  }, []);

  const applySynonym = useCallback((replacement: string) => {
    const view = viewRef.current;
    const menu = synonymMenuRef.current;
    if (!view || !menu) return;
    view.dispatch(view.state.tr.insertText(replacement, menu.from, menu.to).scrollIntoView());
    view.focus();
    closeSynonymMenu();
  }, [closeSynonymMenu]);

  const applySpelling = useCallback((replacement: string) => {
    const view = viewRef.current;
    const menu = spellingMenuRef.current;
    if (!view || !menu) return;
    view.dispatch(view.state.tr.insertText(replacement, menu.from, menu.to).scrollIntoView());
    view.focus();
    closeSpellingMenu();
  }, [closeSpellingMenu]);

  const moveSmartTypeSelection = useCallback((direction: 1 | -1) => {
    const menu = menuRef.current;
    if (!menu) return false;

    const selectedIndex = (menu.selectedIndex + direction + menu.options.length) % menu.options.length;
    const next = { ...menu, selectedIndex };
    menuRef.current = next;
    setSmartTypeMenu(next);
    return true;
  }, []);

  const moveSynonymSelection = useCallback((direction: 1 | -1) => {
    const menu = synonymMenuRef.current;
    if (!menu?.options.length) return false;
    const selectedIndex = (menu.selectedIndex + direction + menu.options.length) % menu.options.length;
    const next = { ...menu, selectedIndex };
    synonymMenuRef.current = next;
    setSynonymMenu(next);
    return true;
  }, []);

  const jumpSynonymSelection = useCallback((selectedIndex: number) => {
    const menu = synonymMenuRef.current;
    if (!menu?.options.length) return false;
    const next = { ...menu, selectedIndex: Math.max(0, Math.min(menu.options.length - 1, selectedIndex)) };
    synonymMenuRef.current = next;
    setSynonymMenu(next);
    return true;
  }, []);

  const moveSpellingSelection = useCallback((direction: 1 | -1) => {
    const menu = spellingMenuRef.current;
    if (!menu?.options.length) return false;
    const selectedIndex = (menu.selectedIndex + direction + menu.options.length) % menu.options.length;
    const next = { ...menu, selectedIndex };
    spellingMenuRef.current = next;
    setSpellingMenu(next);
    return true;
  }, []);

  const jumpSpellingSelection = useCallback((selectedIndex: number) => {
    const menu = spellingMenuRef.current;
    if (!menu?.options.length) return false;
    const next = { ...menu, selectedIndex: Math.max(0, Math.min(menu.options.length - 1, selectedIndex)) };
    spellingMenuRef.current = next;
    setSpellingMenu(next);
    return true;
  }, []);

  useEffect(() => {
    function requestSynonyms() {
      const view = viewRef.current;
      if (!view) return;
      const range = synonymRangeFromDomSelection(view) ?? synonymRangeFromSelection(view.state);
      if (!range.word) {
        closeSynonymMenu();
        return;
      }
      const options = suggestSynonyms(range.word);
      if (!options.length) {
        closeSynonymMenu();
        return;
      }
      const shellRect = shellRef.current?.getBoundingClientRect();
      const coords = view.coordsAtPos(range.to);
      setSynonymMenu({
        ...range,
        options,
        selectedIndex: 0,
        left: Math.max(16, coords.left - (shellRect?.left ?? 0)),
        top: Math.max(44, coords.bottom - (shellRect?.top ?? 0) + 8)
      });
    }

    window.addEventListener('scriptpilot:request-synonyms', requestSynonyms);
    return () => window.removeEventListener('scriptpilot:request-synonyms', requestSynonyms);
  }, [closeSynonymMenu]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.synonym-menu, .spelling-menu')) return;
      closeWritingMenus();
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [closeWritingMenus]);

  const showSpellingMenu = useCallback((range: Pick<SpellingMenu, 'word' | 'from' | 'to'>, coords: { left: number; top: number }) => {
    const span = correctionSpan(range.word);
    const targetWord = range.word.slice(span.start, span.end) || range.word;
    const targetRange = { word: targetWord, from: range.from + span.start, to: range.from + span.end };
    const options = suggestCorrections(targetWord);
    if (!targetRange.word || !options.length) {
      closeSpellingMenu();
      return false;
    }
    const shellRect = shellRef.current?.getBoundingClientRect();
    const menu = {
      ...targetRange,
      options,
      selectedIndex: 0,
      left: Math.max(16, coords.left - (shellRect?.left ?? 0)),
      top: Math.max(44, coords.top - (shellRect?.top ?? 0) + 18)
    };
    spellingMenuRef.current = menu;
    setSpellingMenu(menu);
    return true;
  }, [closeSpellingMenu]);

  const requestSpellingMenu = useCallback(() => {
    const view = viewRef.current;
    if (!view) return false;
    const range = synonymRangeFromSelection(view.state);
    if (!range.word) {
      closeSpellingMenu();
      return false;
    }
    return showSpellingMenu(range, view.coordsAtPos(range.to));
  }, [closeSpellingMenu, showSpellingMenu]);

  useEffect(() => {
    function requestSpelling() {
      requestSpellingMenu();
    }

    window.addEventListener('scriptpilot:request-spelling', requestSpelling);
    return () => window.removeEventListener('scriptpilot:request-spelling', requestSpelling);
  }, [requestSpellingMenu]);

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      schema: screenplaySchema,
      doc: elementsToProseMirrorDoc(elements, pageChromeOptions),
      plugins: editorPlugins
    });

    const view = new EditorView(hostRef.current, {
      state,
      dispatchTransaction(transaction) {
        if (transaction.docChanged || transaction.selectionSet) closeWritingMenus();
        const nextState = view.state.apply(transaction);
        view.updateState(nextState);

        const selectionNode = nextState.selection.$from.parent;
        const id = selectionNode.attrs.id as string | undefined;
        if (id) setSelectedElement(id);

        if (transaction.docChanged && !applyingRemoteRef.current) {
          const nextElements = prosemirrorDocToElements(nextState.doc, elementsRef.current);
          setElements(nextElements);
          elementsRef.current = nextElements;
        }

        window.requestAnimationFrame(() => updateSmartTypeMenu(view));
      },
      attributes: {
        'aria-label': 'Screenplay editor',
        spellcheck: String(documentRef.current.settings.spellcheck)
      },
      handleClickOn(_view, _pos, node) {
        if (node.type.name === 'screenplayElement' && node.attrs.id) {
          setSelectedElement(node.attrs.id as string);
        }
        return false;
      },
      handleDOMEvents: {
        focus(view) {
          const id = view.state.selection.$from.parent.attrs.id as string | undefined;
          if (id) setSelectedElement(id);
          return false;
        },
        blur() {
          closeWritingMenus();
          return false;
        },
        contextmenu(view, event) {
          const mouseEvent = event as MouseEvent;
          const position = view.posAtCoords({ left: mouseEvent.clientX, top: mouseEvent.clientY });
          if (!position) return false;
          const range = wordRangeAtPosition(view.state, position.pos);
          if (!range.word) return false;
          if (!showSpellingMenu(range, { left: mouseEvent.clientX, top: mouseEvent.clientY })) return false;
          mouseEvent.preventDefault();
          return true;
        }
      },
      handleKeyDown(view, event) {
        if ((event.ctrlKey || event.metaKey) && event.key === '.') {
          event.preventDefault();
          return requestSpellingMenu();
        }
        if (spellingMenuRef.current) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            return moveSpellingSelection(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            return moveSpellingSelection(-1);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            return jumpSpellingSelection(0);
          }
          if (event.key === 'End') {
            event.preventDefault();
            return jumpSpellingSelection((spellingMenuRef.current.options.length || 1) - 1);
          }
          if (event.key === 'Enter') {
            const selected = spellingMenuRef.current.options[spellingMenuRef.current.selectedIndex];
            if (selected) {
              event.preventDefault();
              applySpelling(selected);
              return true;
            }
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSpellingMenu();
            return true;
          }
        }
        if (synonymMenuRef.current) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            return moveSynonymSelection(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            return moveSynonymSelection(-1);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            return jumpSynonymSelection(0);
          }
          if (event.key === 'End') {
            event.preventDefault();
            return jumpSynonymSelection((synonymMenuRef.current.options.length || 1) - 1);
          }
          if (event.key === 'Enter') {
            const selected = synonymMenuRef.current.options[synonymMenuRef.current.selectedIndex];
            if (selected) {
              event.preventDefault();
              applySynonym(selected);
              return true;
            }
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSynonymMenu();
            return true;
          }
        }
        if (!menuRef.current) return false;
        if (event.key === 'Enter' && view.state.selection.$from.parent.attrs.scriptType === 'transition') {
          menuRef.current = null;
          setSmartTypeMenu(null);
          return false;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          return moveSmartTypeSelection(1);
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          return moveSmartTypeSelection(-1);
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          return applySmartTypeOption();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          menuRef.current = null;
          setSmartTypeMenu(null);
          return true;
        }
        return false;
      }
    });

    viewRef.current = view;
    updateSmartTypeMenu(view);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    applySmartTypeOption,
    applySpelling,
    applySynonym,
    closeSpellingMenu,
    closeSynonymMenu,
    closeWritingMenus,
    editorPlugins,
    jumpSpellingSelection,
    jumpSynonymSelection,
    moveSmartTypeSelection,
    moveSpellingSelection,
    moveSynonymSelection,
    requestSpellingMenu,
    setElements,
    setSelectedElement,
    showSpellingMenu,
    pageChromeOptions,
    updateSmartTypeMenu
  ]);

  useEffect(() => {
    function runHistory(command: typeof undo) {
      const view = viewRef.current;
      if (!view) return;
      command(view.state, view.dispatch, view);
      view.focus();
    }

    function handleUndo() {
      runHistory(undo);
    }

    function handleRedo() {
      runHistory(redo);
    }

    window.addEventListener('scriptpilot:undo', handleUndo);
    window.addEventListener('scriptpilot:redo', handleRedo);
    return () => {
      window.removeEventListener('scriptpilot:undo', handleUndo);
      window.removeEventListener('scriptpilot:redo', handleRedo);
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (!docMatchesElements(view.state.doc, elements, pageChromeOptions)) {
      const currentId = (view.state.selection.$from.parent.attrs.id as string | undefined) ?? selectedElementId;
      const parentOffset = view.state.selection.$from.parentOffset;
      const nextDoc = elementsToProseMirrorDoc(elements, pageChromeOptions);
      const selection = createSelectionNearElement(nextDoc, currentId, parentOffset);
      applyingRemoteRef.current = true;
      const nextState = EditorState.create({
        schema: screenplaySchema,
        doc: nextDoc,
        plugins: editorPlugins,
        selection
      });
      view.updateState(nextState);
      window.requestAnimationFrame(() => updateSmartTypeMenu(view));
      applyingRemoteRef.current = false;
    }
  }, [editorPlugins, elements, pageChromeOptions, selectedElementId, updateSmartTypeMenu]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedElementId) return;
    const currentId = view.state.selection.$from.parent.attrs.id as string | undefined;
    if (currentId === selectedElementId) return;
    const selection = createSelectionNearElement(view.state.doc, selectedElementId, 0);
    if (!selection) return;
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    const line = view.dom.querySelector<HTMLElement>(`.script-line[data-id="${CSS.escape(selectedElementId)}"]`);
    line?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [selectedElementId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dom.setAttribute('spellcheck', String(document.settings.spellcheck));
  }, [document.settings.spellcheck]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lines = Array.from(host.querySelectorAll<HTMLElement>('.script-line'));
    lines.forEach((line) =>
      line.classList.remove('is-current-line', 'is-before-current-1', 'is-before-current-2', 'is-before-current-3', 'is-before-current-4', 'is-far-before-current', 'is-after-current')
    );
    const currentIndex = lines.findIndex((line) => line.dataset.id === selectedElementId);
    if (currentIndex < 0) return;
    lines.forEach((line, index) => {
      if (index === currentIndex) line.classList.add('is-current-line');
      else if (index === currentIndex - 1) line.classList.add('is-before-current-1');
      else if (index === currentIndex - 2) line.classList.add('is-before-current-2');
      else if (index === currentIndex - 3) line.classList.add('is-before-current-3');
      else if (index === currentIndex - 4) line.classList.add('is-before-current-4');
      else if (index < currentIndex - 4) line.classList.add('is-far-before-current');
      else if (index > currentIndex) line.classList.add('is-after-current');
    });
  }, [elements, selectedElementId, sprintStartedAt]);

  return (
    <section
      ref={shellRef}
      className={clsx('editor-shell', `mode-${document.settings.viewMode}`, {
        'is-focus': document.settings.focusMode,
        'is-typewriter': document.settings.typewriterMode,
        'is-revision-mode': document.settings.revisionMode,
        'is-sprint-active': Boolean(sprintStartedAt)
      })}
    >
      <div className="editor-shell__meta">
        <span>{document.title}</span>
        <span>{status} - pg. {document.settings.pageNumberStart + selectedPage - 1} / {pageCount}</span>
      </div>
      <div className="page-stage">
        <div
          className={clsx('page', document.settings.pageMode === 'pages' ? 'page--paged' : 'page--continuous')}
        >
          <div className="page-editor-host" ref={hostRef} />
        </div>
      </div>
      {smartTypeMenu && (
        <div className="smarttype-menu" style={{ left: smartTypeMenu.left, top: smartTypeMenu.top }} role="listbox" aria-label="SmartType suggestions">
          {smartTypeMenu.options.map((option, index) => (
            <button
              key={option.id}
              className={index === smartTypeMenu.selectedIndex ? 'smarttype-item is-active' : 'smarttype-item'}
              onMouseDown={(event) => {
                event.preventDefault();
                applySmartTypeOption(option);
              }}
              role="option"
              aria-selected={index === smartTypeMenu.selectedIndex}
            >
              <span>{option.label}</span>
              <small>{option.detail}</small>
            </button>
          ))}
        </div>
      )}
      {synonymMenu && (
        <div className="synonym-menu" style={{ left: synonymMenu.left, top: synonymMenu.top }} role="listbox" aria-label="Alt Word synonyms">
          <strong>Alt Word: {synonymMenu.word}</strong>
          {synonymMenu.options.length ? (
            synonymMenu.options.map((option, index) => (
              <button
                key={option}
                className={index === synonymMenu.selectedIndex ? 'synonym-item is-active' : 'synonym-item'}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySynonym(option);
                }}
                role="option"
                aria-selected={index === synonymMenu.selectedIndex}
              >
                {option}
              </button>
            ))
          ) : (
            <span>No local alternatives yet.</span>
          )}
        </div>
      )}
      {spellingMenu && (
        <div className="spelling-menu" style={{ left: spellingMenu.left, top: spellingMenu.top }} role="listbox" aria-label="Spelling suggestions">
          <strong>Did you mean: {spellingMenu.word}</strong>
          {spellingMenu.options.map((option, index) => (
            <button
              key={option}
              className={index === spellingMenu.selectedIndex ? 'spelling-item is-active' : 'spelling-item'}
              onMouseDown={(event) => {
                event.preventDefault();
                applySpelling(option);
              }}
              role="option"
              aria-selected={index === spellingMenu.selectedIndex}
            >
              {option}
            </button>
          ))}
          <button className="spelling-item spelling-item--muted" onMouseDown={(event) => {
            event.preventDefault();
            closeSpellingMenu();
          }}>
            Ignore
          </button>
        </div>
      )}
    </section>
  );
}

function estimatePageForElement(elements: ScriptElement[], selectedElementId?: string): number {
  let weightedLines = 0;
  for (const element of elements) {
    if (element.id === selectedElementId) return Math.max(1, Math.ceil(weightedLines / 55));
    if (element.type === 'page-break') {
      weightedLines += 55;
      continue;
    }
    const hardLines = Math.max(1, element.text.split(/\r?\n/).length);
    const softLines = Math.max(1, Math.ceil(element.text.length / lineWidthForElement(element.type)));
    const typeWeight = element.type === 'dialogue' ? 1.2 : element.type === 'scene-heading' ? 1.4 : 1;
    weightedLines += Math.max(hardLines, softLines) * typeWeight;
  }
  return Math.max(1, Math.ceil(weightedLines / 55));
}

function lineWidthForElement(type: ScriptElementType): number {
  if (type === 'dialogue') return 36;
  if (type === 'parenthetical') return 28;
  if (type === 'character') return 24;
  return 58;
}

function createSelectionNearElement(doc: ProseMirrorNode, elementId?: string, parentOffset = 0): TextSelection | undefined {
  if (!elementId) return undefined;
  let selection: TextSelection | undefined;
  doc.descendants((node, position) => {
    if (selection) return false;
    if (node.type.name !== 'screenplayElement') return true;
    if (node.attrs.id !== elementId) return false;
    const maxOffset = Math.max(0, node.nodeSize - 2);
    selection = TextSelection.create(doc, position + 1 + Math.min(parentOffset, maxOffset));
    return false;
  });
  return selection;
}

function synonymRangeFromSelection(state: EditorState): Pick<SynonymMenu, 'word' | 'from' | 'to'> {
  const { from, to, empty, $from } = state.selection;
  if (!empty) {
    return wordRangeFromTextRange(state, from, to);
  }

  const text = $from.parent.textContent;
  const offset = $from.parentOffset;
  const prefix = text.slice(0, offset).match(/[A-Za-z'-]+$/)?.[0] ?? '';
  const suffix = text.slice(offset).match(/^[A-Za-z'-]+/)?.[0] ?? '';
  return {
    word: `${prefix}${suffix}`,
    from: from - prefix.length,
    to: from + suffix.length
  };
}

function synonymRangeFromDomSelection(view: EditorView): Pick<SynonymMenu, 'word' | 'from' | 'to'> | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return undefined;
  if (!view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return undefined;

  const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
  const focus = view.posAtDOM(selection.focusNode, selection.focusOffset);
  const from = Math.min(anchor, focus);
  const to = Math.max(anchor, focus);
  return wordRangeFromTextRange(view.state, from, to, selection.toString());
}

function wordRangeAtPosition(state: EditorState, position: number): Pick<SynonymMenu, 'word' | 'from' | 'to'> {
  const resolved = state.doc.resolve(Math.max(1, Math.min(position, state.doc.content.size)));
  const parentStart = resolved.start(resolved.depth);
  const text = resolved.parent.textContent;
  const offset = Math.max(0, Math.min(resolved.parentOffset, text.length));
  const prefix = text.slice(0, offset).match(/[A-Za-z'.-]+$/)?.[0] ?? '';
  const suffix = text.slice(offset).match(/^[A-Za-z'.-]+/)?.[0] ?? '';
  return {
    word: `${prefix}${suffix}`,
    from: parentStart + offset - prefix.length,
    to: parentStart + offset + suffix.length
  };
}

function wordRangeFromTextRange(state: EditorState, from: number, to: number, fallbackText = ''): Pick<SynonymMenu, 'word' | 'from' | 'to'> {
  const selectedText = state.doc.textBetween(from, to, ' ') || fallbackText;
  const matches = Array.from(selectedText.matchAll(/[A-Za-z][A-Za-z'.-]*/g));
  if (!matches.length) return { word: selectedText.trim(), from, to };

  const best = matches
    .filter((match) => (match[0] ?? '').length > 1)
    .sort((a, b) => (b[0]?.length ?? 0) - (a[0]?.length ?? 0))[0] ?? matches[0];
  const word = best[0] ?? '';
  const startOffset = best.index ?? 0;
  return {
    word,
    from: from + startOffset,
    to: from + startOffset + word.length
  };
}

function docMatchesElements(doc: ProseMirrorNode, elements: ScriptElement[], pageChromeOptions: PageChromeOptions): boolean {
  return doc.eq(elementsToProseMirrorDoc(elements, pageChromeOptions));
}
