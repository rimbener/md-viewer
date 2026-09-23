import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

interface HistoryNavProps {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
}

/** Back and Next through the files opened in the current folder. */
export function HistoryNav({
  canGoBack,
  canGoNext,
  onBack,
  onNext,
}: HistoryNavProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.group,
        { borderColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      <Segment
        label="‹"
        accessibilityLabel="Back"
        accessibilityHint="Shows the previous file opened in this folder"
        disabled={!canGoBack}
        onPress={onBack}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Segment
        label="›"
        accessibilityLabel="Next"
        accessibilityHint="Shows the next file opened in this folder"
        disabled={!canGoNext}
        onPress={onNext}
      />
    </View>
  );
}

interface SegmentProps {
  label: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  disabled: boolean;
  onPress: () => void;
}

function Segment({
  label,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  onPress,
}: SegmentProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        pressed && !disabled && { backgroundColor: theme.hairline },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    minWidth: 28,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
  },
  label: {
    fontSize: 16,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.4,
  },
});
