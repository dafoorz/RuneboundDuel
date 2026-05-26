import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
} from 'react-native';

const G = '#E2B04A';

const LEVEL_NAMES = [
  '',
  'The Forgotten Vale',
  'The Cursed Lands',
  'Shadow Depths',
  'The Withered Halls',
  'The Abyss',
  'Realm of Despair',
  'The Dark Spire',
  'Infernal Wastes',
  'The Void Gates',
  'The Final Reckoning',
];

export default function LevelCompleteScreen({
  completedLevel,
  runesEarned,
  nextModifier,
  nextLevel,
  onNext,
}) {
  const glow    = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const isFinalNext = nextLevel === 10;

  return (
    <View style={s.root}>
      <Animated.View style={[s.content, { opacity, transform: [{ translateY: slideY }] }]}>

        {/* Header */}
        <View style={s.headerSection}>
          <Text style={s.levelTag}>LEVEL {completedLevel} — {LEVEL_NAMES[completedLevel] || ''}</Text>
          <Text style={s.completedTitle}>COMPLETE!</Text>
          <Text style={s.trophyIcon}>🏆</Text>
        </View>

        {/* HP restored */}
        <View style={s.healBox}>
          <Text style={s.healIcon}>❤️</Text>
          <Text style={s.healText}>HP restored to full!</Text>
        </View>

        {/* Runes earned */}
        {runesEarned > 0 && (
          <View style={s.runesBox}>
            <Text style={s.runesLabel}>Runes earned this level</Text>
            <Text style={s.runesValue}>💎 {runesEarned}</Text>
          </View>
        )}

        {/* Next level preview */}
        <View style={s.nextLevelBox}>
          <Text style={s.nextLevelLabel}>NEXT: LEVEL {nextLevel}</Text>
          <Text style={s.nextLevelName}>{LEVEL_NAMES[nextLevel] || ''}</Text>
          {isFinalNext ? (
            <View style={s.finalPreview}>
              <Text style={s.finalPreviewIcon}>🏆</Text>
              <Text style={s.finalPreviewText}>The Final Reckoning</Text>
              <Text style={s.finalPreviewSub}>No chaos modifier. Pure skill.</Text>
            </View>
          ) : nextModifier ? (
            <View style={s.modifierPreview}>
              <Text style={s.modPreviewIcon}>{nextModifier.icon}</Text>
              <Text style={s.modPreviewName}>{nextModifier.name}</Text>
              <Text style={s.modPreviewDesc}>{nextModifier.desc}</Text>
            </View>
          ) : (
            <Text style={s.noModText}>No chaos modifier</Text>
          )}
        </View>

        {/* Continue button */}
        <TouchableOpacity style={s.nextBtn} onPress={onNext} activeOpacity={0.85}>
          <Text style={s.nextBtnText}>
            {isFinalNext ? '⚔️ FACE THE RECKONING' : nextModifier ? 'INTO THE CHAOS →' : 'NEXT LEVEL →'}
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06060E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  content: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    gap: 4,
  },
  levelTag: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  completedTitle: {
    color: G,
    fontSize: 46,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginTop: 4,
  },
  trophyIcon: {
    fontSize: 52,
    marginTop: 4,
  },

  // HP heal box
  healBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderWidth: 1,
    borderColor: '#27AE60',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  healIcon: {
    fontSize: 22,
  },
  healText: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Runes
  runesBox: {
    alignItems: 'center',
    gap: 4,
  },
  runesLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  runesValue: {
    color: G,
    fontSize: 26,
    fontWeight: 'bold',
  },

  // Next level preview
  nextLevelBox: {
    width: '100%',
    backgroundColor: 'rgba(15,52,96,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(226,176,74,0.3)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  nextLevelLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  nextLevelName: {
    color: G,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modifierPreview: {
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  modPreviewIcon: {
    fontSize: 36,
  },
  modPreviewName: {
    color: '#CC66FF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modPreviewDesc: {
    color: '#EFEFEF',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    opacity: 0.8,
  },
  finalPreview: {
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  finalPreviewIcon: {
    fontSize: 36,
  },
  finalPreviewText: {
    color: G,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  finalPreviewSub: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  noModText: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Continue button
  nextBtn: {
    backgroundColor: '#7B2FBE',
    borderWidth: 2,
    borderColor: G,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 12,
    marginTop: 6,
  },
  nextBtnText: {
    color: '#EFEFEF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
