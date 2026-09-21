import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ancestorPaths } from '../scanDirectory';
import { useTheme } from '../theme';
import type { DirectoryNode, FileNode, TreeNode } from '../types';

const INDENT_PER_LEVEL = 14;
const ROW_HEIGHT = 26;

interface Row {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
}

/** Depth-first walk that emits only the rows currently visible. */
function flatten(
  nodes: TreeNode[],
  expandedPaths: Set<string>,
  depth: number,
  rows: Row[],
): void {
  for (const node of nodes) {
    const isExpanded =
      node.kind === 'directory' && expandedPaths.has(node.path);
    rows.push({ node, depth, isExpanded });

    if (node.kind === 'directory' && isExpanded) {
      flatten(node.children, expandedPaths, depth + 1, rows);
    }
  }
}

/**
 * The root, plus every directory on the way down to an already-selected file —
 * a selection restored from the last session has to be visible to be useful.
 */
function initialExpansion(
  root: DirectoryNode,
  selectedPath: string | null,
): Set<string> {
  const expanded = new Set([root.path]);
  if (selectedPath !== null) {
    for (const ancestor of ancestorPaths(selectedPath, root.path)) {
      expanded.add(ancestor);
    }
  }
  return expanded;
}

interface FileTreeProps {
  root: DirectoryNode;
  selectedPath: string | null;
  onSelectFile: (file: FileNode) => void;
  onSelectDirectory: (directory: DirectoryNode) => void;
}

export function FileTree({
  root,
  selectedPath,
  onSelectFile,
  onSelectDirectory,
}: FileTreeProps) {
  const theme = useTheme();
  // The root starts open, as does the path to a restored selection; everything
  // else starts collapsed.
  const [expandedPaths, setExpandedPaths] = useState(() =>
    initialExpansion(root, selectedPath),
  );

  const rows = useMemo(() => {
    const collected: Row[] = [];
    flatten([root], expandedPaths, 0, collected);
    return collected;
  }, [root, expandedPaths]);

  // Read once, on mount: a restored selection can sit below the fold.
  const [initialIndex] = useState(() =>
    selectedPath === null
      ? 0
      : Math.max(
          rows.findIndex(row => row.node.path === selectedPath),
          0,
        ),
  );

  const toggleDirectory = useCallback((path: string) => {
    setExpandedPaths(previous => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      const { node, depth, isExpanded } = item;
      const isDirectory = node.kind === 'directory';
      const isSelected = !isDirectory && node.path === selectedPath;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            { paddingLeft: 8 + depth * INDENT_PER_LEVEL },
            isSelected && { backgroundColor: theme.selectedBackground },
            pressed && !isSelected && { backgroundColor: theme.hairline },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isDirectory ? `${node.name} folder` : node.name}
          onPress={() => {
            if (isDirectory) {
              onSelectDirectory(node);
              toggleDirectory(node.path);
            } else {
              onSelectFile(node);
            }
          }}
        >
          <Text
            style={[
              styles.disclosure,
              { color: isSelected ? theme.selectedText : theme.mutedText },
            ]}
          >
            {isDirectory ? (isExpanded ? '▾' : '▸') : ''}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: isSelected ? theme.selectedText : theme.text },
              isDirectory && styles.directoryLabel,
            ]}
          >
            {node.name}
          </Text>
        </Pressable>
      );
    },
    [selectedPath, theme, toggleDirectory, onSelectFile, onSelectDirectory],
  );

  return (
    <FlatList
      data={rows}
      initialScrollIndex={initialIndex}
      keyExtractor={row => row.node.path}
      renderItem={renderRow}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.mutedText }]}>
            No markdown files found.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  disclosure: {
    width: 14,
    fontSize: 10,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
  directoryLabel: {
    fontWeight: '600',
  },
  empty: {
    padding: 16,
  },
  emptyText: {
    fontSize: 12,
  },
});
