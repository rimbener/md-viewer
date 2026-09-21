import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, stepZoom } from '../zoom';

interface ZoomControlProps {
  scale: number;
  onChange: (scale: number) => void;
}

/** Zoom out / reset / zoom in, as one segmented group. */
export function ZoomControl({ scale, onChange }: ZoomControlProps) {
  const theme = useTheme();
  const canZoomOut = scale > MIN_ZOOM;
  const canZoomIn = scale < MAX_ZOOM;

  return (
    <View
      style={[
        styles.group,
        { borderColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      <Segment
        label="−"
        accessibilityLabel="Zoom out"
        disabled={!canZoomOut}
        onPress={() => onChange(stepZoom(scale, -1))}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Segment
        label={`${Math.round(scale * 100)}%`}
        accessibilityLabel="Reset zoom"
        wide
        disabled={scale === DEFAULT_ZOOM}
        onPress={() => onChange(DEFAULT_ZOOM)}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Segment
        label="+"
        accessibilityLabel="Zoom in"
        disabled={!canZoomIn}
        onPress={() => onChange(stepZoom(scale, 1))}
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
          // The percentage stays legible at rest; the steppers grey out.
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
