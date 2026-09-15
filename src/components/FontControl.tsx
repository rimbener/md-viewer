import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { nextSchemeId, schemeById } from '../typography';

interface FontControlProps {
  schemeId: string;
  onChange: (schemeId: string) => void;
}

/** Cycles through the font schemes, showing the current one by name. */
export function FontControl({ schemeId, onChange }: FontControlProps) {
  const theme = useTheme();
  const scheme = schemeById(schemeId);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change font, currently ${scheme.name}`}
      accessibilityHint={scheme.description}
      onPress={() => onChange(nextSchemeId(scheme.id))}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && { backgroundColor: theme.hairline },
      ]}>
      <View style={styles.content}>
        <Text style={[styles.sample, { color: theme.text }]}>Aa</Text>
        <Text style={[styles.name, { color: theme.mutedText }]}>
          {scheme.name}
        </Text>
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sample: {
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 12,
  },
});
