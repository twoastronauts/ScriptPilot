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
import { screenplayKeymap, splitScreenplayElement } from '@/prosemirror/keymap';
import { screenplayAutoformat } from '@/prosemirror/autoformat';
import { useWorkspace } from '@/store/workspace';
import { ELEMENT_LABELS, estimatePageCount } from '@/shared/screenplay';
import { collectSmartTypeOptions, type SmartTypeOption } from '@/shared/smartType';
import { suggestSynonyms } from '@/shared/synonyms';
import { correctionSpan, suggestCorrections } from '@/shared/proofing';
import { TRANSLATION_LANGUAGES, translateText, type TranslationLanguage } from '@/shared/translation';
import type { ScriptElement, ScriptElementType, TextStyle } from '@/shared/types';

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

interface WriterContextMenu {
  left: number;
  top: number;
  elementId?: string;
  selectedType: ScriptElementType;
  elementText: string;
  rangeFrom: number;
  rangeTo: number;
  selectedText: string;
  word: string;
  wordFrom: number;
  wordTo: number;
  synonyms: string[];
  corrections: string[];
}

const contextElementTypes: ScriptElementType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot', 'general'];
const highlightColors = ['#ffe08a', '#a7d8ff', '#ffb1b1', '#c8f3d1'];

export function ScreenplayEditor() {
  const shellRef = useRef<HTMLElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRemoteRef = useRef(false);
  const menuRef = useRef<SmartTypeMenu | null>(null);
  const synonymMenuRef = useRef<SynonymMenu | null>(null);
  const spellingMenuRef = useRef<SpellingMenu | null>(null);
  const writerContextMenuRef = useRef<WriterContextMenu | null>(null);
  const writerMenuActionAtRef = useRef(0);
  const [smartTypeMenu, setSmartTypeMenu] = useState<SmartTypeMenu | null>(null);
  const [synonymMenu, setSynonymMenu] = useState<SynonymMenu | null>(null);
  const [spellingMenu, setSpellingMenu] = useState<SpellingMenu | null>(null);
  const [writerContextMenu, setWriterContextMenu] = useState<WriterContextMenu | null>(null);
  const [writerNoteDraft, setWriterNoteDraft] = useState('');
  const [writerNoteComposerOpen, setWriterNoteComposerOpen] = useState(false);
  const {
    document,
    selectedElementId,
    setElements,
    setSelectedElement,
    sprintStartedAt,
    addScriptNoteToElement,
    markElementRevised,
    setElementType,
    setWarning,
    updateElementStyle
  } = useWorkspace();
  const sprintActiveRef = useRef(Boolean(sprintStartedAt));
  const elements = document.elements;
  const pageCount = useMemo(() => Math.max(1, estimatePageCount(elements)), [elements]);
  const selectedPage = useMemo(() => estimatePageForElement(elements, selectedElementId), [elements, selectedElementId]);
  const pageActColors = useMemo(() => buildPageActColors(document), [document.structureRanges, document.settings.pageNumberStart]);
  const pageChromeOptions = useMemo<PageChromeOptions>(
    () => ({
      documentTitle: document.title,
      headerText: document.settings.headerText,
      footerText: document.settings.footerText,
      showHeaderFooter: document.settings.showHeaderFooter,
      showPageNumbers: document.settings.showPageNumbers,
      pageNumberStart: document.settings.pageNumberStart,
      pageMode: document.settings.pageMode,
      sprintActive: Boolean(sprintStartedAt),
      sprintElementId: selectedElementId,
      pageActColors
    }),
    [
      document.title,
      document.settings.footerText,
      document.settings.headerText,
      document.settings.pageMode,
      document.settings.pageNumberStart,
      document.settings.showHeaderFooter,
      document.settings.showPageNumbers,
      pageActColors,
      selectedElementId,
      sprintStartedAt
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
    writerContextMenuRef.current = writerContextMenu;
  }, [writerContextMenu]);

  useEffect(() => {
    sprintActiveRef.current = Boolean(sprintStartedAt);
    updateSprintLineClasses(shellRef.current, selectedElementId, sprintActiveRef.current);
    const frame = window.requestAnimationFrame(() => updateSprintLineClasses(shellRef.current, selectedElementId, sprintActiveRef.current));
    const timeout = window.setTimeout(() => updateSprintLineClasses(shellRef.current, selectedElementId, sprintActiveRef.current), 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [selectedElementId, sprintStartedAt]);

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

  const closeWriterContextMenu = useCallback(() => {
    writerContextMenuRef.current = null;
    setWriterContextMenu(null);
    setWriterNoteDraft('');
    setWriterNoteComposerOpen(false);
  }, []);

  const closeWritingMenus = useCallback(() => {
    closeSynonymMenu();
    closeSpellingMenu();
    closeWriterContextMenu();
  }, [closeSpellingMenu, closeSynonymMenu, closeWriterContextMenu]);

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

  const replaceTextRange = useCallback((from: number, to: number, replacement: string) => {
    const view = viewRef.current;
    if (!view) return false;
    view.dispatch(view.state.tr.insertText(replacement, from, to).scrollIntoView());
    view.focus();
    closeWritingMenus();
    return true;
  }, [closeWritingMenus]);

  const openContextNoteComposer = useCallback(() => {
    const menu = writerContextMenuRef.current;
    if (!menu?.elementId) return;
    setWriterNoteDraft(menu.selectedText ? `Selected: "${menu.selectedText}"\n` : '');
    setWriterNoteComposerOpen(true);
  }, []);

  const submitContextNote = useCallback(() => {
    const menu = writerContextMenuRef.current;
    const note = writerNoteDraft.trim();
    if (!menu?.elementId || !note) return;
    setSelectedElement(menu.elementId);
    addScriptNoteToElement(menu.elementId, note);
    setWarning('Note added to selected script line.');
    closeWritingMenus();
  }, [addScriptNoteToElement, closeWritingMenus, setSelectedElement, setWarning, writerNoteDraft]);

  const cancelContextNote = useCallback(() => {
    setWriterNoteDraft('');
    setWriterNoteComposerOpen(false);
  }, []);

  const copyContextText = useCallback(async () => {
    const menu = writerContextMenuRef.current;
    const text = menu?.selectedText || menu?.word || menu?.elementText;
    if (!text) return;
    const copied = await copyTextToClipboard(text);
    setWarning(copied ? 'Selected text copied.' : 'Copy failed.');
    closeWritingMenus();
  }, [closeWritingMenus, setWarning]);

  const applyTextStylePatch = useCallback((from: number, to: number, patch: Partial<TextStyle>, fallbackElementId?: string) => {
    const view = viewRef.current;
    if (!view || from >= to) {
      if (fallbackElementId) updateElementStyle(fallbackElementId, patch);
      return;
    }

    const markType = view.state.schema.marks.textStyle;
    const style = compactTextStylePatch(patch);
    let tr = view.state.tr.removeMark(from, to, markType);
    if (style) tr = tr.addMark(from, to, markType.create({ style }));
    view.dispatch(tr.scrollIntoView());
    view.focus();
  }, [updateElementStyle]);

  const applyContextFormat = useCallback((patch: Partial<TextStyle>) => {
    const menu = writerContextMenuRef.current;
    if (!menu?.elementId) return;
    setSelectedElement(menu.elementId);
    if (menu.selectedText && menu.rangeTo > menu.rangeFrom) {
      applyTextStylePatch(menu.rangeFrom, menu.rangeTo, patch, menu.elementId);
    } else {
      updateElementStyle(menu.elementId, patch);
    }
    closeWritingMenus();
  }, [applyTextStylePatch, closeWritingMenus, setSelectedElement, updateElementStyle]);

  const applyContextElementType = useCallback((type: ScriptElementType) => {
    const menu = writerContextMenuRef.current;
    if (!menu?.elementId) return;
    setSelectedElement(menu.elementId);
    setElementType(menu.elementId, type);
    closeWritingMenus();
  }, [closeWritingMenus, setElementType, setSelectedElement]);

  const markContextRevision = useCallback(() => {
    const menu = writerContextMenuRef.current;
    if (!menu?.elementId) return;
    setSelectedElement(menu.elementId);
    markElementRevised(menu.elementId);
    closeWritingMenus();
  }, [closeWritingMenus, markElementRevised, setSelectedElement]);

  const translateContextSelection = useCallback(async (language: TranslationLanguage) => {
    const menu = writerContextMenuRef.current;
    const text = menu?.selectedText || menu?.word;
    if (!menu || !text) {
      setWarning('Select text before translating.');
      return;
    }
    setWarning('Translating selected text...');
    try {
      const translated = await translateText(text, language);
      replaceTextRange(menu.selectedText ? menu.rangeFrom : menu.wordFrom, menu.selectedText ? menu.rangeTo : menu.wordTo, translated);
      setWarning(`Translated to ${TRANSLATION_LANGUAGES.find((item) => item.code === language)?.label ?? language}.`);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Translation failed.');
      closeWritingMenus();
    }
  }, [closeWritingMenus, replaceTextRange, setWarning]);

  const runWriterMenuAction = useCallback((event: React.MouseEvent, action: () => unknown | Promise<unknown>) => {
    event.preventDefault();
    event.stopPropagation();
    const now = window.performance.now();
    if (now - writerMenuActionAtRef.current < 80) return;
    writerMenuActionAtRef.current = now;
    void action();
  }, []);

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
      const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      if (target?.closest('.synonym-menu, .spelling-menu, .writer-context-menu')) return;
      closeWritingMenus();
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
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
    function applyFormat(event: Event) {
      const view = viewRef.current;
      if (!view) return;
      const patch = (event as CustomEvent<Partial<TextStyle>>).detail;
      const selection = view.state.selection;
      const elementId = selection.$from.parent.attrs.id as string | undefined;
      if (!patch) return;
      if (!selection.empty) {
        applyTextStylePatch(selection.from, selection.to, patch, elementId);
      } else if (elementId) {
        updateElementStyle(elementId, patch);
      }
    }

    window.addEventListener('scriptpilot:format-selection', applyFormat);
    return () => window.removeEventListener('scriptpilot:format-selection', applyFormat);
  }, [applyTextStylePatch, updateElementStyle]);

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

        window.requestAnimationFrame(() => {
          updateSmartTypeMenu(view);
          updateSprintLineClasses(shellRef.current, id, sprintActiveRef.current);
        });
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
          window.setTimeout(() => {
            const active = window.document.activeElement as HTMLElement | null;
            if (active?.closest('.writer-context-menu, .synonym-menu, .spelling-menu')) return;
            closeWritingMenus();
          }, 0);
          return false;
        },
        contextmenu(view, event) {
          const mouseEvent = event as MouseEvent;
          const position = view.posAtCoords({ left: mouseEvent.clientX, top: mouseEvent.clientY });
          if (!position) return false;
          const menu = createWriterContextMenu(view, position.pos, mouseEvent, shellRef.current);
          if (!menu) return false;
          setSelectedElement(menu.elementId);
          closeSynonymMenu();
          closeSpellingMenu();
          setWriterNoteDraft('');
          setWriterNoteComposerOpen(false);
          writerContextMenuRef.current = menu;
          setWriterContextMenu(menu);
          mouseEvent.preventDefault();
          return true;
        }
      },
      handleKeyDown(view, event) {
        if (writerContextMenuRef.current && event.key === 'Escape') {
          event.preventDefault();
          closeWriterContextMenu();
          return true;
        }
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
          event.preventDefault();
          return splitScreenplayElement(view.state, view.dispatch, view);
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
    closeWriterContextMenu,
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
      window.requestAnimationFrame(() => {
        updateSmartTypeMenu(view);
        updateSprintLineClasses(shellRef.current, currentId, sprintActiveRef.current);
      });
      applyingRemoteRef.current = false;
    }
  }, [editorPlugins, elements, pageChromeOptions, selectedElementId, updateSmartTypeMenu]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedElementId) return;
    if (view.hasFocus()) return;
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
    updateSprintLineClasses(shellRef.current, selectedElementId, Boolean(sprintStartedAt));
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
      {writerContextMenu && (
        <div className="writer-context-menu" style={{ left: writerContextMenu.left, top: writerContextMenu.top }} role="menu" aria-label="Writer tools">
          <div className="writer-context-menu__header">
            <strong>{writerContextMenu.selectedText || writerContextMenu.word || 'Line tools'}</strong>
            <small>{ELEMENT_LABELS[writerContextMenu.selectedType]}</small>
          </div>
          {writerContextMenu.corrections.length > 0 && (
            <div className="writer-context-menu__section">
              <span>Did you mean</span>
              <div className="writer-context-menu__chips">
                {writerContextMenu.corrections.slice(0, 5).map((option) => (
                  <button
                    key={option}
                    onMouseDown={(event) => runWriterMenuAction(event, () => replaceTextRange(writerContextMenu.wordFrom, writerContextMenu.wordTo, option))}
                    onClick={(event) => runWriterMenuAction(event, () => replaceTextRange(writerContextMenu.wordFrom, writerContextMenu.wordTo, option))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
          {writerContextMenu.synonyms.length > 0 && (
            <div className="writer-context-menu__section">
              <span>Replace with</span>
              <div className="writer-context-menu__chips">
                {writerContextMenu.synonyms.slice(0, 8).map((option) => (
                  <button
                    key={option}
                    onMouseDown={(event) => runWriterMenuAction(event, () => replaceTextRange(writerContextMenu.wordFrom, writerContextMenu.wordTo, option))}
                    onClick={(event) => runWriterMenuAction(event, () => replaceTextRange(writerContextMenu.wordFrom, writerContextMenu.wordTo, option))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="writer-context-menu__section">
            <span>Writer actions</span>
            <div className="writer-context-menu__grid">
              <button onMouseDown={(event) => runWriterMenuAction(event, openContextNoteComposer)} onClick={(event) => runWriterMenuAction(event, openContextNoteComposer)}>Add note</button>
              <button onMouseDown={(event) => runWriterMenuAction(event, copyContextText)} onClick={(event) => runWriterMenuAction(event, copyContextText)}>Copy</button>
              <button onMouseDown={(event) => runWriterMenuAction(event, markContextRevision)} onClick={(event) => runWriterMenuAction(event, markContextRevision)}>Mark revision</button>
              <button
                onMouseDown={(event) => runWriterMenuAction(event, () => applyContextFormat({ backgroundColor: undefined }))}
                onClick={(event) => runWriterMenuAction(event, () => applyContextFormat({ backgroundColor: undefined }))}
              >
                Clear highlight
              </button>
            </div>
            {writerNoteComposerOpen && (
              <div className="writer-context-menu__note-composer">
                <textarea
                  aria-label="Script note"
                  value={writerNoteDraft}
                  placeholder="Write a note for this line..."
                  onMouseDown={(event) => event.stopPropagation()}
                  onChange={(event) => setWriterNoteDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      event.preventDefault();
                      submitContextNote();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelContextNote();
                    }
                  }}
                />
                <div className="writer-context-menu__note-actions">
                  <button
                    disabled={!writerNoteDraft.trim()}
                    onMouseDown={(event) => runWriterMenuAction(event, submitContextNote)}
                    onClick={(event) => runWriterMenuAction(event, submitContextNote)}
                  >
                    Save note
                  </button>
                  <button onMouseDown={(event) => runWriterMenuAction(event, cancelContextNote)} onClick={(event) => runWriterMenuAction(event, cancelContextNote)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="writer-context-menu__section">
            <span>Translate selection</span>
            <div className="writer-context-menu__chips">
              {TRANSLATION_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  onMouseDown={(event) => runWriterMenuAction(event, () => translateContextSelection(language.code))}
                  onClick={(event) => runWriterMenuAction(event, () => translateContextSelection(language.code))}
                >
                  {language.label}
                </button>
              ))}
            </div>
          </div>
          <div className="writer-context-menu__section">
            <span>{writerContextMenu.selectedText ? 'Format selection' : 'Format line'}</span>
            <div className="writer-context-menu__grid">
              <button
                onMouseDown={(event) => runWriterMenuAction(event, () => applyContextFormat({ bold: true, fontWeight: '700' }))}
                onClick={(event) => runWriterMenuAction(event, () => applyContextFormat({ bold: true, fontWeight: '700' }))}
              >
                Bold
              </button>
              <button
                onMouseDown={(event) => runWriterMenuAction(event, () => applyContextFormat({ italic: true }))}
                onClick={(event) => runWriterMenuAction(event, () => applyContextFormat({ italic: true }))}
              >
                Italic
              </button>
              <button
                onMouseDown={(event) => runWriterMenuAction(event, () => applyContextFormat({ underline: true }))}
                onClick={(event) => runWriterMenuAction(event, () => applyContextFormat({ underline: true }))}
              >
                Underline
              </button>
              <button
                onMouseDown={(event) =>
                  runWriterMenuAction(event, () =>
                    applyContextFormat({ bold: false, italic: false, underline: false, fontWeight: '400', textColor: undefined, backgroundColor: undefined })
                  )
                }
                onClick={(event) =>
                  runWriterMenuAction(event, () =>
                    applyContextFormat({ bold: false, italic: false, underline: false, fontWeight: '400', textColor: undefined, backgroundColor: undefined })
                  )
                }
              >
                Reset
              </button>
            </div>
            <div className="writer-context-menu__swatches">
              {highlightColors.map((color) => (
                <button
                  key={color}
                  title={`Highlight ${color}`}
                  style={{ '--swatch': color } as React.CSSProperties}
                  onMouseDown={(event) => runWriterMenuAction(event, () => applyContextFormat({ backgroundColor: color }))}
                  onClick={(event) => runWriterMenuAction(event, () => applyContextFormat({ backgroundColor: color }))}
                />
              ))}
              <input
                aria-label="Text color"
                type="color"
                defaultValue="#f7fbff"
                onMouseDown={(event) => event.stopPropagation()}
                onChange={(event) => applyContextFormat({ textColor: event.target.value })}
              />
            </div>
          </div>
          <div className="writer-context-menu__section">
            <span>Element style</span>
            <div className="writer-context-menu__chips">
              {contextElementTypes.map((type) => (
                <button
                  key={type}
                  className={writerContextMenu.selectedType === type ? 'is-active' : ''}
                  onMouseDown={(event) => runWriterMenuAction(event, () => applyContextElementType(type))}
                  onClick={(event) => runWriterMenuAction(event, () => applyContextElementType(type))}
                >
                  {ELEMENT_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
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

function buildPageActColors(document: { structureRanges: Array<{ kind: string; visible: boolean; startPage?: number; endPage?: number; color: string }>; settings: { pageNumberStart: number } }): Record<number, string> {
  const colors: Record<number, string> = {};
  const actRanges = document.structureRanges
    .filter((range) => range.visible && range.kind === 'act' && range.startPage && range.endPage)
    .sort((first, second) => (first.startPage ?? 1) - (second.startPage ?? 1));

  for (const range of actRanges) {
    const startPage = Math.max(1, Math.round(range.startPage ?? 1));
    const endPage = Math.max(startPage, Math.round(range.endPage ?? startPage));
    for (let page = startPage; page <= endPage; page += 1) {
      colors[page] = range.color;
    }
  }

  return colors;
}

function lineWidthForElement(type: ScriptElementType): number {
  if (type === 'dialogue') return 36;
  if (type === 'parenthetical') return 28;
  if (type === 'character') return 24;
  return 58;
}

function compactTextStylePatch(patch: Partial<TextStyle>): TextStyle | undefined {
  const style = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== '')) as TextStyle;
  return Object.keys(style).length ? style : undefined;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    const result = await window.screenwriter?.copyToClipboard?.(text);
    if (result && !result.canceled) return true;
  } catch {
    // Fall through to browser clipboard APIs for local dev preview.
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy textarea copy path.
  }

  const textarea = window.document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  window.document.body.appendChild(textarea);
  textarea.select();
  try {
    return window.document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function createWriterContextMenu(view: EditorView, position: number, event: MouseEvent, shell: HTMLElement | null): WriterContextMenu | undefined {
  const state = view.state;
  const elementContext = elementContextAt(state, position);
  if (!elementContext.elementId) return undefined;

  const hasSelection = !state.selection.empty;
  const rangeFrom = hasSelection ? state.selection.from : position;
  const rangeTo = hasSelection ? state.selection.to : position;
  const selectedText = hasSelection ? state.doc.textBetween(rangeFrom, rangeTo, ' ').trim() : '';
  const wordRange = hasSelection ? wordRangeFromTextRange(state, rangeFrom, rangeTo, selectedText) : wordRangeAtPosition(state, position);
  const word = wordRange.word.trim();
  const shellRect = shell?.getBoundingClientRect();
  const rawLeft = event.clientX - (shellRect?.left ?? 0);
  const rawTop = event.clientY - (shellRect?.top ?? 0);
  const maxLeft = Math.max(12, (shellRect?.width ?? 520) - 360);
  const maxTop = Math.max(48, (shellRect?.height ?? 640) - 520);

  return {
    left: Math.max(12, Math.min(maxLeft, rawLeft)),
    top: Math.max(48, Math.min(maxTop, rawTop)),
    elementId: elementContext.elementId,
    selectedType: elementContext.selectedType,
    elementText: elementContext.elementText,
    rangeFrom,
    rangeTo,
    selectedText,
    word,
    wordFrom: wordRange.from,
    wordTo: wordRange.to,
    synonyms: word ? suggestSynonyms(word) : [],
    corrections: word ? suggestCorrections(word).slice(0, 6) : []
  };
}

function elementContextAt(state: EditorState, position: number): { elementId?: string; selectedType: ScriptElementType; elementText: string } {
  const resolved = state.doc.resolve(Math.max(1, Math.min(position, state.doc.content.size)));
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const node = resolved.node(depth);
    if (node.type.name === 'screenplayElement') {
      return {
        elementId: node.attrs.id as string | undefined,
        selectedType: (node.attrs.scriptType ?? 'action') as ScriptElementType,
        elementText: node.textContent
      };
    }
  }
  return { selectedType: 'action', elementText: '' };
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

function updateSprintLineClasses(host: HTMLElement | null, selectedElementId: string | undefined, sprintActive: boolean): void {
  if (!host) return;
  const classes = ['is-current-line', 'is-before-current-1', 'is-before-current-2', 'is-before-current-3', 'is-before-current-4', 'is-far-before-current', 'is-after-current'];
  const lines = Array.from(host.querySelectorAll<HTMLElement>('.script-line'));
  lines.forEach((line) => line.classList.remove(...classes));
  if (!sprintActive || !selectedElementId) return;

  let currentIndex = -1;
  const selection = window.getSelection();
  const anchorElement =
    selection?.anchorNode instanceof Element
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
  const selectionLine = anchorElement?.closest('.script-line') as HTMLElement | null;
  if (selectionLine && host.contains(selectionLine)) {
    currentIndex = lines.indexOf(selectionLine);
  }
  if (currentIndex < 0 && selectedElementId) currentIndex = lines.findIndex((line) => line.dataset.id === selectedElementId);
  if (currentIndex < 0) {
    const activeLine = document.activeElement?.closest?.('.script-line') as HTMLElement | null;
    currentIndex = activeLine && host.contains(activeLine) ? lines.indexOf(activeLine) : -1;
  }
  if (currentIndex < 0) currentIndex = 0;
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
}
