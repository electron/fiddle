import './editor.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { Icon } from '../../ui';
import { useLatest } from '../hooks';
import { useAppState } from '../state';
import {
  clearFocusedEditor,
  getViewState,
  saveViewState,
  setCursor,
  setFocusedEditor,
  useEditorViewState,
} from './editor-state';
import styles from './EditorPane.module.css';
import { useModel } from './models';
import { monaco, monoFontFamily } from './monaco';
import {
  claimReveal,
  useRevealRequest,
  useRuntimeErrors,
  type RuntimeError,
} from './runtime-errors';

/** Line numbers (48) plus padding (18): the code column starts here. */
const GUTTER = 66;

export interface EditorPaneProps {
  file: string;
  /** The focused pane: reports its cursor to the status bar even before its editor has focus. */
  primary?: boolean;
  onFocus?: () => void;
}

interface Zone {
  id: string;
  inner: HTMLDivElement;
  zone: monaco.editor.IViewZone;
  root: Root;
}

export function EditorPane({ file, primary = false, onFocus }: EditorPaneProps) {
  const { t, i18n } = useTranslation('shell');
  const host = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const model = useModel(file);
  const view = useEditorViewState();
  const app = useAppState();
  const settings = app?.settings ?? null;
  // Font changes apply after a reload, so read them once.
  const font = useRef({
    family: settings?.editorFontFamily || monoFontFamily(),
    size: settings?.editorFontSize ?? 13,
  });
  const screenReader = app?.screenReaderActive ?? false;
  const latest = useLatest({ file, primary, onFocus });
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const instance = monaco.editor.create(node, {
      model: null,
      automaticLayout: true,
      fontFamily: font.current.family,
      fontSize: font.current.size,
      lineHeight: Math.round((font.current.size * 20) / 13),
      fontLigatures: false,
      padding: { top: 12, bottom: 12 },
      minimap: { enabled: false },
      wordWrap: 'on',
      glyphMargin: false,
      folding: false,
      lineNumbersMinChars: 5,
      lineDecorationsWidth: 18,
      renderLineHighlight: 'all',
      // Lucent's syntax palette only: no rainbow brackets or guide lines.
      bracketPairColorization: { enabled: false },
      guides: { indentation: false, bracketPairs: false },
      scrollBeyondLastLine: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      fixedOverflowWidgets: true,
      scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      tabSize: 2,
      // Main shows a native context menu.
      contextmenu: false,
    });

    // Hold the code column at 66px whatever the line-number width works out to.
    const fitGutter = () => {
      const info = instance.getLayoutInfo();
      const want = Math.max(0, GUTTER - info.glyphMarginWidth - info.lineNumbersWidth);
      if (info.decorationsWidth !== want)
        instance.updateOptions({ lineDecorationsWidth: want });
    };
    const subscriptions = [
      instance.onDidLayoutChange(fitGutter),
      instance.onDidFocusEditorText(() => {
        setFocusedEditor(instance);
        latest.current.onFocus?.();
        const position = instance.getPosition();
        if (position)
          setCursor(latest.current.file, position.lineNumber, position.column);
      }),
      instance.onDidChangeCursorPosition(({ position }) => {
        if (instance.hasTextFocus() || latest.current.primary)
          setCursor(latest.current.file, position.lineNumber, position.column);
      }),
    ];
    fitGutter();
    setEditor(instance);
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
      clearFocusedEditor(instance);
      instance.dispose();
    };
  }, [latest]);

  useEffect(() => {
    if (!editor) return;
    const next = model ?? null;
    if (editor.getModel() === next) return;
    if (shown.current && editor.getModel())
      saveViewState(shown.current, editor.saveViewState());
    editor.setModel(next);
    shown.current = next ? file : null;
    const saved = getViewState(file);
    if (next && saved) editor.restoreViewState(saved);
    // Draws now, not on the next frame: a window that is still hidden may not get one for a second.
    editor.render();
  }, [editor, model, file]);

  // The focused pane's cursor shows in the status bar, also when focus came from the tab row.
  useEffect(() => {
    if (!editor || !primary || !model || editor.getModel() !== model) return;
    const position = editor.getPosition();
    if (position) setCursor(file, position.lineNumber, position.column);
  }, [editor, model, file, primary]);

  useEffect(() => {
    editor?.updateOptions({
      wordWrap: view.softWrap ? 'on' : 'off',
      minimap: { enabled: view.minimap },
      ariaLabel: t('editorFor', { name: file }),
      accessibilitySupport: screenReader ? 'on' : 'off',
    });
  }, [editor, view.softWrap, view.minimap, file, t, screenReader]);

  const reveal = useRevealRequest();
  useEffect(() => {
    if (
      !editor ||
      !model ||
      !reveal ||
      reveal.file !== file ||
      editor.getModel() !== model
    )
      return;
    if (!claimReveal(reveal.seq)) return;
    editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
    editor.revealLineInCenterIfOutsideViewport(reveal.line);
    editor.focus();
  }, [editor, model, reveal, file]);

  const errors = useRuntimeErrors();
  const mine = useMemo(() => {
    const byLine = new Map<number, RuntimeError>();
    for (const error of errors)
      if (error.file === file && !byLine.has(error.line)) byLine.set(error.line, error);
    return [...byLine.values()];
  }, [errors, file]);
  useEffect(() => {
    if (!editor || !model || editor.getModel() !== model || mine.length === 0) return;
    const zones: Zone[] = [];
    editor.changeViewZones((accessor) => {
      for (const error of mine) {
        if (error.line > model.getLineCount()) continue;
        const node = document.createElement('div');
        const inner = document.createElement('div');
        inner.className = 'lu-lens-zone';
        node.appendChild(inner);
        const zone: monaco.editor.IViewZone = {
          afterLineNumber: error.line,
          heightInPx: 64,
          domNode: node,
        };
        const root = createRoot(inner);
        root.render(
          <I18nextProvider i18n={i18n}>
            <Lens error={error} />
          </I18nextProvider>,
        );
        zones.push({ id: accessor.addZone(zone), inner, zone, root });
      }
    });
    // The lens wraps with the pane's width, so its zone follows its height.
    const observer = new ResizeObserver(() => {
      editor.changeViewZones((accessor) => {
        for (const { id, inner, zone } of zones) {
          const height = inner.offsetHeight;
          if (height === 0 || zone.heightInPx === height) continue;
          zone.heightInPx = height;
          accessor.layoutZone(id);
        }
      });
    });
    for (const { inner } of zones) observer.observe(inner);
    return () => {
      observer.disconnect();
      editor.changeViewZones((accessor) => {
        for (const { id } of zones) accessor.removeZone(id);
      });
      // Not while React is committing this component.
      queueMicrotask(() => {
        for (const { root } of zones) root.unmount();
      });
    };
  }, [editor, model, mine, i18n]);

  return (
    // Code reads left to right in every locale; only the chrome mirrors.
    <div className={styles.pane} dir="ltr">
      <div ref={host} className={styles.host} />
    </div>
  );
}

function Lens({ error }: { error: RuntimeError }) {
  const { t } = useTranslation('shell');
  return (
    <div className="lu-lens" role="note">
      <Icon name="warning" className="lu-lens-icon" />
      <div>
        <div>
          <span className="lu-lens-title">{error.name}</span> {error.message}
        </div>
        <div className="lu-lens-hint">
          {t('lensHint', {
            process: t(`lensProcess.${error.process}`),
            file: error.file,
            line: error.line,
            column: error.column ?? 1,
          })}
        </div>
      </div>
    </div>
  );
}
