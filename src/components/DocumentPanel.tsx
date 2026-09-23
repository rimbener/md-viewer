import { readFile } from '@dr.pogodin/react-native-fs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DEFAULT_CHARACTERS } from '../column';
import { FindProvider, useShowText } from '../find';
import { watchFile } from '../folderAccess';
import { parseMarkdown } from '../markdown/parseBlocks';
import {
  loadCharacters,
  loadEditorVisible,
  loadFontScheme,
  loadZoom,
  saveCharacters,
  saveEditorVisible,
  saveFontScheme,
  saveZoom,
} from '../preferences';
import { useTheme } from '../theme';
import type { FileNode } from '../types';
import { columnWidth, DEFAULT_SCHEME_ID, schemeById } from '../typography';
import { DEFAULT_ZOOM } from '../zoom';
import { ColumnControl } from './ColumnControl';
import { DocumentSearch } from './DocumentSearch';
import { Editor } from './Editor';
import { EditorToggle } from './EditorToggle';
import { FontControl } from './FontControl';
import { HistoryNav } from './HistoryNav';
import { Markdown } from './Markdown';
import { SidebarToggle } from './SidebarToggle';
import { ZoomControl } from './ZoomControl';

/**
 * Past this size the document is almost certainly not prose, and parsing it
 * would block the UI thread for longer than anyone wants.
 */
const MAX_RENDERED_CHARACTERS = 500_000;

/**
 * How long the typing must stop before the preview is rebuilt. Long enough
 * that a run of keystrokes parses once, short enough to still read as live.
 */
const REPARSE_DELAY_MS = 150;

interface DocumentPanelProps {
  file: FileNode | null;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
}

