import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const G = '#E2B04A';
const C = {
  bg:      '#1A1A2E',
  surface: '#16213E',
  primary: '#0F3460',
  gold:    '#E2B04A',
  purple:  '#7B2FBE',
  red:     '#C0392B',
  green:   '#27AE60',
  text:    '#EFEFEF',
  muted:   '#777',
};

// ─── Exported helpers (also used in App.js) ───────────────────────────────────

export function getBribeChance(gold, encounterType) {
  if (encounterType === 'miniBoss') {
    if (gold <= 50)  return 5;
    if (gold <= 150) return 5  + ((gold - 50)  / 100) * 45; // 5 → 50
    if (gold <= 350) return 50 + ((gold - 150) / 200) * 40; // 50 → 90
    return 90;
  }
  if (encounterType === 'boss') {
    if (gold <= 200)  return 5;
    if (gold <= 500)  return 5  + ((gold - 200) / 300) * 45; // 5 → 50
    if (gold <= 1000) return 50 + ((gold - 500) / 500) * 35; // 50 → 85
    return 85;
  }
  // regular
  if (gold <= 10)  return 5;
  if (gold <= 40)  return 5  + ((gold - 10) / 30) * 45; // 5 → 50
  if (gold <= 100) return 50 + ((gold - 40) / 60) * 40; // 50 → 90
  return 90;
}

export function getMinBribeAmount(encounterType) {
  if (encounterType === 'miniBoss') return 50;
  if (encounterType === 'boss')     return 200;
  return 10;
}

function getMaxBribeAmount(encounterType) {
  if (encounterType === 'miniBoss') return 350;
  if (encounterType === 'boss')     return 1000;
  return 100;
}

function getFlavorText(chance) {
  if (chance < 20) return '"He looks unimpressed..."';
  if (chance < 50) return '"He seems to be considering it..."';
  if (chance < 75) return '"His eyes light up with greed..."';
  return '"He can barely contain his excitement..."';
}

function getChanceColor(chance) {
  if (chance >= 65) return C.green;
  if (chance >= 35) return G;
  return C.red;
}

// ─── BribeScreen ─────────────────────────────────────────────────────────────

export default function BribeScreen({ runes, encounterType, onBribe, onCancel }) {
  const minOffer   = getMinBribeAmount(encounterType);
  const maxOffer   = Math.min(getMaxBribeAmount(encounterType), runes);
  const [offerAmount, setOfferAmount] = useState(Math.max(minOffer, Math.min(minOffer, runes)));
  const [sliderWidth, setSliderWidth] = useState(1);

  const chance     = Math.round(getBribeChance(offerAmount, encounterType));
  const flavorText = getFlavorText(chance);
  const canBribe   = runes >= offerAmount && offerAmount >= minOffer && maxOffer >= minOffer;

  const fillRatio  = maxOffer > minOffer
    ? Math.max(0, Math.min(1, (offerAmount - minOffer) / (maxOffer - minOffer)))
    : 0;

  const handleSliderMove = (x) => {
    if (maxOffer <= minOffer) return;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const raw   = minOffer + ratio * (maxOffer - minOffer);
    setOfferAmount(Math.round(raw));
  };

  const enemyLabel =
    encounterType === 'boss'     ? '👹 Boss'      :
    encounterType === 'miniBoss' ? '⚡ Mini Boss'  :
    '👤 Shadow Wraith';

  const THUMB = 22;

  return (
    <View style={s.overlay}>
      <View style={s.card}>

        {/* ── Header ── */}
        <Text style={s.title}>💰 BRIBE</Text>
        <Text style={s.enemyLabel}>{enemyLabel}</Text>

        {/* ── Your runes ── */}
        <View style={s.goldRow}>
          <Text style={s.goldLabel}>Your Runes</Text>
          <Text style={s.goldValue}>💎 {runes}</Text>
        </View>

        {/* ── Offer ── */}
        <Text style={s.offerValue}>💎 {offerAmount}</Text>

        {/* ── Slider ── */}
        {canBribe ? (
          <View style={s.sliderWrapper}>
            {/* Touch-sensitive track */}
            <View
              onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => handleSliderMove(e.nativeEvent.locationX)}
              onResponderMove={(e) => handleSliderMove(e.nativeEvent.locationX)}
              style={s.sliderTrack}
            >
              <View style={[s.sliderFill, { width: fillRatio * sliderWidth }]} />
            </View>
            {/* Thumb overlay (positioned absolute inside sliderWrapper) */}
            <View
              pointerEvents="none"
              style={[s.sliderThumb, { left: fillRatio * sliderWidth - THUMB / 2 }]}
            />
          </View>
        ) : (
          <Text style={s.notEnoughText}>Not enough runes to bribe</Text>
        )}

        <View style={s.sliderLabels}>
          <Text style={s.sliderMin}>💎 {minOffer}</Text>
          <Text style={s.sliderMax}>💎 {maxOffer}</Text>
        </View>

        {/* ── Success chance ── */}
        <View style={s.chanceRow}>
          <Text style={s.chanceLabel}>Success Chance</Text>
          <Text style={[s.chanceValue, { color: getChanceColor(chance) }]}>{chance}%</Text>
        </View>

        {/* ── Flavor text ── */}
        <Text style={s.flavorText}>{flavorText}</Text>

        {/* ── Buttons ── */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={s.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.bribeBtn, !canBribe && s.bribeBtnDisabled]}
            onPress={() => canBribe && onBribe(offerAmount)}
            disabled={!canBribe}
            activeOpacity={0.85}
          >
            <Text style={s.bribeBtnText}>BRIBE 💰</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: G,
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },

  // Header
  title: {
    color: G,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  enemyLabel: {
    color: C.red,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Gold row
  goldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: 'rgba(226,176,74,0.08)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goldLabel: {
    color: C.muted,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  goldValue: {
    color: G,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Offer amount
  offerValue: {
    color: G,
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Slider
  sliderWrapper: {
    width: '100%',
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  sliderTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: G,
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: G,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: -8,
  },
  sliderMin: {
    color: C.muted,
    fontSize: 11,
  },
  sliderMax: {
    color: C.muted,
    fontSize: 11,
  },
  notEnoughText: {
    color: C.red,
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Chance
  chanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
  },
  chanceLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  chanceValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  // Flavor
  flavorText: {
    color: C.muted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.muted,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bribeBtn: {
    flex: 2,
    backgroundColor: 'rgba(226,176,74,0.2)',
    borderWidth: 2,
    borderColor: G,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  bribeBtnDisabled: {
    opacity: 0.35,
  },
  bribeBtnText: {
    color: G,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
