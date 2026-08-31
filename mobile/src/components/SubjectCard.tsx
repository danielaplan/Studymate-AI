import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { colors, typography } from '../theme';
import { SubjectItem } from '../types';
import { MasteryProgressBar } from './MasteryProgressBar';
import { MoreVerticalIcon } from './Icons';
import { IconButton } from './IconButton';

interface SubjectCardProps {
  subject: SubjectItem;
  onPress: () => void;
  onOptionsPress?: () => void;
}

export function SubjectCard({ subject, onPress, onOptionsPress }: SubjectCardProps) {
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onPanResponderMove: (_event: any, gestureState: any) => {
        if (gestureState.dx < 0) {
          panX.setValue(Math.max(gestureState.dx, -64));
        }
      },
      onPanResponderRelease: (_event: any, gestureState: any) => {
        if (gestureState.dx < -36) {
          Animated.spring(panX, {
            toValue: -18,
            useNativeDriver: true,
            tension: 80,
            friction: 8,
          }).start(() => {
            onOptionsPress?.();
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 8,
            }).start();
          });
          return;
        }

        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.cardShell}>
      <Animated.View style={[styles.swipeHint, { opacity: subject.pinned ? 0.9 : 0.7, transform: [{ translateX: panX.interpolate({ inputRange: [-60, 0], outputRange: [-8, 0], extrapolate: 'clamp' }) }] }]}>
        <Text style={styles.swipeHintText}>More</Text>
      </Animated.View>

      <Animated.View
        accessibilityLabel={`Subject ${subject.name}`}
        {...panResponder.panHandlers}
        style={[
          styles.container,
          subject.pinned && styles.pinnedContainer,
          { transform: [{ translateX: panX }] },
        ]}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.content, pressed && styles.pressed]}
          android_ripple={{ color: 'rgba(36,60,44,0.08)' }}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              {subject.pinned && (
                <View style={styles.pinnedBadge}>
                  <Text style={styles.pinnedBadgeText}>Pinned</Text>
                </View>
              )}
              <Text style={styles.title}>{subject.name}</Text>
            </View>

            <IconButton
              accessibilityLabel="Subject options"
              onPress={onOptionsPress}
              icon={<MoreVerticalIcon size={18} color={colors.textMuted} />}
            />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.materialsText}>{subject.materialsCount} materials</Text>
            <MasteryProgressBar percentage={subject.mastery} width={80} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    position: 'relative',
    marginBottom: 12,
  },
  swipeHint: {
    position: 'absolute',
    right: 12,
    top: 18,
    backgroundColor: colors.sageBadge,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  swipeHintText: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    color: colors.brandGreen,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  container: {
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pinnedContainer: {
    backgroundColor: '#F7F8F3',
    borderColor: '#C9D8C9',
    shadowColor: colors.brandGreen,
    shadowOpacity: 0.08,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 10,
    borderRadius: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  pinnedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sageBadge,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C7D7C8',
  },
  pinnedBadgeText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.brandGreen,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  materialsText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.82,
  },
});
