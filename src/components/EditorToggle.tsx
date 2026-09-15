import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme';

interface EditorToggleProps {
  isVisible: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * Shows and hides the source editor. It sits beside the sidebar toggle rather
 * than above the editor pane, for the same reason: a control inside the pane
 * it hides leaves no way back.
 */
export function EditorToggle({
  isVisible,
  disabled = false,
  onToggle,
}: EditorToggleProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isVisible ? 'Hide editor' : 'Show editor'}
      accessibilityHint="Shows or hides the markdown source editor"
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.button,
        {
          // Open reads as accent rather than as a different glyph: the pencil
          // has no second form the way the sidebar's half-filled square does.
          borderColor: isVisible ? theme.accent : theme.border,
          backgroundColor: theme.background,
        },
        pressed && { backgroundColor: theme.hairline },
        disabled && styles.disabled,
      ]}>
      <Text
        style={[
          styles.glyph,
          { color: isVisible ? theme.accent : theme.mutedText },
        ]}>
        ✎
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
  disabled: {
    opacity: 0.4,
  },
  glyph: {
    fontSize: 14,
    lineHeight: 18,
  },
});
