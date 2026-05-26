import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';

const G = '#E2B04A';

// ─── Upgrade definitions ──────────────────────────────────────────────────────

const UPGRADES = [
  {
    id:       'cardSlot',
    icon:     '🃏',
    name:     '+1 Card Slot',
    desc:     'Loadout capacity increases by 1 (max 10)',
    cost:     50,
    getLabel: (u) => `${u.cardSlots} / 10 slots`,
    isMaxed:  (u) => u.cardSlots >= 10,
  },
  {
    id:       'dieSlot',
    icon:     '🎲',
    name:     '+1 Die Slot',
    desc:     'Dice loadout increases by 1 (max 5)',
    cost:     75,
    getLabel: (u) => `${u.diceSlots} / 5 slots`,
    isMaxed:  (u) => u.diceSlots >= 5,
  },
  {
    id:       'hp',
    icon:     '❤️',
    name:     '+10 Starting HP',
    desc:     'Permanently raise your starting max HP',
    cost:     30,
    getLabel: (u) => `${100 + u.hpBonus} HP`,
    isMaxed:  (_) => false,
  },
  {
    id:       'gold',
    icon:     '💎',
    name:     '+5 Starting Runes',
    desc:     'Gain bonus runes at the start of each run',
    cost:     20,
    getLabel: (u) => `+${u.goldBonus} per run`,
    isMaxed:  (_) => false,
  },
  {
    id:       'rareCard',
    icon:     '✨',
    name:     'Rare Card Gift',
    desc:     'Start every run with a free random Rare card',
    cost:     100,
    getLabel: (u) => u.rareCard ? '✓ Active' : 'Not purchased',
    isMaxed:  (u) => u.rareCard,
  },
  {
    id:       'rareDie',
    icon:     '🌟',
    name:     'Rare Die Gift',
    desc:     'Start every run with a free random Rare die',
    cost:     100,
    getLabel: (u) => u.rareDie ? '✓ Active' : 'Not purchased',
    isMaxed:  (u) => u.rareDie,
  },
];

// ─── ShrineScreen ─────────────────────────────────────────────────────────────
// Props:
//   runes      – current rune balance
//   upgrades   – { cardSlots, diceSlots, hpBonus, goldBonus, rareCard, rareDie }
//   onBuy(id)  – spend runes on an upgrade
//   onContinue – "Begin Run" → new run (always resets)
//   onBack     – "Back to Loadout" (null if not applicable)

export default function ShrineScreen({ runes, upgrades, onBuy, onContinue, onBack, onMainMenu }) {
  return (
    <View style={s.root}>

      {/* Header */}
      <Text style={s.title}>🏛️ RUNE SHRINE</Text>
      <Text style={s.subtitle}>Spend runes on permanent upgrades</Text>

      {/* Rune balance */}
      <View style={s.runesBadge}>
        <Text style={s.runesText}>💎 {runes} Runes</Text>
      </View>

      {/* Upgrade list */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
      >
        {UPGRADES.map(upg => {
          const maxed     = upg.isMaxed(upgrades);
          const canAfford = runes >= upg.cost;
          const buyable   = !maxed && canAfford;

          return (
            <View key={upg.id} style={[s.row, maxed && s.rowMaxed]}>
              <Text style={s.upgIcon}>{upg.icon}</Text>
              <View style={s.upgInfo}>
                <Text style={s.upgName}>{upg.name}</Text>
                <Text style={s.upgDesc}>{upg.desc}</Text>
                <Text style={[s.upgLevel, maxed && { color: G }]}>
                  {upg.getLabel(upgrades)}
                </Text>
              </View>
              <TouchableOpacity
                style={[s.buyBtn, !buyable && s.buyBtnOff]}
                onPress={buyable ? () => onBuy(upg.id) : undefined}
                disabled={!buyable}
                activeOpacity={0.8}
              >
                <Text style={[s.buyText, maxed && s.buyTextMaxed]}>
                  {maxed ? 'MAX' : `${upg.cost}💎`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={s.btnRow}>
        {onBack != null && (
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={s.backText}>← Loadout</Text>
          </TouchableOpacity>
        )}
        {onMainMenu != null && (
          <TouchableOpacity style={s.backBtn} onPress={onMainMenu} activeOpacity={0.8}>
            <Text style={s.backText}>⌂ Main Menu</Text>
          </TouchableOpacity>
        )}
        {onContinue != null && (
          <TouchableOpacity style={s.continueBtn} onPress={onContinue} activeOpacity={0.8}>
            <Text style={s.continueText}>Begin Run →</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A14',
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },

  title: {
    color: G,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 3,
    textAlign: 'center',
  },
  subtitle: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  runesBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(226,176,74,0.12)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: G,
    paddingHorizontal: 22,
    paddingVertical: 8,
    marginBottom: 16,
  },
  runesText: {
    color: G,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  scroll: { flex: 1 },
  list:   { gap: 8, paddingBottom: 8 },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(15,52,96,0.4)',
    borderWidth:     1.5,
    borderColor:     '#1A2A4A',
    borderRadius:    12,
    padding:         12,
    gap:             10,
  },
  rowMaxed: {
    borderColor:     'rgba(226,176,74,0.3)',
    backgroundColor: 'rgba(226,176,74,0.05)',
  },

  upgIcon: { fontSize: 26, width: 32, textAlign: 'center' },

  upgInfo: { flex: 1, gap: 2 },
  upgName: {
    color:      '#EFEFEF',
    fontSize:   13,
    fontWeight: 'bold',
  },
  upgDesc: {
    color:      '#666',
    fontSize:   10,
    lineHeight: 14,
  },
  upgLevel: {
    color:      '#777',
    fontSize:   10,
    fontWeight: 'bold',
    marginTop:  2,
  },

  buyBtn: {
    backgroundColor: '#7B2FBE',
    borderRadius:    8,
    paddingHorizontal: 12,
    paddingVertical:   8,
    minWidth:          60,
    alignItems:        'center',
  },
  buyBtnOff: {
    backgroundColor: '#111',
    opacity: 0.45,
  },
  buyText: {
    color:      '#EFEFEF',
    fontSize:   12,
    fontWeight: 'bold',
  },
  buyTextMaxed: {
    color: '#444',
  },

  btnRow: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     16,
  },

  backBtn: {
    flex:             1,
    borderWidth:      1,
    borderColor:      G,
    borderRadius:     12,
    paddingVertical:  14,
    alignItems:       'center',
  },
  backText: {
    color:       G,
    fontSize:    14,
    fontWeight:  'bold',
    letterSpacing: 1,
  },

  continueBtn: {
    flex:             2,
    backgroundColor: '#7B2FBE',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     G,
  },
  continueText: {
    color:        '#EFEFEF',
    fontSize:     16,
    fontWeight:   'bold',
    letterSpacing: 1.5,
  },
});
