import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recentFolderLabel, type RecentFolder } from '../recentFolders';
import { useTheme } from '../theme';

type RecentFolderMenuProps = {
  folders: readonly RecentFolder[];
  currentPath: string | null;
  disabled: boolean;
  onSelect: (folder: RecentFolder) => void;
};

/** The last folders opened, so one of them can be opened again. */
export function RecentFolderMenu({
  folders,
  currentPath,
  disabled,
  onSelect,
}: RecentFolderMenuProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  if (folders.length === 0) {
    return null;
  }

  const label =
    currentPath === null
      ? 'Recent folders'
      : recentFolderLabel(currentPath, folders);

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recent folders"
        accessibilityHint="Shows the last folders you opened"
        accessibilityState={{ expanded: isOpen }}
        disabled={disabled}
        onPress={() => {
          if (!disabled) {
            setIsOpen(open => !open);
          }
        }}
        style={({ pressed }) => [
          styles.toggle,
          { borderColor: theme.border, backgroundColor: theme.background },
          pressed && !disabled && { backgroundColor: theme.hairline },
          disabled && styles.disabled,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.toggleLabel, { color: theme.text }]}
        >
          {label}
        </Text>
        <Text style={[styles.chevron, { color: theme.mutedText }]}>▾</Text>
      </Pressable>
      {isOpen ? (
        <View
          style={[
            styles.menu,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          {folders.map(folder => {
            const isCurrent = folder.path === currentPath;
            return (
              <Pressable
                key={folder.path}
                accessibilityRole="button"
                accessibilityLabel={folder.path}
                disabled={disabled}
                onPress={() => {
                  setIsOpen(false);
                  onSelect(folder);
                }}
                style={({ pressed }) => [
                  styles.item,
                  isCurrent && { backgroundColor: theme.selectedBackground },
                  pressed && !isCurrent && { backgroundColor: theme.hairline },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.itemLabel,
                    { color: isCurrent ? theme.selectedText : theme.text },
                  ]}
                >
                  {recentFolderLabel(folder.path, folders)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 8,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 13,
  },
  chevron: {
    fontSize: 11,
  },
  disabled: {
    opacity: 0.5,
  },
  menu: {
    marginTop: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  itemLabel: {
    fontSize: 13,
  },
});
