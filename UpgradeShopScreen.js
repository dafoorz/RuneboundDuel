import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { RARITY_COLOR } from './DiceTypes';
import { getBaseCardId } from './CardUpgrades';

const G = '#E2B04A';

function rarityColor(rarity) {
  return RARITY_COLOR[rarity] || '#3A3A5A';
}

const TIER_ICON = { common: '⬜', rare: '🔵', epic: '🟣', legendary: '🟡' };

// ─── Single card row ──────────────────────────────────────────────────────────

function UpgradeRow({ card, runes, upgradeNext, upgradeCost, upgradeTierLabel, upgradeCardMap, onUpgrade }) {
  const nextId    = upgradeNext[card.id];
  const isMax     = !nextId;
  const cost      = !isMax ? (upgradeCost[card.id] || 0) : 0;
  const canAfford = !isMax && runes >= cost;
  const tierLabel = upgradeTierLabel[card.id] || card.rarity || 'common';
  const nextCard  = nextId ? upgradeCardMap[nextId] : null;
  const nextTier  = nextId ? (upgradeTierLabel[nextId] || nextCard?.rarity || '') : '';

  return (
    <View style={[s.row, { borderColor: rarityColor(card.rarity) }]}>
      <Text style={s.rowIcon}>{card.icon}</Text>
      <View style={s.rowInfo}>
        <Text style={s.rowName}>{card.name}</Text>
        <Text style={s.rowDesc} numberOfLines={1}>{card.desc}</Text>
        <Text style={[s.rowTier, { color: rarityColor(card.rarity) }]}>
          {TIER_ICON[tierLabel?.toLowerCase()] || '⬜'} {tierLabel}
        </Text>
      </View>
      {isMax ? (
        <View style={s.maxBadge}>
          <Text style={s.maxText}>MAX</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.upgradeBtn, !canAfford && s.upgradeBtnOff]}
          onPress={() => canAfford && onUpgrade()}
          disabled={!canAfford}
          activeOpacity={0.8}
        >
          <Text style={[s.upgradeCost, !canAfford && s.dimText]}>💎 {cost}</Text>
          <Text style={[s.upgradeNextTier, !canAfford && s.dimText]}>→ {nextTier}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

function ConfirmModal({ card, nextCard, cost, runes, onConfirm, onCancel }) {
  const canAfford = runes >= cost;
  return (
    <View style={s.modalOverlay}>
      <View style={s.modalBox}>
        <Text style={s.modalTitle}>⬆ UPGRADE PREVIEW</Text>

        <View style={s.modalCards}>
          {/* Current */}
          <View style={[s.modalCard, { borderColor: rarityColor(card.rarity) }]}>
            <Text style={s.modalCardLabel}>CURRENT</Text>
            <Text style={s.modalCardIcon}>{card.icon}</Text>
            <Text style={s.modalCardName}>{card.name}</Text>
            <Text style={[s.modalCardRarity, { color: rarityColor(card.rarity) }]}>{card.rarity}</Text>
            <Text style={s.modalCardDesc}>{card.desc}</Text>
            <Text style={s.modalCardReq}>{card.req}</Text>
          </View>

          <Text style={s.modalArrow}>→</Text>

          {/* Upgraded */}
          <View style={[s.modalCard, s.modalCardNew, { borderColor: rarityColor(nextCard.rarity) }]}>
            <Text style={s.modalCardLabel}>UPGRADED</Text>
            <Text style={s.modalCardIcon}>{nextCard.icon}</Text>
            <Text style={[s.modalCardName, { color: '#AAFFAA' }]}>{nextCard.name}</Text>
            <Text style={[s.modalCardRarity, { color: rarityColor(nextCard.rarity) }]}>{nextCard.rarity}</Text>
            <Text style={[s.modalCardDesc, { color: '#AAFFAA' }]}>{nextCard.desc}</Text>
            <Text style={[s.modalCardReq, { color: '#AAFFAA' }]}>{nextCard.req}</Text>
          </View>
        </View>

        <Text style={s.modalCost}>Cost: 💎 {cost}</Text>
        {!canAfford && <Text style={s.modalCantAfford}>Not enough runes!</Text>}

        <View style={s.modalBtns}>
          <TouchableOpacity style={s.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={s.modalCancelText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modalConfirmBtn, !canAfford && { opacity: 0.35 }]}
            onPress={() => canAfford && onConfirm()}
            disabled={!canAfford}
            activeOpacity={0.85}
          >
            <Text style={s.modalConfirmText}>CONFIRM ⬆</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function UpgradeShopScreen({
  cardCollection,
  runes,
  upgradeNext,
  upgradeCost,
  upgradeTierLabel,
  upgradeCardMap,
  onUpgrade,
  onContinue,
}) {
  const [preview, setPreview] = useState(null); // { card, nextCard, cost }

  // Deduplicate by base card ID — one row per card type
  const seen = new Set();
  const uniqueCards = [];
  for (const card of cardCollection) {
    const base = getBaseCardId(card.id);
    if (!seen.has(base)) {
      seen.add(base);
      uniqueCards.push(card);
    }
  }

  function openPreview(card) {
    const nextId = upgradeNext[card.id];
    if (!nextId) return;
    const nextCard = upgradeCardMap[nextId];
    if (!nextCard) return;
    const cost = upgradeCost[card.id] || 0;
    setPreview({ card, nextCard: { ...nextCard }, cost });
  }

  function confirmUpgrade() {
    if (!preview) return;
    const baseId = getBaseCardId(preview.card.id);
    onUpgrade(baseId, preview.card.id, preview.nextCard.id, preview.cost);
    setPreview(null);
  }

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>⚗️ UPGRADE SHOP</Text>
        <Text style={s.subtitle}>Upgrades last for this run only</Text>
      </View>

      {/* ── Runes display ── */}
      <View style={s.runesRow}>
        <Text style={s.runesLabel}>YOUR RUNES</Text>
        <Text style={s.runesValue}>💎 {runes}</Text>
      </View>

      {/* ── Card list ── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {uniqueCards.map(card => (
          <UpgradeRow
            key={card.instanceId}
            card={card}
            runes={runes}
            upgradeNext={upgradeNext}
            upgradeCost={upgradeCost}
            upgradeTierLabel={upgradeTierLabel}
            upgradeCardMap={upgradeCardMap}
            onUpgrade={() => openPreview(card)}
          />
        ))}
      </ScrollView>

      {/* ── Continue button ── */}
      <TouchableOpacity style={s.continueBtn} onPress={onContinue} activeOpacity={0.8}>
        <Text style={s.continueBtnText}>CONTINUE →</Text>
      </TouchableOpacity>

      {/* ── Preview modal ── */}
      {preview && (
        <ConfirmModal
          card={preview.card}
          nextCard={preview.nextCard}
          cost={preview.cost}
          runes={runes}
          onConfirm={confirmUpgrade}
          onCancel={() => setPreview(null)}
        />
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A14',
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },

  header: { alignItems: 'center', marginBottom: 16 },
  title: { color: G, fontSize: 24, fontWeight: 'bold', letterSpacing: 3 },
  subtitle: { color: '#555', fontSize: 11, marginTop: 4, letterSpacing: 0.5 },

  runesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(226,176,74,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226,176,74,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
  },
  runesLabel: { color: '#777', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  runesValue: { color: G, fontSize: 22, fontWeight: 'bold' },

  scroll: { flex: 1 },
  scrollContent: { gap: 8, paddingBottom: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,52,96,0.4)',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowIcon: { fontSize: 26, width: 32, textAlign: 'center' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: '#EFEFEF', fontSize: 13, fontWeight: 'bold' },
  rowDesc: { color: '#888', fontSize: 9, lineHeight: 13 },
  rowTier: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 2 },

  maxBadge: {
    backgroundColor: 'rgba(226,176,74,0.18)', borderRadius: 6, borderWidth: 1,
    borderColor: G, paddingHorizontal: 10, paddingVertical: 5,
  },
  maxText: { color: G, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

  upgradeBtn: {
    backgroundColor: 'rgba(226,176,74,0.12)', borderRadius: 8, borderWidth: 1.5,
    borderColor: G, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 68,
  },
  upgradeBtnOff: { borderColor: '#333', backgroundColor: 'transparent' },
  upgradeCost: { color: G, fontSize: 12, fontWeight: 'bold' },
  upgradeNextTier: { color: '#AAAAAA', fontSize: 9, marginTop: 2, letterSpacing: 0.3 },
  dimText: { color: '#555' },

  continueBtn: {
    backgroundColor: '#7B2FBE',
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G,
  },
  continueBtnText: { color: '#EFEFEF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1.5 },

  // ── Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#16213E',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: G,
    padding: 18,
    gap: 14,
    alignItems: 'center',
  },
  modalTitle: { color: G, fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  modalCards: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  modalCard: {
    flex: 1, backgroundColor: 'rgba(15,52,96,0.5)', borderRadius: 10, borderWidth: 1.5,
    padding: 10, gap: 3, alignItems: 'center',
  },
  modalCardNew: { backgroundColor: 'rgba(0,60,30,0.5)' },
  modalCardLabel: { color: '#555', fontSize: 8, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  modalCardIcon: { fontSize: 28 },
  modalCardName: { color: '#EFEFEF', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  modalCardRarity: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalCardDesc: { color: '#AAAAAA', fontSize: 9, textAlign: 'center', lineHeight: 13, marginTop: 2 },
  modalCardReq: { color: '#666', fontSize: 8, textAlign: 'center', fontStyle: 'italic', marginTop: 1 },
  modalArrow: { color: G, fontSize: 22, fontWeight: 'bold' },
  modalCost: { color: G, fontSize: 16, fontWeight: 'bold' },
  modalCantAfford: { color: '#C0392B', fontSize: 12, fontStyle: 'italic' },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: {
    flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555',
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  modalCancelText: { color: '#777', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  modalConfirmBtn: {
    flex: 2, backgroundColor: 'rgba(226,176,74,0.18)', borderWidth: 2, borderColor: G,
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  modalConfirmText: { color: G, fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
});
