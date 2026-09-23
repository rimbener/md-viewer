import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_QUERY_LENGTH } from '../search';
import { useTheme } from '../theme';

type DocumentSearchProps = {
  query: string;
  count: number;
  active: number;
  capped: boolean;
  onQuery: (query: string) => void;
  onActive: (index: number) => void;
};

/** Find field, match count, and previous / next. Last control on the tools row. */
export function DocumentSearch({
  query,
  count,
  active,
  capped,
  onQuery,
  onActive,
}: DocumentSearchProps) {
  const theme = useTheme();
  const hasQuery = query.length > 0;

  const go = (direction: number) => {
    if (count <= 0) {
      return;
    }
    onActive((active + direction + count) % count);
  };

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.field,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <TextInput
          accessibilityLabel="Find in document"
          placeholder="Find"
          placeholderTextColor={theme.mutedText}
          value={query}
          onChangeText={onQuery}
          onSubmitEditing={() => go(1)}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          style={[styles.input, { color: theme.text }]}
        />
        {/* <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear find"
          hitSlop={4}
          disabled={!hasQuery}
          onPress={() => onQuery('')}
        >
          <Text style={[styles.clear, { color: theme.mutedText }]}>×</Text>
        </Pressable> */}
      </View>
      <Text
        accessibilityLabel={
          count === 0
            ? 'No matches'
            : `Match ${active + 1} of ${count}${capped ? ' or more' : ''}`
        }
        style={[
          styles.count,
          { color: count === 0 ? theme.mutedText : theme.text },
        ]}
      >
        {count === 0 ? '0' : `${active + 1}/${count}${capped ? '+' : ''}`}
      </Text>
      <View
        style={[
          styles.steps,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <Step
          label="↑"
          accessibilityLabel="Previous match"
          disabled={count === 0}
          onPress={() => go(-1)}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Step
          label="↓"
          accessibilityLabel="Next match"
          disabled={count === 0}
          onPress={() => go(1)}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Step
          label="×"
          accessibilityLabel="Clear find"
          disabled={!hasQuery}
          onPress={() => onQuery('')}
        />
      </View>
    </View>
  );
}

type StepProps = {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
};

function Step({ label, accessibilityLabel, disabled, onPress }: StepProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        pressed && !disabled && { backgroundColor: theme.hairline },
      ]}
    >
      <Text
        style={[
          styles.stepLabel,
          { color: disabled ? theme.mutedText : theme.text },
          disabled && styles.disabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingRight: 6,
  },
  input: {
    width: 128,
    //height: 22,
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clear: {
    fontSize: 14,
    lineHeight: 16,
  },
  count: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  step: {
    minWidth: 22,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
  },
  stepLabel: {
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
});
