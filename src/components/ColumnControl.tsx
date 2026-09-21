import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_CHARACTERS,
  MAX_CHARACTERS,
  MIN_CHARACTERS,
  stepCharacters,
} from '../column';
import { useTheme } from '../theme';

interface ColumnControlProps {
  characters: number;
  onChange: (characters: number) => void;
}

/** Narrower / reset / wider, as one segmented group. */
export function ColumnControl({ characters, onChange }: ColumnControlProps) {
  const theme = useTheme();
  const canNarrow = characters > MIN_CHARACTERS;
  const canWiden = characters < MAX_CHARACTERS;

  return (
    <View
      style={[
        styles.group,
        { borderColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      <Segment
        label="−"
        accessibilityLabel="Decrease line length"
        disabled={!canNarrow}
        onPress={() => onChange(stepCharacters(characters, -1))}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Segment
        label={`${characters}`}
        accessibilityLabel="Reset line length"
        wide
        disabled={characters === DEFAULT_CHARACTERS}
        onPress={() => onChange(DEFAULT_CHARACTERS)}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Segment
        label="+"
        accessibilityLabel="Increase line length"
        disabled={!canWiden}
        onPress={() => onChange(stepCharacters(characters, 1))}
      />
    </View>
  );
}

interface SegmentProps {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  wide?: boolean;
  onPress: () => void;
}

function Segment({
  label,
  accessibilityLabel,
  disabled,
  wide = false,
  onPress,
}: SegmentProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        wide && styles.wideSegment,
        pressed && { backgroundColor: theme.hairline },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: disabled && !wide ? theme.mutedText : theme.text },
          disabled && !wide && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
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
  wideSegment: {
    minWidth: 52,
  },
  divider: {
    width: 1,
  },
  label: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  disabledLabel: {
    opacity: 0.5,
  },
});
