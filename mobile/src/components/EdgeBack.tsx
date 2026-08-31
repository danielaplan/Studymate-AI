import React, { useRef } from 'react';
import { View, Platform, PanResponder, StyleSheet, Animated } from 'react-native';
import { BackIcon } from './Icons';
import { colors } from '../theme';

interface EdgeBackProps {
  onBack: () => void;
}

// Width of the left-edge capture strip and the horizontal drag that counts as a
// "go back" swipe.
const EDGE = 24;
const SWIPE_DISTANCE = 50;

/**
 * Deps-free left-edge swipe-to-back for iOS / web, where there is no native
 * navigation stack to provide it. On Android the OS back gesture / hardware
 * button already fires BackHandler, so this renders null there to avoid a
 * double-trigger.
 *
 * It now captures the full screen height (not just the middle band) and gives
 * live feedback: a back chevron fades in and tracks the finger as you drag,
 * then snaps back if you release under threshold. That is a closer
 * approximation of the iOS edge-swipe without pulling in react-navigation.
 * The header's own back chevron still lives at the top-left and is untouched;
 * this strip sits behind it as a gesture surface.
 */
export function EdgeBack({ onBack }: EdgeBackProps) {
  if (Platform.OS === 'android') return null;

  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const reset = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= EDGE,
    onMoveShouldSetPanResponder: (e) => e.nativeEvent.pageX <= EDGE,
    onPanResponderMove: (_e, gesture) => {
      if (gesture.dx > 0 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        translateX.setValue(gesture.dx);
        opacity.setValue(Math.min(1, gesture.dx / SWIPE_DISTANCE));
      }
    },
    onPanResponderRelease: (_e, gesture) => {
      const triggered =
        gesture.dx > SWIPE_DISTANCE && Math.abs(gesture.dx) > Math.abs(gesture.dy);
      reset();
      if (triggered) onBack();
    },
    onPanResponderTerminate: reset,
  });

  return (
    <View {...pan.panHandlers} style={styles.edge}>
      <Animated.View
        style={[
          styles.indicator,
          { opacity, transform: [{ translateX }] },
        ]}
      >
        <BackIcon size={22} color={colors.brandGreen} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE,
    zIndex: 100,
  },
  indicator: {
    position: 'absolute',
    top: '50%',
    left: 6,
    marginTop: -16,
  },
});
