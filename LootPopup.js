import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const CARDS = [
  { name: 'Slash' },
  { name: 'Shield Wall' },
  { name: 'Inferno' },
  { name: 'Gambler' },
];

export default function LootPopup({ onDismiss }) {
  const [randomCard] = useState(() => CARDS[Math.floor(Math.random() * CARDS.length)]);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleUp = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Fade in and scale up
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(scaleUp, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // After 1.5s, fade out and dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleUp, { toValue: 0.9, duration: 500, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        s.container,
        { opacity: fadeIn, transform: [{ scale: scaleUp }] },
      ]}
      pointerEvents="none"
    >
      <Text style={s.label}>LOOT</Text>
      <View style={s.rewards}>
        <Text style={s.gold}>💎 +50 Runes</Text>
        <Text style={s.card}>🃏 {randomCard.name}</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(15, 52, 96, 0.9)',
    borderWidth: 1.5,
    borderColor: '#E2B04A',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  label: {
    color: '#E2B04A',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  rewards: {
    gap: 10,
    alignItems: 'center',
  },
  gold: {
    color: '#EFEFEF',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    color: '#7B2FBE',
    fontSize: 16,
    fontWeight: '600',
  },
});
