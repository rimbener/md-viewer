import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../theme';

interface EditorProps {
  value: string;
  /** Zoom, applied to the source the same way it is applied to the prose. */
  scale: number;
  onChange: (next: string) => void;
}

/**
 * The markdown source, editable. Every keystroke is handed straight back so
 * the rendered document beside it stays in step; nothing is written to disk.
 *
 * Monospace at full pane width, because source lines carry tables and fenced
 * code that the prose column's measure would wrap far too early.
 */
export function Editor({ value, scale, onChange }: EditorProps) {
  const theme = useTheme();

  return (
    <View style={[styles.pane, { backgroundColor: theme.sidebar }]}>
      <TextInput
        accessibilityLabel="Markdown source"
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChangeText={onChange}
        style={[
          styles.input,
          {
            color: theme.text,
            fontSize: 12.5 * scale,
            lineHeight: 18 * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontFamily: 'Menlo',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});
