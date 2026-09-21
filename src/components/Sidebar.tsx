import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../theme';
import type { DirectoryNode, FileNode } from '../types';
import { FileTree } from './FileTree';

interface SidebarProps {
  root: DirectoryNode | null;
  selectedPath: string | null;
  isScanning: boolean;
  error: string | null;
  fileCount: number;
  onChooseFolder: () => void;
  onReloadFolder: () => void;
  onSelectFile: (file: FileNode) => void;
  onSelectDirectory: (directory: DirectoryNode) => void;
}

export function Sidebar({
  root,
  selectedPath,
  isScanning,
  error,
  fileCount,
  onChooseFolder,
  onReloadFolder,
  onSelectFile,
  onSelectDirectory,
}: SidebarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sidebar,
        { backgroundColor: theme.sidebar, borderRightColor: theme.border },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.actions}>
          <Pressable
            onPress={onChooseFolder}
            disabled={isScanning}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.border, backgroundColor: theme.background },
              pressed && { backgroundColor: theme.hairline },
              isScanning && styles.buttonDisabled,
            ]}
          >
            <Text style={[styles.buttonLabel, { color: theme.accent }]}>
              {root ? 'Change Folder…' : 'Choose Folder…'}
            </Text>
          </Pressable>
          {root ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reload folder"
              accessibilityHint="Reads the folder again so new markdown files are shown"
              onPress={onReloadFolder}
              disabled={isScanning}
              style={({ pressed }) => [
                styles.button,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
                pressed && { backgroundColor: theme.hairline },
                isScanning && styles.buttonDisabled,
              ]}
            >
              <Text style={[styles.buttonLabel, { color: theme.accent }]}>
                Reload
              </Text>
            </Pressable>
          ) : null}
        </View>

        {root ? (
          <Text
            style={[styles.rootPath, { color: theme.mutedText }]}
            numberOfLines={1}
          >
            {root.path}
          </Text>
        ) : null}
      </View>

      {root ? (
        <FileTree
          // Remounting per folder resets the expansion state with it.
          key={root.path}
          root={root}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onSelectDirectory={onSelectDirectory}
        />
      ) : isScanning ? (
        <View style={styles.status}>
          <ActivityIndicator />
          <Text style={[styles.statusText, { color: theme.mutedText }]}>
            Scanning…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: theme.mutedText }]}>
            {error}
          </Text>
        </View>
      ) : (
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: theme.mutedText }]}>
            No folder selected yet.
          </Text>
        </View>
      )}

      {root && !error ? (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.mutedText }]}>
            {fileCount} markdown {fileCount === 1 ? 'file' : 'files'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  rootPath: {
    marginTop: 8,
    fontSize: 11,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 11,
  },
});