/** Reads the selected file and renders it as markdown. */
export function DocumentPanel({
  file,
  isSidebarVisible,
  onToggleSidebar,
  canGoBack,
  canGoNext,
  onBack,
  onNext,
}: DocumentPanelProps) {
  const theme = useTheme();
  const [source, setSource] = useState<string | null>(null);
  /** Edits made in this session, or null while the file is as it is on disk. */
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * The edits the preview is built from. It trails `draft` by the debounce, so
   * a burst of keystrokes reparses the document once instead of every time.
   */
  const [settledDraft, setSettledDraft] = useState<string | null>(null);
  const reparse = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reread = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Edits for every file touched this session. Nothing is written to disk, so
   * without this a glance at another document would throw the work away.
   */
  const drafts = useRef(new Map<string, string>());
  const sourceRef = useRef<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diskChanged, setDiskChanged] = useState(false);
  // Zoom and line length are properties of the reader rather than of the
  // document: they survive switching files, and are restored on the next launch.
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [schemeId, setSchemeId] = useState(DEFAULT_SCHEME_ID);
  // Reading is the common case, so the editor stays closed until asked for.
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const hasChosenZoom = useRef(false);
  const hasChosenCharacters = useRef(false);
  const hasChosenScheme = useRef(false);
  const hasChosenEditor = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadZoom().then(stored => {
      // Someone who zoomed while the read was in flight outranks the store.
      if (!cancelled && stored !== null && !hasChosenZoom.current) {
        setScale(stored);
      }
    });

    loadCharacters().then(stored => {
      if (!cancelled && stored !== null && !hasChosenCharacters.current) {
        setCharacters(stored);
      }
    });

    loadFontScheme().then(stored => {
      if (!cancelled && stored !== null && !hasChosenScheme.current) {
        setSchemeId(stored);
      }
    });

    loadEditorVisible().then(stored => {
      if (!cancelled && stored !== null && !hasChosenEditor.current) {
        setIsEditorVisible(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const changeZoom = useCallback((next: number) => {
    hasChosenZoom.current = true;
    setScale(next);
    saveZoom(next);
  }, []);

  const changeCharacters = useCallback((next: number) => {
    hasChosenCharacters.current = true;
    setCharacters(next);
    saveCharacters(next);
  }, []);

  const changeQuery = useCallback((next: string) => {
    setQuery(next);
    setActive(0);
  }, []);

  const handleCount = useCallback((count: number, isCapped: boolean) => {
    setMatchCount(prev => (prev === count ? prev : count));
    setCapped(prev => (prev === isCapped ? prev : isCapped));
    setActive(prev => {
      const next = count === 0 ? 0 : Math.min(prev, count - 1);
      return next === prev ? prev : next;
    });
  }, []);

  const changeScheme = useCallback((next: string) => {
    hasChosenScheme.current = true;
    setSchemeId(next);
    saveFontScheme(next);
  }, []);

  // The write stays out of the state updater, which React may call twice.
  const toggleEditor = useCallback(() => {
    hasChosenEditor.current = true;
    const next = !isEditorVisible;
    setIsEditorVisible(next);
    saveEditorVisible(next);
  }, [isEditorVisible]);

  const path = file?.path ?? null;
  sourceRef.current = source;
  draftRef.current = draft;

  useEffect(() => {
    // A pending reparse belongs to the file being left, not to the new one.
    if (reparse.current !== null) {
      clearTimeout(reparse.current);
      reparse.current = null;
    }
    if (reread.current !== null) {
      clearTimeout(reread.current);
      reread.current = null;
    }

    setQuery('');
    setActive(0);
    setMatchCount(0);
    setCapped(false);

    if (path === null) {
      setSource(null);
      setDraft(null);
      setSettledDraft(null);
      setError(null);
      setDiskChanged(false);
      return;
    }

    // Whatever was typed into this file earlier is what it should open on.
    const stored = drafts.current.get(path) ?? null;
    setDraft(stored);
    setSettledDraft(stored);
    draftRef.current = stored;
    setDiskChanged(false);

    let cancelled = false;
    let ticket = 0;

    const issue = (isReload: boolean) => {
      const t = ++ticket;
      if (!isReload) {
        setIsLoading(true);
        setError(null);
      }
      readFile(path, 'utf8')
        .then(contents => {
          if (cancelled || t !== ticket) {
            return;
          }
          if (isReload && contents === sourceRef.current) {
            return;
          }
          setSource(contents);
          if (isReload && draftRef.current !== null) {
            setDiskChanged(true);
          }
        })
        .catch((cause: unknown) => {
          if (cancelled || t !== ticket || isReload) {
            return;
          }
          setSource(null);
          setError(
            cause instanceof Error ? cause.message : 'Could not read the file.',
          );
        })
        .finally(() => {
          if (!cancelled && t === ticket && !isReload) {
            setIsLoading(false);
          }
        });
    };

    issue(false);

    const stop = watchFile(path, () => {
      if (reread.current !== null) {
        clearTimeout(reread.current);
      }
      reread.current = setTimeout(() => {
        reread.current = null;
        issue(true);
      }, REPARSE_DELAY_MS);
    });

    return () => {
      cancelled = true;
      stop();
      if (reread.current !== null) {
        clearTimeout(reread.current);
        reread.current = null;
      }
    };
  }, [path]);

  const edit = useCallback(
    (next: string) => {
      if (path === null) {
        return;
      }
      drafts.current.set(path, next);
      setDraft(next);
      if (reparse.current !== null) {
        clearTimeout(reparse.current);
      }
      reparse.current = setTimeout(() => {
        reparse.current = null;
        setSettledDraft(next);
      }, REPARSE_DELAY_MS);
    },
    [path],
  );

  useEffect(
    () => () => {
      if (reparse.current !== null) {
        clearTimeout(reparse.current);
      }
      if (reread.current !== null) {
        clearTimeout(reread.current);
      }
    },
    [],
  );

  /** What the editor holds: the edits if there are any, else what is on disk. */
  const text = draft ?? source;
  /** What the reader sees, which lags the editor by the debounce. */
  const rendered = settledDraft ?? source;

  const isTruncated =
    rendered !== null && rendered.length > MAX_RENDERED_CHARACTERS;

  const blocks = useMemo(
    () =>
      rendered === null || rendered.length > MAX_RENDERED_CHARACTERS
        ? []
        : parseMarkdown(rendered),
    [rendered],
  );

  // Prose is read most comfortably at a bounded line length, so the column is
  // capped and centred rather than filling however wide the window happens to
  // be. The cap tracks zoom and the chosen character count.
  const maxWidth = useMemo(
    () => columnWidth(schemeById(schemeId), scale, characters),
    [schemeId, scale, characters],
  );

  const basePath = useMemo(
    () => (path === null ? '' : path.slice(0, path.lastIndexOf('/'))),
    [path],
  );

  const historyNav = (
    <HistoryNav
      canGoBack={canGoBack}
      canGoNext={canGoNext}
      onBack={onBack}
      onNext={onNext}
    />
  );

  if (file === null) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <SidebarToggle
            isVisible={isSidebarVisible}
            onToggle={onToggleSidebar}
          />
          {historyNav}
          <View style={styles.title} />
        </View>
        <View style={[styles.body, styles.centered]}>
          <Text style={[styles.message, { color: theme.mutedText }]}>
            {isSidebarVisible
              ? 'Select a markdown file from the sidebar.'
              : 'Show the sidebar to select a markdown file.'}
          </Text>
        </View>
      </View>
    );
  }

  // A document too large to parse is shown as plain text, and editing it would
  // reparse nothing — so the source pane has nothing to offer there.
  const canEdit = !isTruncated && error === null;

  const document = (
    // Keying on the path resets the scroll position for each document.
    <ScrollView key={file.path} ref={scrollRef} style={styles.body}>
      {/* Left in the native tree so a match can measure its position against it. */}
      <View ref={contentRef} collapsable={false} style={styles.content}>
        {isTruncated ? (
          <Text style={[styles.message, { color: theme.mutedText }]}>
            This file is too large to render; showing it as plain text.
          </Text>
        ) : null}
        {isTruncated ? (
          <PlainBody text={rendered ?? ''} scale={scale} />
        ) : (
          <View style={[styles.column, { maxWidth }]}>
            <Markdown
              blocks={blocks}
              basePath={basePath}
              scale={scale}
              schemeId={schemeId}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <SidebarToggle
          isVisible={isSidebarVisible}
          onToggle={onToggleSidebar}
        />
        {historyNav}
        <EditorToggle
          isVisible={isEditorVisible}
          disabled={!canEdit}
          onToggle={toggleEditor}
        />
        <View style={styles.title}>
          <Text
            style={[styles.fileName, { color: theme.text }]}
            numberOfLines={1}
          >
            {file.name}
          </Text>
          <Text
            style={[styles.filePath, { color: theme.mutedText }]}
            numberOfLines={1}
          >
            {/* Edits live in memory only, which is worth saying out loud. */}
            {draft === null
              ? file.path
              : diskChanged
              ? `${file.path} — edited, not saved — file changed on disk`
              : `${file.path} — edited, not saved`}
          </Text>
        </View>
        <FontControl schemeId={schemeId} onChange={changeScheme} />
        <ColumnControl characters={characters} onChange={changeCharacters} />
        <ZoomControl scale={scale} onChange={changeZoom} />
        <DocumentSearch
          query={query}
          count={matchCount}
          active={active}
          capped={capped}
          onQuery={changeQuery}
          onActive={setActive}
        />
      </View>

      <FindProvider
        query={query}
        active={active}
        contentRef={contentRef}
        scrollRef={scrollRef}
        onCount={handleCount}
      >
        {isLoading ? (
          <View style={[styles.body, styles.centered]}>
            <ActivityIndicator />
          </View>
        ) : error !== null ? (
          <View style={[styles.body, styles.centered]}>
            <Text style={[styles.message, { color: theme.mutedText }]}>
              {error}
            </Text>
          </View>
        ) : isEditorVisible && canEdit ? (
          <View style={styles.split}>
            <Editor value={text ?? ''} scale={scale} onChange={edit} />
            <View
              style={[styles.splitBorder, { backgroundColor: theme.border }]}
            />
            <View style={styles.preview}>{document}</View>
          </View>
        ) : (
          document
        )}
      </FindProvider>
    </View>
  );
}

type PlainBodyProps = {
  text: string;
  scale: number;
};

/** The plain-text fallback, marked by the same find pass as the preview. */
function PlainBody({ text, scale }: PlainBodyProps) {
  const theme = useTheme();
  const show = useShowText();

  return (
    <Text
      selectable
      style={[
        styles.plainText,
        {
          color: theme.text,
          fontSize: 12.5 * scale,
          lineHeight: 18 * scale,
        },
      ]}
    >
      {show(text)}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  filePath: {
    marginTop: 4,
    fontSize: 11,
  },
  body: {
    flex: 1,
  },
  // Source on the left, rendered document on the right, an even split.
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  splitBorder: {
    width: 1,
  },
  preview: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 48,
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
  // The plain-text fallback keeps the full width: monospace is wider per
  // character, so the prose column would wrap it far too early.
  plainText: {
    fontFamily: 'Menlo',
  },
});
