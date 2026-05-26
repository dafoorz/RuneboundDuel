import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
} from 'react-native';

const G = '#E2B04A';
const LEVEL_INTROS = {
  1:  'ah, here we go again…',
  2:  'the air grows darker.',
  3:  'shadows close in.',
  4:  'the halls smell of ruin.',
  5:  'something stirs in the deep.',
  6:  'despair seeps into your bones.',
  7:  'the spire looms above.',
  8:  'fire and ash surround you.',
  9:  'the void gate stands open.',
  10: 'this is where it ends.',
};

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

export default function LevelStartScreen({ level, modifier, onEnter }) {
  const iconScale   = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Title slides up
    Animated.parallel([
      Animated.timing(titleY,       { toValue: 0,   duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1,   duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Modifier icon pulses in after a short delay
    if (modifier) {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(iconScale,   { toValue: 1.3, duration: 350, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          Animated.timing(iconOpacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
          Animated.timing(iconScale,   { toValue: 1.0, duration: 200, easing: Easing.in(Easing.cubic),   useNativeDriver: true }),
        ]).start();
      }, 400);
    }
  }, []);

  const isLastLevel = level === 10;
  const levelName   = LEVEL_NAMES[level] || '';
  const introText   = LEVEL_INTROS[level] || '';
  const btnLabel    = modifier ? 'ENTER THE CHAOS' : isLastLevel ? 'FACE THE RECKONING' : 'BEGIN';

  return (
    <View style={s.root}>
      {/* Level number */}
      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
        <Text style={s.levelNumber}>LEVEL {level}</Text>
        <Text style={s.levelName}>{levelName}</Text>
        <Text style={s.introText}>{introText}</Text>
      </Animated.View>

      {/* Chaos modifier reveal */}
      {modifier && (
        <Animated.View style={[s.modifierBox, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
          <Text style={s.chaosLabel}>CHAOS MODIFIER</Text>
          <Text style={s.modIcon}>{modifier.icon}</Text>
          <Text style={s.modName}>{modifier.name}</Text>
          <Text style={s.modDesc}>{modifier.desc}</Text>
          <Text style={s.modTip}>💡 {modifier.tip}</Text>
        </Animated.View>
      )}

      {/* Level 10: no modifier, just final challenge text */}
      {isLastLevel && !modifier && (
        <View style={s.finalBox}>
          <Text style={s.finalIcon}>🏆</Text>
          <Text style={s.finalLabel}>FINAL CHALLENGE</Text>
          <Text style={s.finalDesc}>No chaos modifier. Just you and the ultimate boss.</Text>
        </View>
      )}

      {/* Level 1: no modifier intro */}
      {level === 1 && !modifier && (
        <View style={s.level1Box}>
          <Text style={s.level1Icon}>⚔️</Text>
          <Text style={s.level1Desc}>Slay 10 enemies to complete the level.</Text>
          <Text style={s.level1Tip}>Mini-bosses appear at fights 3 and 6. The boss awaits at fight 10.</Text>
        </View>
      )}

      <TouchableOpacity style={s.enterBtn} onPress={onEnter} activeOpacity={0.85}>
        <Text style={s.enterBtnText}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07070F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 32,
  },

  levelNumber: {
    color: G,
    fontSize: 44,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
  },
  levelName: {
    color: '#EFEFEF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  introText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  // Modifier box
  modifierBox: {
    width: '100%',
    backgroundColor: 'rgba(40,0,80,0.6)',
    borderWidth: 2,
    borderColor: '#AA00FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  chaosLabel: {
    color: '#AA00FF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  modIcon: {
    fontSize: 56,
    marginVertical: 4,
  },
  modName: {
    color: '#CC66FF',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modDesc: {
    color: '#EFEFEF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.9,
  },
  modTip: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },

  // Final level
  finalBox: {
    alignItems: 'center',
    gap: 10,
  },
  finalIcon: {
    fontSize: 56,
  },
  finalLabel: {
    color: G,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  finalDesc: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Level 1
  level1Box: {
    alignItems: 'center',
    gap: 10,
  },
  level1Icon: {
    fontSize: 52,
  },
  level1Desc: {
    color: '#EFEFEF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  level1Tip: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // Enter button
  enterBtn: {
    backgroundColor: '#7B2FBE',
    borderWidth: 2,
    borderColor: G,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 8,
  },
  enterBtnText: {
    color: '#EFEFEF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
