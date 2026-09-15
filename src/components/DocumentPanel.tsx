import { readFile } from '@dr.pogodin/react-native-fs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { parseMarkdown } from '../markdown/parseBlocks';
import {
  loadFontScheme,
  loadZoom,
  saveFontScheme,
  saveZoom,
} from '../preferences';
import { useTheme } from '../theme';
import type { FileNode } from '../types';
import { columnWidth, DEFAULT_SCHEME_ID, schemeById } from '../typography';
import { DEFAULT_ZOOM } from '../zoom';
import { FontControl } from './FontControl';
import { Markdown } from './Markdown';
import { SidebarToggle } from './SidebarToggle';
import { ZoomControl } from './ZoomControl';

/**
 * Past this size the document is almost certainly not prose, and parsing it
 * would block the UI thread for longer than anyone wants.
 */
const MAX_RENDERED_CHARACTERS = 500_000;

interface DocumentPanelProps {
  file: FileNode | null;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
}

/** Reads the selected file and renders it as markdown. */
export function DocumentPanel({
  file,
  isSidebarVisible,
  onToggleSidebar,
}: DocumentPanelProps) {
  const theme = useTheme();
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zoom is a property of the reader rather than of the document: it survives
  // switching files, and is restored on the next launch.
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  const [schemeId, setSchemeId] = useState(DEFAULT_SCHEME_ID);
  const hasChosenZoom = useRef(false);
  const hasChosenScheme = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadZoom().then(stored => {
      // Someone who zoomed while the read was in flight outranks the store.
      if (!cancelled && stored !== null && !hasChosenZoom.current) {
        setScale(stored);
      }
    });

    loadFontScheme().then(stored => {
      if (!cancelled && stored !== null && !hasChosenScheme.current) {
        setSchemeId(stored);
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

  const changeScheme = useCallback((next: string) => {
    hasChosenScheme.current = true;
    setSchemeId(next);
    saveFontScheme(next);
  }, []);

  const path = file?.path ?? null;

  useEffect(() => {
    if (path === null) {
      setSource(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    readFile(path, 'utf8')
      .then(contents => {
        if (!cancelled) {
          setSource(contents);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSource(null);
          setError(
            cause instanceof Error ? cause.message : 'Could not read the file.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const isTruncated =
    source !== null && source.length > MAX_RENDERED_CHARACTERS;

  const blocks = useMemo(
    () => (source === null || source.length > MAX_RENDERED_CHARACTERS
      ? []
      : parseMarkdown(source)),
    [source],
  );

  // Prose is read most comfortably at a bounded line length, so the column is
  // capped and centred rather than filling however wide the window happens to
  // be. The cap tracks the zoom, keeping the characters per line constant.
  const maxWidth = useMemo(
    () => columnWidth(schemeById(schemeId), scale),
    [schemeId, scale],
  );

  const basePath = useMemo(
    () => (path === null ? '' : path.slice(0, path.lastIndexOf('/'))),
    [path],
  );

  if (file === null) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <SidebarToggle
            isVisible={isSidebarVisible}
            onToggle={onToggleSidebar}
          />
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <SidebarToggle isVisible={isSidebarVisible} onToggle={onToggleSidebar} />
        <View style={styles.title}>
          <Text
            style={[styles.fileName, { color: theme.text }]}
            numberOfLines={1}>
            {file.name}
          </Text>
          <Text
            style={[styles.filePath, { color: theme.mutedText }]}
            numberOfLines={1}>
            {file.path}
          </Text>
        </View>
        <FontControl schemeId={schemeId} onChange={changeScheme} />
        <ZoomControl scale={scale} onChange={changeZoom} />
      </View>

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
      ) : (
        // Keying on the path resets the scroll position for each document.
        <ScrollView
          key={file.path}
          style={styles.body}
          contentContainerStyle={styles.content}>
          {isTruncated ? (
            <Text style={[styles.message, { color: theme.mutedText }]}>
              This file is too large to render; showing it as plain text.
            </Text>
          ) : null}
          {isTruncated ? (
            <Text
              selectable
              style={[
                styles.plainText,
                {
                  color: theme.text,
                  fontSize: 12.5 * scale,
                  lineHeight: 18 * scale,
                },
              ]}>
              {source}
            </Text>
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
        </ScrollView>
      )}
    </View>
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
