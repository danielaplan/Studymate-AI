import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../theme';

const R = 44;
const STROKE = 9;
const SIZE = 104;
const CIRC = 2 * Math.PI * R; // ≈ 276.46

interface MasteryRingProps {
  /** Overall mastery, 0–100. */
  percentage: number;
}

/**
 * Hero ring for a subject's overall mastery. Two SVG circles (track + fill); the
 * fill's `strokeDashoffset` is driven by a core `Animated.Value` so the arc draws
 * in over ~1s. The center % counts up in sync via the same listener. Each circle
 * is rotated `rotate(-90 52 52)` (SVG transform) so the arc starts at 12 o'clock.
 * Uses core RN `Animated` (no reanimated/Babel plugin) so it can't break on a
 * missed dev-server restart. Honors OS "reduce motion".
 */
export function MasteryRing({ percentage }: MasteryRingProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  const [display, setDisplay] = useState('0.0');
  const [offset, setOffset] = useState(CIRC);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (mounted) setReduced(r);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      progress.setValue(clamped);
      setDisplay(clamped.toFixed(1));
      setOffset(CIRC * (1 - clamped / 100));
      return;
    }
    progress.setValue(0);
    const id = progress.addListener(({ value }) => {
      setDisplay(value.toFixed(1));
      setOffset(CIRC * (1 - value / 100));
    });
    Animated.timing(progress, {
      toValue: clamped,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => progress.removeListener(id));
    return () => {
      progress.removeListener(id);
      progress.stopAnimation();
    };
  }, [clamped, reduced, progress]);

  return (
    <View style={styles.ringWrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={colors.borderMedium}
          strokeWidth={STROKE}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={colors.brandGreen}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPct}>
          {display}
          <Text style={styles.ringPctSup}>%</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontFamily: typography.serifBold,
    fontSize: 22,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ringPctSup: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
