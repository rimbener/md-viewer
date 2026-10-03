import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLOR_SCHEMES, type ColorSchemeId } from '../colorScheme';
import { useColorSchemeChoice, useTheme } from '../theme';

export function ColorSchemeControl() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.group,
        { borderColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      {COLOR_SCHEMES.map((scheme, index) => (
        <Fragment key={scheme.id}>
          {index > 0 ? (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          ) : null}
          <Segment id={scheme.id} name={scheme.name} />
        </Fragment>
      ))}
    </View>
  );
}

type SegmentProps = {
  id: ColorSchemeId;
  name: string;
};

function Segment({ id, name }: SegmentProps) {
  const theme = useTheme();
  const { schemeId, setSchemeId } = useColorSchemeChoice();
  const selected = id === schemeId;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} color scheme`}
      accessibilityState={{ selected }}
      onPress={() => setSchemeId(id)}
      style={({ pressed }) => [
        styles.segment,
        selected && { backgroundColor: theme.selectedBackground },
        pressed && !selected && { backgroundColor: theme.hairline },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? theme.selectedText : theme.text },
        ]}
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
  },
  label: {
    fontSize: 12,
  },
});
