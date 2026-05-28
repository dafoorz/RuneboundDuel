import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const C = {
  bg:      '#1A1A2E',
  surface: '#16213E',
  gold:    '#E2B04A',
  orange:  '#FF8C00',
  red:     '#C0392B',
  text:    '#EFEFEF',
  muted:   '#777',
  blue:    '#5BC8E8',
  purple:  '#7B2FBE',
};

export const BUFF_DEFS = [
  // ── 1 Soul ─────────────────────────────────────────────────────────────────
  { id: 'vitality',      icon: '❤️',  name: 'Vitality',       cost: 1, tier: 'regular', desc: '+20 max HP' },
  { id: 'sharpness',     icon: '⚔️',  name: 'Sharpness',      cost: 1, tier: 'regular', desc: '+10% damage' },
  { id: 'luckyRolls',    icon: '🎲',  name: 'Lucky Rolls',    cost: 1, tier: 'regular', desc: 'Roll one extra time each turn' },
  { id: 'cardDraw',      icon: '🃏',  name: 'Card Draw',      cost: 1, tier: 'regular', desc: 'Draw 1 extra card at combat start' },
  { id: 'swift',         icon: '💨',  name: 'Swift',          cost: 1, tier: 'regular', desc: 'Enemy intention always visible' },
  { id: 'regeneration',  icon: '🌿',  name: 'Regeneration',   cost: 1, tier: 'regular', desc: 'Heal 3 HP at start of each turn' },
  // ── 2 Souls ────────────────────────────────────────────────────────────────
  { id: 'critMastery',   icon: '💥',  name: 'Crit Mastery',   cost: 2, tier: 'regular', desc: '+15% damage & Titan crits deal 3×' },
  { id: 'ironSkin',      icon: '🛡️',  name: 'Iron Skin',      cost: 2, tier: 'regular', desc: 'Take 10% less damage from all sources' },
  { id: 'precision',     icon: '🎯',  name: 'Precision',      cost: 2, tier: 'regular', desc: 'Cards needing specific dice accept 1 lower' },
  { id: 'soulFinder',    icon: '💰',  name: 'Soul Finder',    cost: 2, tier: 'regular', desc: 'Earn 1 extra Boss Soul from every boss kill' },
  { id: 'mysticHand',    icon: '🔮',  name: 'Mystic Hand',    cost: 2, tier: 'regular', desc: 'Hand size increased by 1 card' },
  { id: 'chainReaction', icon: '⚡',  name: 'Chain Reaction', cost: 2, tier: 'regular', desc: 'Killing blow: overflow damage becomes bonus runes' },
  // ── 3 Souls ────────────────────────────────────────────────────────────────
  { id: 'warCrown',      icon: '👑',  name: 'War Crown',      cost: 3, tier: 'strong',  desc: '+30% damage, +20 max HP' },
  { id: 'divineGrace',   icon: '🌟',  name: 'Divine Luck',    cost: 3, tier: 'strong',  desc: 'Once per combat reroll ALL dice for free' },
  { id: 'lifebond',      icon: '🩸',  name: 'Lifebond',       cost: 3, tier: 'strong',  desc: 'Heal 10% of all damage dealt' },
  { id: 'titanStrength', icon: '🔱',  name: 'Titan Strength', cost: 3, tier: 'strong',  desc: 'Every 3rd attack automatically crits' },
  { id: 'magicShield',   icon: '🧿',  name: 'Magic Shield',   cost: 3, tier: 'strong',  desc: 'Start every combat with 15 shield' },
  { id: 'starBlessed',   icon: '⭐',  name: 'Star Blessed',   cost: 3, tier: 'strong',  desc: 'Legendary dice always 6, epic dice always 5+' },
  // ── 4 Souls (Cursed) ───────────────────────────────────────────────────────
  { id: 'deathPact',     icon: '☠️',  name: 'Death Pact',     cost: 4, tier: 'cursed',  desc: '+50% damage, cannot heal for rest of run', cursed: true },
  { id: 'glassCanon',    icon: '☠️',  name: 'Glass Cannon',   cost: 4, tier: 'cursed',  desc: '3× damage but die in one hit from any enemy crit', cursed: true },
  { id: 'bloodFrenzy',   icon: '☠️',  name: 'Blood Frenzy',   cost: 4, tier: 'cursed',  desc: '+40% damage, lose 8 HP every enemy turn', cursed: true },
  { id: 'chaosEmbrace',  icon: '☠️',  name: 'Chaos Embrace',  cost: 4, tier: 'cursed',  desc: 'All dice roll 1, 3 or 6 only — +35% damage', cursed: true },
  { id: 'soulHarvest',   icon: '☠️',  name: 'Soul Harvest',   cost: 4, tier: 'cursed',  desc: 'Heal 20 HP on every kill, max HP reduced by 40', cursed: true },
  { id: 'berserkerOath', icon: '☠️',  name: 'Berserker Oath', cost: 4, tier: 'cursed',  desc: '+60% dmg below 30% HP, −30% dmg above 30% HP', cursed: true },
];

