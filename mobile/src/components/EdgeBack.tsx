import React from 'react';
import { View, Platform, PanResponder, StyleSheet } from 'react-native';

interface EdgeBackProps {
  onBack: () => void;
}

// Width of the left-edge capture strip and the drag distance that counts as a
// "go back" swipe.
const EDGE = 22;
const SWIPE_DISTANCE = 55;

/**
 * Deps-free left-edge swipe-to-back for iOS / web, where there is no native
 * navigation stack to provide it. On Android the OS back gesture / hardware
 * button already fires BackHandler, so this renders null there to avoid a
 * double-trigger. It's a deliberately lightweight approximation (fires on swipe
 * past threshold, no live screen-drag animation) — enough to satisfy "gesture
 * back like typical mobile navigation" without pulling in react-navigation.
 *
 * The strip starts below the header (top: 90) so it never overlaps the local
 * back chevron, and stops above the bottom nav (bottom: 70).
 */
export function EdgeBack({ onBack }: EdgeBackProps) {
  if (Platform.OS === 'android') return null;

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= EDGE,
    onMoveShouldSetPanResponder: (e) => e.nativeEvent.pageX <= EDGE,
    onPanResponderRelease: (_e, gesture) => {
      if (gesture.dx > SWIPE_DISTANCE && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        onBack();
      }
    },
  });

  return <View {...pan.panHandlers} style={styles.edge} />;
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 90,
    bottom: 70,
    left: 0,
    width: EDGE,
    zIndex: 100,
  },
});
