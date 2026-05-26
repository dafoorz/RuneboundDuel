import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

// ─── Theme ───────────────────────────────────────────────────────────────────

const C = {
  bg:     '#0A0A14',
  gold:   '#E2B04A',
  purple: '#7B2FBE',
  text:   '#EFEFEF',
  muted:  '#888',
};

const THEME_GLOW = {
  '🏰': '#6A30A0',
  '🌲': '#1A6A2A',
  '💀': '#8A1010',
  '🔥': '#C04A00',
  '❄️': '#1A4A9A',
};

// ─── Scenarios ────────────────────────────────────────────────────────────────

export const SCENARIOS = [
  {
    id: 1,
    theme: '🏰',
    location: 'The Forgotten Dungeon',
    story:
      'You descend into a dimly lit corridor. The smell of blood and old iron fills the air. Something watches from the dark.',
    choices: [
      {
        label:  'Proceed cautiously',
        result: 'You find a hidden alcove with supplies.',
        badge:  '+15 HP ❤️',
        effect: { type: 'heal', amount: 15 },
      },
      {
        label:  'Charge forward',
        result: 'You catch the enemy off guard.',
        badge:  '⚔️ Combat — +10 damage bonus',
        effect: { type: 'combatBonus', damage: 10 },
      },
    ],
  },
  {
    id: 2,
    theme: '🌲',
    location: 'The Whispering Forest',
    story:
      'A hooded figure steps out from behind a twisted oak. He holds a glowing card in his outstretched hand.',
    choices: [
      {
        label:  'Accept the card',
        result: 'The card pulses with dark energy as it joins your deck.',
        badge:  '🃏 Rare card added',
        effect: { type: 'rareCard' },
      },
      {
        label:  'Refuse and walk away',
        result: 'The figure nods and hands you some runes.',
        badge:  '💎 +20 Runes',
        effect: { type: 'gold', amount: 20 },
      },
    ],
  },
  {
    id: 3,
    theme: '💀',
    location: 'The Ashen Graveyard',
    story:
      'A ghost drifts toward you, whispering the name of a fallen warrior. It gestures toward an ancient tomb.',
    choices: [
      {
        label:  'Open the tomb',
        result: 'A curse escapes — but so does a powerful relic.',
        badge:  '−10 HP ❤️  ·  🃏 Rare card',
        effect: { type: 'curseRelic', damage: 10 },
      },
      {
        label:  'Leave the tomb undisturbed',
        result: 'The ghost blesses you for your respect.',
        badge:  '+20 HP ❤️',
        effect: { type: 'heal', amount: 20 },
      },
    ],
  },
  {
    id: 4,
    theme: '🔥',
    location: 'The Volcanic Caves',
    story:
      'The ground trembles beneath your feet. Ahead, two tunnels split — one glowing red, one cold and dark.',
    choices: [
      {
        label:  'Take the red tunnel',
        result: 'Intense heat — but you emerge stronger.',
        badge:  '❤️ +5 Max HP (permanent)',
        effect: { type: 'maxHp', amount: 5 },
      },
      {
        label:  'Take the dark tunnel',
        result: 'You find a merchant hiding from the heat.',
        badge:  '🛒 Shop: 2 random cards',
        effect: { type: 'shop' },
      },
    ],
  },
  {
    id: 5,
    theme: '❄️',
    location: 'The Frozen Ruins',
    story:
      'A dying mage collapses before you, pressing a frost-covered tome into your hands.',
    choices: [
      {
        label:  'Study the tome',
        result: 'Ancient knowledge floods your mind.',
        badge:  '🃏 +1 card draw for 3 combats',
        effect: { type: 'cardDraw', turns: 3 },
      },
      {
        label:  'Use it to heal the mage',
        result: 'The mage survives and rewards your kindness.',
        badge:  '💎 +30 Runes  ·  +10 HP ❤️',
        effect: { type: 'goldHeal', gold: 30, hp: 10 },
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryScreen({ usedIds = [], onComplete }) {
  // Pick a random scenario that hasn't been seen this run
  const [scenario] = useState(() => {
    const pool = SCENARIOS.filter((sc) => !usedIds.includes(sc.id));
    const src  = pool.length > 0 ? pool : SCENARIOS;
    return src[Math.floor(Math.random() * src.length)];
  });

  const [phase,       setPhase]        = useState('choice'); // 'choice' | 'result'
  const [chosenResult, setChosenResult] = useState(null);
  const [locked,      setLocked]       = useState(false);   // prevent double-tap

  // Animations
  const choiceFade = useRef(new Animated.Value(0)).current;
  const fadeBlack  = useRef(new Animated.Value(0)).current;
  const resultFade = useRef(new Animated.Value(0)).current;
  const scales     = useRef([new Animated.Value(1), new Animated.Value(1)]).current;
  const glows      = useRef([new Animated.Value(0), new Animated.Value(0)]).current;

  // Fade the choice screen in on mount
  useEffect(() => {
    Animated.timing(choiceFade, {
      toValue: 1, duration: 700, useNativeDriver: true,
    }).start();
  }, []);

  function handleChoice(choice, idx) {
    if (locked) return;
    setLocked(true);

    // Scale + glow pulse on the tapped button
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scales[idx], { toValue: 1.06, duration: 130, useNativeDriver: true }),
        Animated.delay(320),
        Animated.timing(scales[idx], { toValue: 1,    duration: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glows[idx], { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(glows[idx], { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();

    // After the button animation settles, fade to black
    setTimeout(() => {
      setChosenResult(choice);
      Animated.timing(fadeBlack, {
        toValue: 1, duration: 520, useNativeDriver: true,
      }).start(() => {
        // Black is complete — switch to result, then reveal
        setPhase('result');
        Animated.parallel([
          Animated.timing(resultFade, { toValue: 1, duration: 720, useNativeDriver: true }),
          Animated.timing(fadeBlack,  { toValue: 0, duration: 420, useNativeDriver: true }),
        ]).start();
      });
    }, 520);
  }

  const glowColor = THEME_GLOW[scenario.theme] || '#333';

  return (
    <View style={s.root}>

      {/* ── Choice screen ───────────────────────────────────────────────── */}
      {phase === 'choice' && (
        <Animated.View style={[StyleSheet.absoluteFill, s.choiceScreen, { opacity: choiceFade }]}>

          {/* Location name */}
          <Text style={s.location}>{scenario.location.toUpperCase()}</Text>

          {/* Atmospheric emoji with layered glow */}
          <View style={s.emojiSection}>
            <View style={[s.glowOuter, { backgroundColor: glowColor }]} />
            <View style={[s.glowInner, { backgroundColor: glowColor }]} />
            <Text style={s.emoji}>{scenario.theme}</Text>
          </View>

          {/* Story text */}
          <Text style={s.story}>{scenario.story}</Text>

          {/* Choice buttons */}
          <View style={s.choicesContainer}>
            {scenario.choices.map((choice, idx) => (
              <Animated.View
                key={idx}
                style={[s.choiceWrap, { transform: [{ scale: scales[idx] }] }]}
              >
                {/* Gold glow overlay — appears on tap */}
                <Animated.View
                  style={[StyleSheet.absoluteFill, s.choiceGlowLayer, { opacity: glows[idx] }]}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  style={s.choiceBtn}
                  onPress={() => handleChoice(choice, idx)}
                  activeOpacity={0.88}
                >
                  <Text style={s.choiceLetter}>{idx === 0 ? 'A' : 'B'}</Text>
                  <Text style={s.choiceText}>{choice.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

        </Animated.View>
      )}

      {/* ── Result screen ───────────────────────────────────────────────── */}
      {chosenResult && (
        <Animated.View style={[StyleSheet.absoluteFill, s.resultScreen, { opacity: resultFade }]}>
          <Text style={s.resultLabel}>RESULT</Text>
          <View style={s.resultRule} />
          <Text style={s.resultText}>{chosenResult.result}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{chosenResult.badge}</Text>
          </View>
          <TouchableOpacity
            style={s.continueBtn}
            onPress={() => onComplete(scenario, chosenResult)}
            activeOpacity={0.8}
          >
            <Text style={s.continueText}>Continue  →</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Fade-to-black transition overlay ───────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: fadeBlack }]}
        pointerEvents="none"
      />

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A14',
  },

  // ── Choice screen
  choiceScreen: {
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 44,
  },
  location: {
    color: C.gold,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 3,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emojiSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.14,
  },
  glowInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.28,
  },
  emoji: {
    fontSize: 84,
  },
  story: {
    color: '#C8C8C8',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 25,
    paddingHorizontal: 28,
    marginBottom: 28,
  },

  // ── Choice buttons
  choicesContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  choiceWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  choiceGlowLayer: {
    backgroundColor: 'rgba(226,176,74,0.22)',
    borderRadius: 12,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(226,176,74,0.45)',
    borderRadius: 12,
    backgroundColor: 'rgba(15,52,96,0.55)',
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  choiceLetter: {
    color: C.gold,
    fontSize: 16,
    fontWeight: 'bold',
    width: 20,
    textAlign: 'center',
  },
  choiceText: {
    color: C.text,
    fontSize: 15,
    flex: 1,
  },

  // ── Result screen
  resultScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 22,
  },
  resultLabel: {
    color: C.gold,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 5,
  },
  resultRule: {
    width: 50,
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.4,
  },
  resultText: {
    color: C.text,
    fontSize: 19,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 30,
    opacity: 0.95,
  },
  badge: {
    backgroundColor: 'rgba(226,176,74,0.12)',
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: C.gold,
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  continueBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: 48,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 6,
  },
  continueText: {
    color: C.text,
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
