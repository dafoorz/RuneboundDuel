import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { RARITY_COLOR } from './DiceTypes';

const DEFAULT_CARD_LIMIT = 6;
const DEFAULT_DICE_LIMIT = 3;
const G = '#E2B04A';

function rarityColor(rarity) {
  return RARITY_COLOR[rarity] || '#3A3A5A';
}

// ─── Card row ─────────────────────────────────────────────────────────────────

function CardItem({ card, selected, onTap, slotsLeft }) {
  const disabled = !selected && slotsLeft === 0;
  return (
    <TouchableOpacity
      style={[
        s.item,
        { borderColor: selected ? G : rarityColor(card.rarity) },
        selected && s.itemSelected,
        disabled && s.itemDisabled,
      ]}
      onPress={disabled ? undefined : onTap}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Text style={s.itemIcon}>{card.icon}</Text>
      <View style={s.itemInfo}>
        <Text style={s.itemName}>{card.name}</Text>
        <Text style={s.itemDesc} numberOfLines={1}>{card.desc}</Text>
        <Text style={[s.itemRarity, { color: rarityColor(card.rarity) }]}>{card.rarity}</Text>
      </View>
      {selected && (
        <View style={s.checkBadge}>
          <Text style={s.checkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Die row ──────────────────────────────────────────────────────────────────

function DieItem({ die, selected, onTap, slotsLeft }) {
  const disabled = !selected && slotsLeft === 0;
  return (
    <TouchableOpacity
      style={[
        s.item,
        { borderColor: selected ? G : rarityColor(die.rarity) },
        selected && s.itemSelected,
        disabled && s.itemDisabled,
      ]}
      onPress={disabled ? undefined : onTap}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Text style={s.itemIcon}>{die.icon}</Text>
      <View style={s.itemInfo}>
        <Text style={s.itemName}>{die.name}</Text>
        <Text style={s.itemDesc} numberOfLines={1}>{die.desc}</Text>
        <Text style={[s.itemRarity, { color: rarityColor(die.rarity) }]}>{die.rarity}</Text>
      </View>
      {selected && (
        <View style={s.checkBadge}>
          <Text style={s.checkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EquipScreen({
  cardCollection,
  defaultCards,
  diceCollection,
  defaultDice,
  onReady,
  cardLimit = DEFAULT_CARD_LIMIT,
  diceLimit = DEFAULT_DICE_LIMIT,
  runes = 0,
  onShrine,
  readyLabel = 'READY →',
}) {
  const [selectedCardIds, setSelectedCardIds] = useState(() => {
    if (defaultCards && defaultCards.length > 0) return defaultCards.slice(0, cardLimit);
    return cardCollection.slice(0, Math.min(cardLimit, cardCollection.length)).map(c => c.instanceId);
  });

  const [selectedDiceIds, setSelectedDiceIds] = useState(() => {
    if (defaultDice && defaultDice.length > 0) return defaultDice.slice(0, diceLimit);
    return diceCollection.slice(0, Math.min(diceLimit, diceCollection.length)).map(d => d.instanceId);
  });

  // Auto-fill dice selection up to diceLimit on mount
  React.useEffect(() => {
    setSelectedDiceIds(prev => {
      const validIds = prev.filter(id => diceCollection.some(d => d.instanceId === id));
      if (validIds.length < diceLimit && diceCollection.length > 0) {
        const currentSelected = new Set(validIds);
        const available = diceCollection.filter(d => !currentSelected.has(d.instanceId));
        const toAdd = available.slice(0, diceLimit - validIds.length);
        return [...validIds, ...toAdd.map(d => d.instanceId)];
      }
      return validIds;
    });
  }, [diceCollection, diceLimit]);

  function toggleCard(card) {
    if (selectedCardIds.includes(card.instanceId)) {
      setSelectedCardIds(prev => prev.filter(id => id !== card.instanceId));
    } else if (selectedCardIds.length < cardLimit) {
      setSelectedCardIds(prev => [...prev, card.instanceId]);
    }
  }

  function toggleDie(die) {
    if (selectedDiceIds.includes(die.instanceId)) {
      if (selectedDiceIds.length > 1) {
        setSelectedDiceIds(prev => prev.filter(id => id !== die.instanceId));
      }
    } else if (selectedDiceIds.length < diceLimit) {
      setSelectedDiceIds(prev => [...prev, die.instanceId]);
    }
  }

  function handleReady() {
    const equippedDice = selectedDiceIds
      .map(id => diceCollection.find(d => d.instanceId === id))
      .filter(Boolean);
    if (equippedDice.length === diceLimit && selectedCardIds.length > 0) {
      onReady(selectedCardIds, equippedDice);
    }
  }

  const cardSlotsLeft = cardLimit - selectedCardIds.length;
  const diceSlotsLeft = diceLimit - selectedDiceIds.length;
  const diceReady     = selectedDiceIds.length === diceLimit;
  const cardsReady    = selectedCardIds.length > 0;
  const ready         = diceReady && cardsReady;

  function getReadyLabel() {
    if (!diceReady)  return `Pick ${diceLimit - selectedDiceIds.length} more ${diceLimit - selectedDiceIds.length === 1 ? 'die' : 'dice'}`;
    if (!cardsReady) return 'Pick at least 1 card';
    return readyLabel;
  }

  return (
    <View style={s.root}>

      {/* ── Title ── */}
      <View style={s.titleRow}>
        <Text style={s.title}>⚔  LOADOUT</Text>
        {onShrine && (
          <TouchableOpacity style={s.shrineBtn} onPress={onShrine} activeOpacity={0.8}>
            <Text style={s.shrineBtnText}>🏛️ {runes}💎</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.subtitle}>Choose your cards and dice for battle</Text>

      {/* ── Two-column layout ── */}
      <View style={s.columns}>
        {/* LEFT: Cards */}
        <View style={s.column}>
          <View style={s.colHeader}>
            <Text style={s.colTitle}>CARDS</Text>
            <View style={s.colPill}>
              <Text style={s.colCount}>{selectedCardIds.length} / {cardLimit}</Text>
            </View>
          </View>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {cardCollection.map(card => (
              <CardItem
                key={card.instanceId}
                card={card}
                selected={selectedCardIds.includes(card.instanceId)}
                onTap={() => toggleCard(card)}
                slotsLeft={cardSlotsLeft}
              />
            ))}
          </ScrollView>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* RIGHT: Dice */}
        <View style={s.column}>
          <View style={s.colHeader}>
            <Text style={s.colTitle}>DICE</Text>
            <View style={[s.colPill, !diceReady && s.colPillWarn]}>
              <Text style={s.colCount}>{selectedDiceIds.length} / {diceLimit}</Text>
            </View>
          </View>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {diceCollection.map(die => (
              <DieItem
                key={die.instanceId}
                die={die}
                selected={selectedDiceIds.includes(die.instanceId)}
                onTap={() => toggleDie(die)}
                slotsLeft={diceSlotsLeft}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ── READY button ── */}
      <TouchableOpacity
        style={[s.readyBtn, !ready && s.readyBtnOff]}
        onPress={handleReady}
        disabled={!ready}
        activeOpacity={0.8}
      >
        <Text style={s.readyBtnText}>{getReadyLabel()}</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A14',
    paddingTop: 44,
    paddingBottom: 28,
    paddingHorizontal: 10,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  shrineBtn: {
    backgroundColor: 'rgba(226,176,74,0.12)', borderWidth: 1, borderColor: G,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  shrineBtnText: { color: G, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  title: { color: G, fontSize: 22, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center' },
  subtitle: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 14, letterSpacing: 0.5 },

  // Two-column layout
  columns: { flex: 1, flexDirection: 'row', gap: 0 },
  column: { flex: 1 },
  divider: { width: 1, backgroundColor: 'rgba(226,176,74,0.2)', marginHorizontal: 6 },

  colHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,176,74,0.15)', marginBottom: 6,
  },
  colTitle: { color: G, fontSize: 11, fontWeight: 'bold', letterSpacing: 2 },
  colPill: { backgroundColor: 'rgba(226,176,74,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  colPillWarn: { backgroundColor: 'rgba(192,57,43,0.2)' },
  colCount: { color: G, fontSize: 10, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { gap: 6, paddingBottom: 10 },

  // Row items
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,52,96,0.4)', borderWidth: 1.5, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 8, gap: 8, minHeight: 58,
  },
  itemSelected: { backgroundColor: 'rgba(226,176,74,0.1)' },
  itemDisabled: { opacity: 0.3 },
  itemIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { color: '#EFEFEF', fontSize: 11, fontWeight: 'bold' },
  itemDesc: { color: '#888', fontSize: 9, lineHeight: 12 },
  itemRarity: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  checkBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: G, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkText: { color: '#000', fontSize: 11, fontWeight: 'bold' },

  // READY button
  readyBtn: {
    backgroundColor: '#7B2FBE', marginTop: 14, paddingVertical: 15,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: G,
  },
  readyBtnOff: { opacity: 0.35, borderColor: 'transparent' },
  readyBtnText: { color: '#EFEFEF', fontSize: 15, fontWeight: 'bold', letterSpacing: 1.5 },
});
