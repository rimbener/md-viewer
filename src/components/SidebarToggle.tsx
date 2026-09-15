import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme';

interface SidebarToggleProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Shows and hides the file tree. It lives in the document header rather than
 * in the sidebar itself, because a control inside the sidebar disappears with
 * it and leaves no way back.
 */
export function SidebarToggle({ isVisible, onToggle }: SidebarToggleProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isVisible ? 'Hide sidebar' : 'Show sidebar'}
      accessibilityHint="Shows or hides the list of markdown files"
      onPress={onToggle}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && { backgroundColor: theme.hairline },
      ]}>
      {/* A square whose left column is filled while the panel is showing. */}
      <Text style={[styles.glyph, { color: theme.mutedText }]}>
        {isVisible ? '◧' : '◻'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  glyph: {
    fontSize: 14,
    lineHeight: 18,
  },
});