// ── Main Shop Screen ─────────────────────────────────────────────────────────

export default function BuffShopScreen({ bossSouls, activeBuffs, purchasedBuffIds = [], onBuy, onClose }) {
  return (
    <View style={s.container}>
      <Text style={s.title}>💠 Buff Shop</Text>
      <View style={s.statsRow}>
        <Text style={s.soulsText}>💠 {bossSouls} Boss Souls</Text>
        <Text style={s.slotsText}>Slots: {activeBuffs.length}/3</Text>
      </View>

      {activeBuffs.length > 0 && (
        <View style={s.activeRow}>
          {activeBuffs.map(b => (
            <View key={b.id} style={[s.activeBuff, { borderColor: b.cursed ? C.red : b.cost === 3 ? C.orange : C.gold }]}>
              <Text style={s.activeBuffIcon}>{b.cursed ? '☠️' : b.icon}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {BUFF_DEFS.map(buff => {
          const alreadyBought = purchasedBuffIds.includes(buff.id);
          const canAfford = bossSouls >= buff.cost && !alreadyBought;
          const borderColor = buff.cursed ? C.red : buff.cost === 3 ? C.orange : C.gold;
          return (
            <TouchableOpacity
              key={buff.id}
              style={[s.buffCard, { borderColor }, (!canAfford || alreadyBought) && s.buffDisabled]}
              onPress={() => canAfford && onBuy(buff)}
              activeOpacity={canAfford ? 0.75 : 1}
              disabled={!canAfford}
            >
              <View style={s.buffRow}>
                <Text style={s.buffIcon}>{buff.cursed ? '☠️' : buff.icon}</Text>
                <View style={s.buffInfo}>
                  <Text style={s.buffName}>{buff.name}</Text>
                  <Text style={s.buffDesc}>{buff.desc}</Text>
                </View>
                {alreadyBought
                  ? <Text style={[s.buffCost, { color: '#27AE60' }]}>✓</Text>
                  : <Text style={[s.buffCost, { color: canAfford ? C.gold : C.muted }]}>💠{buff.cost}</Text>
                }
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={s.closeBtnText}>CLOSE SHOP</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Drop Buff Screen ──────────────────────────────────────────────────────────

export function DropBuffScreen({ activeBuffs, pendingBuff, onDrop }) {
  return (
    <View style={s.container}>
      <Text style={s.title}>⚠️ Buff Slots Full</Text>
      <Text style={s.dropSubtitle}>Drop a buff to make room for:</Text>
      <View style={[s.pendingBox, { borderColor: pendingBuff.cursed ? C.red : pendingBuff.cost === 3 ? C.orange : C.gold }]}>
        <Text style={s.buffIcon}>{pendingBuff.cursed ? '☠️' : pendingBuff.icon}</Text>
        <View style={s.buffInfo}>
          <Text style={s.buffName}>{pendingBuff.name}</Text>
          <Text style={s.buffDesc}>{pendingBuff.desc}</Text>
        </View>
      </View>
      <Text style={s.dropHint}>Tap a buff to remove it permanently:</Text>
      {activeBuffs.map(buff => {
        const borderColor = buff.cursed ? C.red : buff.cost === 3 ? C.orange : C.gold;
        return (
          <TouchableOpacity
            key={buff.id}
            style={[s.buffCard, { borderColor }]}
            onPress={() => onDrop(buff.id)}
            activeOpacity={0.75}
          >
            <View style={s.buffRow}>
              <Text style={s.buffIcon}>{buff.cursed ? '☠️' : buff.icon}</Text>
              <View style={s.buffInfo}>
                <Text style={s.buffName}>{buff.name}</Text>
                <Text style={s.buffDesc}>{buff.desc}</Text>
              </View>
              <Text style={s.dropX}>✕</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 18,
    paddingTop: 44,
  },
  title: {
    color: C.gold,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  soulsText: {
    color: C.blue,
    fontSize: 18,
    fontWeight: 'bold',
  },
  slotsText: {
    color: C.muted,
    fontSize: 14,
  },
  activeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'center',
  },
  activeBuff: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBuffIcon: {
    fontSize: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 9,
    paddingBottom: 8,
  },
  buffCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
  },
  buffDisabled: {
    opacity: 0.38,
  },
  buffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buffIcon: {
    fontSize: 26,
    width: 32,
    textAlign: 'center',
  },
  buffInfo: {
    flex: 1,
  },
  buffName: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  buffDesc: {
    color: C.muted,
    fontSize: 11,
    marginTop: 2,
  },
  buffCost: {
    fontSize: 15,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
  },
  closeBtn: {
    backgroundColor: C.purple,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: {
    color: C.text,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  dropSubtitle: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 14,
  },
  dropHint: {
    color: C.red,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  dropX: {
    color: C.red,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
