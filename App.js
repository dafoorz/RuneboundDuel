import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  AppState,
  StatusBar as RNStatusBar,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { StatusBar, setStatusBarHidden } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import StoryScreen from './StoryScreen';
import CardReward  from './CardReward';
import EquipScreen from './EquipScreen';
import LevelStartScreen    from './LevelStartScreen';
import LevelCompleteScreen from './LevelCompleteScreen';
import BribeScreen, { getBribeChance, getMinBribeAmount } from './BribeScreen';
import BuffShopScreen, { DropBuffScreen, BUFF_DEFS } from './BuffShopScreen';
import UpgradeShopScreen from './UpgradeShopScreen';
import {
  NEW_BASE_CARDS, UPGRADE_CARDS, UPGRADE_CARDS_BY_ID,
  CARD_BASE_ID, UPGRADE_NEXT, UPGRADE_COST, UPGRADE_TIER_LABEL,
  getBaseCardId, getUpgradePreview,
} from './CardUpgrades';
import { rollDie, getDamageMultiplier, DICE_TYPES, EPIC_DICE, RARE_DICE, RARITY_COLOR } from './DiceTypes';
import ShrineScreen from './ShrineScreen';

// ─── Constants ─────────────────────────────────────────────────────────── v2 ─

const C = {
  bg:      '#1A1A2E',
  surface: '#16213E',
  primary: '#0F3460',
  gold:    '#E2B04A',
  purple:  '#7B2FBE',
  red:     '#C0392B',
  green:   '#27AE60',
  blue:    '#5BC8E8',
  text:    '#EFEFEF',
  muted:   '#777',
};

const PLAYER_MAX_HP = 100;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
// Scale characters relative to 1920px baseline so they look the same on every screen size
const CHAR_SCALE = Math.min(2.5, Math.max(0.5, SCREEN_W / 1920));

// ── Minion GIF sources per level / type ──────────────────────────────────────
const MINION_GIFS = {
  1: {
    Wraith1: {
      idle:      require('./Minions_Gif/Minions_Level1/Wraith1/Wraith1_Idle.gif'),
      attacking: require('./Minions_Gif/Minions_Level1/Wraith1/Wraith1_Attacking.gif'),
      hurt:      require('./Minions_Gif/Minions_Level1/Wraith1/Wraith1_Hurt.gif'),
      dying:     require('./Minions_Gif/Minions_Level1/Wraith1/Wraith1_Dying.gif'),
    },
    Wraith2: {
      idle:      require('./Minions_Gif/Minions_Level1/Wraith2/Wraith2_Idle.gif'),
      attacking: require('./Minions_Gif/Minions_Level1/Wraith2/Wraith2_Attacking.gif'),
      hurt:      require('./Minions_Gif/Minions_Level1/Wraith2/Wraith2_Hurt.gif'),
      dying:     require('./Minions_Gif/Minions_Level1/Wraith2/Wraith2_Dying.gif'),
    },
    Wraith3: {
      idle:      require('./Minions_Gif/Minions_Level1/Wraith3/Wraith3_Idle.gif'),
      attacking: require('./Minions_Gif/Minions_Level1/Wraith3/Wraith3_Attacking.gif'),
      hurt:      require('./Minions_Gif/Minions_Level1/Wraith3/Wraith3_Hurt.gif'),
      dying:     require('./Minions_Gif/Minions_Level1/Wraith3/Wraith3_Dying.gif'),
    },
  },
};
const MINION_TYPES_BY_LEVEL = {
  1: ['Wraith1', 'Wraith2', 'Wraith3'],
};
function pickMinionType(level) {
  const types = MINION_TYPES_BY_LEVEL[level];
  if (!types) return null;
  return types[Math.floor(Math.random() * types.length)];
}

// ── Player GIF sources (static requires so Metro can bundle them) ─────────────
const PLAYER_GIFS = {
  idle:      require('./player_character_Gif/Player_Character_Idle.gif'),
  attacking: require('./player_character_Gif/Player_Character_Attacking.gif'),
  hurt:      require('./player_character_Gif/Player_Character_Hurt.gif'),
  dying:     require('./player_character_Gif/Player_Character_Dying.gif'),
};
const ENEMY_MAX_HP  = 80;
const ENEMY_NAME    = 'Shadow Wraith';
const ENEMY_ATTACK  = 10;
const MAX_ROLLS     = 3;

const rnd6 = () => Math.floor(Math.random() * 6) + 1;

// ─── Die instance factory ─────────────────────────────────────────────────────

let _nextDieId = 0;
function makeInstance(dieType) {
  return { ...dieType, instanceId: `die_${_nextDieId++}` };
}

// ─── Card instance factory ────────────────────────────────────────────────────

let _nextCardInstId = 0;
function makeCardInstance(cardInfo) {
  return { ...cardInfo, instanceId: `card_${_nextCardInstId++}` };
}

const STANDARD_DIE = DICE_TYPES.find(d => d.id === 'standard');

function initialCollection() {
  return [
    makeInstance(STANDARD_DIE),
    makeInstance(STANDARD_DIE),
    makeInstance(STANDARD_DIE),
  ];
}

// ─── Encounter type determination ─────────────────────────────────────────────

function getEncounterType(combatNum) {
  const numInLayer = ((combatNum - 1) % 10) + 1;
  if (numInLayer === 5) return 'miniBoss';
  if (numInLayer === 10) return 'boss';
  return 'regular';
}

function randInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MULTI_ENEMY_ICONS = ['👾', '🐺', '🦇', '🧟', '🕷️', '🦂', '🐍', '🐲'];

function distributeAmong(total, n, minVal) {
  const guarantee = n * minVal;
  const extra = Math.max(0, total - guarantee);
  const result = Array(n).fill(minVal);
  for (let i = 0; i < extra; i++) {
    result[Math.floor(Math.random() * n)]++;
  }
  return result;
}

function getScaledEnemyStats(encounterType, combatNum, level) {
  // Cross-level multiplier applies to regular enemies only
  const mult = encounterType === 'regular' ? 1 + (level - 1) * 0.15 : 1;
  let baseHpMin, baseHpMax, baseAtkMin, baseAtkMax, baseShdMin, baseShdMax;
  if (encounterType === 'miniBoss') {
    baseHpMin  = 100 + level * 30;  baseHpMax  = 150 + level * 50;
    baseAtkMin =  10 + level *  5;  baseAtkMax =  22 + level *  8;
    baseShdMin =  10 + level *  3;  baseShdMax =  20 + level *  5;
  } else if (encounterType === 'boss') {
    baseHpMin  = 180 + level *  60; baseHpMax  = 200 + level * 100;
    baseAtkMin =  10 + level *   8; baseAtkMax =  20 + level *  12;
    baseShdMin =  15 + level *   5; baseShdMax =  30 + level *   8;
  } else {
    baseHpMin  =  40 + combatNum * 10; baseHpMax  =  60 + combatNum * 10;
    baseAtkMin =   5 + combatNum *  2; baseAtkMax =  10 + combatNum *  3;
    baseShdMin =   5 + combatNum;      baseShdMax =   8 + combatNum *  3;
  }
  const atkMin = Math.round(baseAtkMin * mult);
  const atkMax = Math.round(baseAtkMax * mult);
  const shdMin = Math.round(baseShdMin * mult);
  const shdMax = Math.round(baseShdMax * mult);
  const maxHp  = Math.round(randInRange(baseHpMin, baseHpMax) * mult);
  const damage = randInRange(atkMin, atkMax);
  return { maxHp, damage, attackRange: [atkMin, atkMax], shieldRange: [shdMin, shdMax] };
}

// ─── Boss/Mini boss abilities ──────────────────────────────────────────────────

const MINIBOSS_ABILITIES = [
  { id: 'lock', name: 'Lock', icon: '🔒', desc: 'Locks a random card' },
  { id: 'curse', name: 'Curse', icon: '🎲', desc: 'Forces a die to reroll' },
  { id: 'shield', name: 'Shield', icon: '🛡️', desc: 'Blocks all damage this turn' },
  { id: 'rage', name: 'Rage', icon: '💥', desc: 'Doubles damage for 2 turns' },
];

const BOSS_ABILITIES = [
  { id: 'voidCurse', name: 'Void Curse', icon: '🌀', desc: 'All dice roll minimum next turn' },
  { id: 'deathMark', name: 'Death Mark', icon: '💀', desc: 'Deal 20+ dmg or lose 30 HP' },
  { id: 'mirror', name: 'Mirror', icon: '🔄', desc: 'Reflects 50% damage' },
  { id: 'chainLightning', name: 'Chain Lightning', icon: '⚡', desc: 'Damage = cards in hand' },
  { id: 'inferno', name: 'Inferno', icon: '🔥', desc: 'Deals 30 damage to you' },
  { id: 'bloodlust', name: 'Bloodlust', icon: '🩸', desc: 'Heals 20 HP next turn' },
];

function getMiniBossAbility() {
  return MINIBOSS_ABILITIES[Math.floor(Math.random() * MINIBOSS_ABILITIES.length)];
}

function getBossAbilities() {
  const shuffled = [...BOSS_ABILITIES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function getMiniBossSelectedAbilities() {
  const shuffled = [...MINIBOSS_ABILITIES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function getBossSelectedAbilities() {
  const shuffled = [...BOSS_ABILITIES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1], shuffled[2]];
}

// ─── Level system constants ───────────────────────────────────────────────────

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

const CHAOS_MODIFIERS = [
  // Mild (levels 2-4)
  { id: 'diceFrenzy',   tier: 'mild',    icon: '🎲', name: 'Dice Frenzy',
    desc: 'All dice rolls are doubled — and so is enemy HP.',
    tip: 'Your dice hit harder, but enemies are much tankier.' },
  { id: 'cardLock',     tier: 'mild',    icon: '🔒', name: 'Card Lock',
    desc: 'After each enemy turn, one random card in your hand is locked.',
    tip: 'Plan around having one card unavailable each round.' },
  { id: 'goldCurse',    tier: 'mild',    icon: '💰', name: 'Gold Curse',
    desc: 'Regular enemies drop no runes. Only mini-bosses and bosses reward loot.',
    tip: 'Focus on surviving — the boss runes are worth it.' },
  { id: 'reverseDice',  tier: 'mild',    icon: '🔄', name: 'Reverse Dice',
    desc: 'All die rolls are reversed: a 6 becomes 1, a 1 becomes 6.',
    tip: 'Cards that use low rolls now become powerful.' },
  { id: 'speedRound',   tier: 'mild',    icon: '⚡', name: 'Speed Round',
    desc: 'Enemies attack twice per turn.',
    tip: 'Stack shields and kill enemies fast.' },
  // Medium (levels 5-7)
  { id: 'deathTouch',   tier: 'medium',  icon: '💀', name: 'Death Touch',
    desc: 'If a card deals no damage to the enemy, you take 5 damage instead.',
    tip: 'Avoid playing shield or heal cards carelessly.' },
  { id: 'ironSkin',     tier: 'medium',  icon: '🛡️', name: 'Iron Skin',
    desc: 'All enemies start with a shield equal to 30% of their max HP.',
    tip: 'Burst through the shield first before HP damage applies.' },
  { id: 'identitySwap', tier: 'medium',  icon: '🎭', name: 'Identity Swap',
    desc: 'Combat begins with your HP and the enemy HP swapped.',
    tip: 'You start in a desperate position — survive the opening.' },
  { id: 'chaosDice',    tier: 'medium',  icon: '🌀', name: 'Chaos Dice',
    desc: 'Your dice only land on 1, 3, or 6 — nothing in between.',
    tip: 'High-variance results. Build your deck for extremes.' },
  { id: 'vampireRules', tier: 'medium',  icon: '🩸', name: 'Vampire Rules',
    desc: 'Enemies heal 50% of damage you deal, and 50% of damage they deal.',
    tip: 'Burst enemies down — drawn-out fights favour them.' },
  // Extreme (levels 8-9)
  { id: 'blind',        tier: 'extreme', icon: '👁️', name: 'Blind',
    desc: 'Enemy HP and intentions are hidden. Fight completely blind.',
    tip: 'Count turns and estimate when enemies are near death.' },
  { id: 'explosive',    tier: 'extreme', icon: '💥', name: 'Explosive',
    desc: 'When the enemy crits (sum ≥ 15), 50% bonus damage splashes through your shield.',
    tip: 'Keep HP high — crits can be devastating.' },
  { id: 'suddenDeath',  tier: 'extreme', icon: '☠️', name: 'Sudden Death',
    desc: 'Both you and the enemy start each combat at 30% HP.',
    tip: 'Every action matters. Shield cards and kill speed are everything.' },
];

function pickModifierForLevel(level, usedIds) {
  if (level === 1 || level === 10) return null;
  const tier = level <= 4 ? 'mild' : level <= 7 ? 'medium' : 'extreme';
  const pool = CHAOS_MODIFIERS.filter(m => m.tier === tier && !usedIds.includes(m.id));
  if (pool.length === 0) {
    const tierPool = CHAOS_MODIFIERS.filter(m => m.tier === tier);
    return tierPool[Math.floor(Math.random() * tierPool.length)] || null;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Bribe helpers ────────────────────────────────────────────────────────────
// (getBribeChance and getMinBribeAmount imported from BribeScreen.js)

// ─── Dice helpers ─────────────────────────────────────────────────────────────

// Build a fresh dice array from the equipped die instances
function makeFreshDice(equipped) {
  return equipped.map(d => ({
    val:       null,
    used:      false,
    dieId:     d.id,
    dieIcon:   d.icon,
    dieRarity: d.rarity,
    dieName:   d.name,
  }));
}

const available = (dice) =>
  dice.filter((d) => !d.used && d.val !== null).map((d) => d.val);

const hasPair = (dice) => {
  const vals   = available(dice);
  const counts = {};
  vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).some((c) => c >= 2);
};

// ─── Enemy dice helpers ──────────────────────────────────────────────────────

function rollEnemyDice() {
  return [rnd6(), rnd6(), rnd6()];
}

function getEnemyRollStatus(sum, intentionType) {
  if (intentionType === 'ability') {
    if (sum <= 6) return { status: 'Miss',   color: '#777',    label: 'MISS' };
    if (sum >= 15) return { status: 'Both',  color: '#FFD700', label: '✨ ALL ABILITIES' };
    return               { status: 'Ability',color: '#AA00FF', label: '⚡ ABILITY' };
  }
  if (intentionType === 'defence') {
    if (sum <= 6) return { status: 'Miss',          color: '#777',    label: 'Miss' };
    if (sum >= 15) return { status: 'StrongDefence', color: '#5BC8E8', label: '🛡️ STRONG!' };
    return               { status: 'Defence',        color: '#5BC8E8', label: '🛡️ Defence' };
  }
  // attack (default)
  if (sum <= 6) return { status: 'Miss',   color: '#777',    label: 'Miss' };
  if (sum >= 15) return { status: 'Crit',  color: '#FF8C00', label: '🔥 CRIT!' };
  return               { status: 'Attack', color: '#C0392B', label: 'Attack' };
}

function determineIntention(currentEncounterType) {
  const rand = Math.random();
  if (currentEncounterType === 'regular') return rand < 0.5 ? 'attack' : 'defence';
  if (rand < 0.50) return 'attack';
  if (rand < 0.70) return 'defence';
  return 'ability';
}

function getBlockValue(currentEncounterType) {
  if (currentEncounterType === 'boss')     return 20;
  if (currentEncounterType === 'miniBoss') return 15;
  return 10;
}

// ─── Deck helpers ────────────────────────────────────────────────────────────

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawN(count, fromDeck) {
  const drawn = [];
  let deck = [...fromDeck];
  for (let i = 0; i < count && deck.length > 0; i++) {
    drawn.push(deck[0]);
    deck = deck.slice(1);
  }
  return [drawn, deck];
}

function refillHand(deck, hand, discard, maxSize = 6) {
  let newDeck = [...deck];
  let newHand = [...hand];
  let newDiscard = [...discard];

  while (newHand.length < maxSize) {
    if (newDeck.length === 0 && newDiscard.length === 0) break;

    if (newDeck.length === 0) {
      newDeck = shuffle(newDiscard);
      newDiscard = [];
    }

    newHand.push(newDeck[0]);
    newDeck = newDeck.slice(1);
  }

  return { hand: newHand, deck: newDeck, discard: newDiscard };
}

// ─── Cards ───────────────────────────────────────────────────────────────────

const CARDS = [
  {
    id:      'slash',
    icon:    '⚔️',
    name:    'Slash',
    desc:    'Deal die × 2 damage',
    req:     'Any die',
    rarity:  'common',
    canPlay: (dice) => available(dice).length > 0,
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx  = next.findIndex((d) => !d.used && d.val !== null);
      const die  = next[idx];
      const mult = getDamageMultiplier(die.dieId, die.val);
      die.used   = true;
      const dmg  = Math.floor(die.val * 2 * mult);
      const mStr = mult > 1 ? ` × ${mult}` : '';
      return { dice: next, enemyDmg: dmg, msg: `⚔️ Slash! ${die.val} × 2${mStr} = ${dmg} damage` };
    },
  },
  {
    id:      'shield',
    icon:    '🛡️',
    name:    'Shield Wall',
    desc:    'Block die × 2 damage',
    req:     'Any die',
    rarity:  'common',
    canPlay: (dice) => dice.some((d) => !d.used && d.val !== null),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx  = next.findIndex((d) => !d.used && d.val !== null);
      const shieldAmt = next[idx].val * 2;
      next[idx].used = true;
      return { dice: next, shield: shieldAmt, msg: `🛡️ Shield Wall! Blocking ${shieldAmt} damage next turn` };
    },
  },
  {
    id:      'inferno',
    icon:    '🔥',
    name:    'Inferno',
    desc:    'Deal 25 damage',
    req:     'Need a 6',
    rarity:  'rare',
    canPlay: (dice) => dice.some((d) => !d.used && d.val === 6),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx  = next.findIndex((d) => !d.used && d.val === 6);
      const die  = next[idx];
      const mult = getDamageMultiplier(die.dieId, die.val);
      die.used   = true;
      const dmg  = Math.floor(25 * mult);
      return { dice: next, enemyDmg: dmg, msg: `🔥 Inferno! ${dmg} damage!` };
    },
  },
  {
    id:      'gambler',
    icon:    '🎲',
    name:    'Gambler',
    desc:    '6 = 30 dmg · 1 = −20 HP',
    req:     'Any die',
    rarity:  'rare',
    canPlay: (dice) => available(dice).length > 0,
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx  = next.findIndex((d) => !d.used && d.val !== null);
      const die  = next[idx];
      die.used   = true;
      const roll = rnd6();
      if (roll === 6) {
        const mult = getDamageMultiplier(die.dieId, die.val);
        const dmg  = Math.floor(30 * mult);
        return { dice: next, enemyDmg: dmg, msg: `🎲 Gambler rolled ${roll}! ${dmg} damage!` };
      }
      if (roll === 1) return { dice: next, playerDmg: 20, msg: `🎲 Gambler rolled ${roll}! −20 HP!` };
      return { dice: next, msg: `🎲 Gambler rolled ${roll}. Nothing happens.` };
    },
  },
  {
    id:      'deathsentence',
    icon:    '👑',
    name:    'Death Sentence',
    desc:    'Deal 100 damage',
    req:     'Three 6s',
    rarity:  'legendary',
    canPlay: (dice) => dice.filter((d) => !d.used && d.val === 6).length >= 3,
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      let removed = 0;
      for (let i = 0; i < next.length && removed < 3; i++) {
        if (!next[i].used && next[i].val === 6) { next[i].used = true; removed++; }
      }
      return { dice: next, enemyDmg: 100, msg: '👑 Death Sentence! 100 damage!' };
    },
  },
  {
    id:      'divineshield',
    icon:    '🌟',
    name:    'Divine Shield',
    desc:    'Block 50 damage',
    req:     'Triple any',
    rarity:  'legendary',
    canPlay: (dice) => {
      const vals = available(dice);
      const counts = {};
      vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      return Object.values(counts).some((c) => c >= 3);
    },
    play(dice) {
      const vals = available(dice);
      const counts = {};
      vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      const tripleVal = Number(Object.keys(counts).find((k) => counts[k] >= 3));
      const next = dice.map((d) => ({ ...d }));
      let removed = 0;
      for (let i = 0; i < next.length && removed < 3; i++) {
        if (!next[i].used && next[i].val === tripleVal) { next[i].used = true; removed++; }
      }
      return { dice: next, shield: 50, msg: '🌟 Divine Shield! Blocking 50 damage!' };
    },
  },
  {
    id:      'stormcall',
    icon:    '⚡',
    name:    'Storm Call',
    desc:    'Deal 45 damage',
    req:     '3 consecutive',
    rarity:  'legendary',
    canPlay: (dice) => {
      const vals = available(dice).sort((a, b) => a - b);
      for (let i = 0; i <= vals.length - 3; i++) {
        if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 2) return true;
      }
      return false;
    },
    play(dice) {
      const vals = available(dice).sort((a, b) => a - b);
      let startVal = -1;
      for (let i = 0; i <= vals.length - 3; i++) {
        if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 2) { startVal = vals[i]; break; }
      }
      const next = dice.map((d) => ({ ...d }));
      for (let v = startVal; v <= startVal + 2; v++) {
        const idx = next.findIndex((d) => !d.used && d.val === v);
        if (idx !== -1) next[idx].used = true;
      }
      return { dice: next, enemyDmg: 45, msg: '⚡ Storm Call! 45 damage!' };
    },
  },
  // ─── Cursed cards ─────────────────────────────────────────────────────────
  {
    id: 'blood_pact',
    icon: '🩸',
    name: 'Blood Pact',
    desc: 'Deal 40 damage, lose 15 HP',
    req: 'Die 4+',
    rarity: 'rare',
    canPlay: (dice) => dice.some((d) => !d.used && d.val >= 4),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.val >= 4);
      next[idx].used = true;
      return { dice: next, enemyDmg: 40, playerDmg: 15, msg: '🩸 Blood Pact! 40 damage, -15 HP' };
    },
  },
  {
    id: 'death_wish',
    icon: '💀',
    name: 'Death Wish',
    desc: 'Deal 60 damage, lose 25 HP',
    req: 'Pair',
    rarity: 'epic',
    canPlay: hasPair,
    play(dice) {
      const vals = available(dice);
      const counts = {};
      vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      const pairVal = Number(Object.keys(counts).find((k) => counts[k] >= 2));
      const next = dice.map((d) => ({ ...d }));
      let removed = 0;
      for (let i = 0; i < next.length && removed < 2; i++) {
        if (!next[i].used && next[i].val === pairVal) { next[i].used = true; removed++; }
      }
      return { dice: next, enemyDmg: 60, playerDmg: 25, msg: '💀 Death Wish! 60 damage, -25 HP' };
    },
  },
  {
    id: 'soul_drain',
    icon: '😈',
    name: 'Soul Drain',
    desc: 'Deal 30 damage, lose 10 HP, heal 20 HP',
    req: 'Die 5+',
    rarity: 'epic',
    canPlay: (dice) => dice.some((d) => !d.used && d.val >= 5),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.val >= 5);
      next[idx].used = true;
      return { dice: next, enemyDmg: 30, playerDmg: 10, playerHeal: 20, msg: '😈 Soul Drain! 30 damage, -10 HP, +20 HP' };
    },
  },
  // ─── Combo cards ──────────────────────────────────────────────────────────
  {
    id: 'chain_strike',
    icon: '🔗',
    name: 'Chain Strike',
    desc: '10 damage, 20 if after attack',
    req: 'Any die',
    rarity: 'common',
    canPlay: (dice) => available(dice).length > 0,
    play(dice, ctx) {
      const attackCardIds = ['slash', 'inferno', 'gambler', 'blood_pact', 'death_wish', 'soul_drain', 'chain_strike', 'thunder_combo', 'death_touch', 'perfect_strike', 'chaos_nova', 'explosion_chain'];
      const isChained = ctx && attackCardIds.includes(ctx.lastCardId);
      const dmg = isChained ? 20 : 10;
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.val !== null);
      next[idx].used = true;
      return { dice: next, enemyDmg: dmg, msg: `🔗 Chain Strike! ${dmg} damage` };
    },
  },
  {
    id: 'thunder_combo',
    icon: '⚡',
    name: 'Thunder Combo',
    desc: '45 damage if 2+ cards played',
    req: 'Pair',
    rarity: 'rare',
    canPlay: hasPair,
    play(dice, ctx) {
      const cardsPlayed = (ctx && ctx.cardsPlayedThisTurn) || 1;
      const isCombo = cardsPlayed >= 2;
      const dmg = isCombo ? 45 : 15;
      const vals = available(dice);
      const counts = {};
      vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
      const pairVal = Number(Object.keys(counts).find((k) => counts[k] >= 2));
      const next = dice.map((d) => ({ ...d }));
      let removed = 0;
      for (let i = 0; i < next.length && removed < 2; i++) {
        if (!next[i].used && next[i].val === pairVal) { next[i].used = true; removed++; }
      }
      return { dice: next, enemyDmg: dmg, msg: isCombo ? `⚡ Thunder Combo! ${dmg} damage!` : `⚡ Thunder Combo! ${dmg} damage` };
    },
  },
  {
    id: 'echo',
    icon: '🌀',
    name: 'Echo',
    desc: 'Copy last card effect',
    req: 'Die 3+',
    rarity: 'epic',
    canPlay: (dice) => dice.some((d) => !d.used && d.val >= 3),
    play(dice, ctx) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.val >= 3);
      next[idx].used = true;
      if (!ctx || !ctx.lastCardResult) {
        return { dice: next, msg: '🌀 Echo! No card to echo...' };
      }
      const lr = ctx.lastCardResult;
      return {
        dice: next,
        enemyDmg: lr.enemyDmg || 0,
        playerDmg: lr.playerDmg || 0,
        playerHeal: lr.playerHeal || 0,
        shield: lr.shield || 0,
        msg: `🌀 Echo! Repeating ${lr.msg || 'last effect'}`,
      };
    },
  },
  // ─── Dice-specific cards ──────────────────────────────────────────────────
  {
    id: 'death_touch',
    icon: '💀',
    name: 'Death Touch',
    desc: 'Deal 100 damage',
    req: 'Death Die = 1',
    rarity: 'legendary',
    canPlay: (dice) => dice.some((d) => !d.used && d.dieId === 'death' && d.val === 1),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.dieId === 'death' && d.val === 1);
      next[idx].used = true;
      return { dice: next, enemyDmg: 100, msg: '💀 Death Touch! 100 damage!' };
    },
  },
  {
    id: 'perfect_strike',
    icon: '⭐',
    name: 'Perfect Strike',
    desc: 'Deal 50 damage, heal 10 HP',
    req: 'Legendary Die = 6',
    rarity: 'legendary',
    canPlay: (dice) => dice.some((d) => !d.used && d.dieId === 'legendary_die' && d.val === 6),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.dieId === 'legendary_die' && d.val === 6);
      next[idx].used = true;
      return { dice: next, enemyDmg: 50, playerHeal: 10, msg: '⭐ Perfect Strike! 50 damage, +10 HP' };
    },
  },
  {
    id: 'chaos_nova',
    icon: '🎲',
    name: 'Chaos Nova',
    desc: 'Damage = Chaos Die × 10',
    req: 'Chaos Die',
    rarity: 'epic',
    canPlay: (dice) => dice.some((d) => !d.used && d.dieId === 'chaos' && d.val !== null),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.dieId === 'chaos' && d.val !== null);
      const die = next[idx];
      die.used = true;
      const dmg = die.val * 10;
      return { dice: next, enemyDmg: dmg, msg: `🎲 Chaos Nova! ${dmg} damage!` };
    },
  },
  {
    id: 'explosion_chain',
    icon: '🔴',
    name: 'Explosion Chain',
    desc: 'Trigger Explosion Die twice',
    req: 'Explosion Die',
    rarity: 'rare',
    canPlay: (dice) => dice.some((d) => !d.used && d.dieId === 'explosion' && d.val !== null),
    play(dice) {
      const next = dice.map((d) => ({ ...d }));
      const idx = next.findIndex((d) => !d.used && d.dieId === 'explosion' && d.val !== null);
      const die = next[idx];
      die.used = true;
      let dmg = 0;
      if (die.val === 6) {
        dmg += (6 + rollDie('standard')) + (6 + rollDie('standard'));
      } else {
        dmg = die.val * 2;
      }
      return { dice: next, enemyDmg: dmg, msg: `🔴 Explosion Chain! ${dmg} damage!` };
    },
  },
];

// Add new base cards (reaper, lifesteal, freeze, chain) to the reward pool
CARDS.push(...NEW_BASE_CARDS);

// Lookup map: id → card (with logic) — includes upgrade variants
const CARD_MAP = Object.fromEntries(
  [...CARDS, ...UPGRADE_CARDS].map((c) => [c.id, c])
);

// Display-only subset used for collection state
function cardDisplayInfo(c) {
  return { id: c.id, icon: c.icon, name: c.name, desc: c.desc, req: c.req, rarity: c.rarity };
}

const BASE_CARD_COLLECTION = [
  ...['slash', 'slash', 'shield', 'shield', 'gambler'].map(id => {
    const c = CARDS.find(card => card.id === id);
    return makeCardInstance(cardDisplayInfo(c));
  })
]; // 2x slash, 2x shield wall, 1x gambler

// ─── Sub-components ──────────────────────────────────────────────────────────

function CharacterHpBar({ current, max, barWidth = 120 }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const fillAnim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(fillAnim, { toValue: pct, duration: 280, useNativeDriver: false }).start();
  }, [pct]);
  const color = pct > 0.6 ? '#27AE60' : pct > 0.3 ? '#E8A020' : '#C0392B';
  const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth] });
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ width: barWidth, height: 8, backgroundColor: '#1A1A1A', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width: fillWidth, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ color: '#EEE', fontSize: 10, fontWeight: 'bold', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>
        {current}/{max}
      </Text>
    </View>
  );
}

function HpBar({ current, max, color }) {
  const pct = Math.max(0, Math.min(1, current / max));
  return (
    <View style={s.hpTrack}>
      <View style={[s.hpFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function Die({ die, rotation, isAnimating }) {
  const rarityBorder = die.dieRarity
    ? (RARITY_COLOR[die.dieRarity] || '#3A3A5A')
    : '#3A3A5A';

  if (die.used) return <View style={[s.die, s.dieUsed]} />;

  const spin = isAnimating && rotation ? rotation.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '3600deg'],
  }) : null;

  if (die.val === null) {
    return (
      <Animated.View style={[s.die, s.dieEmpty, { borderColor: rarityBorder }, spin ? { transform: [{ rotate: spin }] } : {}]}>
        <Text style={s.dieIcon}>{die.dieIcon || '?'}</Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[s.die, s.dieRolled, { borderColor: rarityBorder }, spin ? { transform: [{ rotate: spin }] } : {}]}>
      <Text style={s.dieText}>{die.val}</Text>
    </Animated.View>
  );
}

function CardView({ card, dice, onPlay, disabled, isLocked }) {
  const playable = !disabled && card.canPlay(dice);
  const rarityColor = RARITY_COLOR[card.rarity] || '#3A3A5A';
  return (
    <TouchableOpacity
      style={[
        s.card,
        { borderColor: playable ? rarityColor : '#2A2A2A' },
        playable ? s.cardOn : s.cardOff,
        disabled && { opacity: 0.4 },
        { flex: 1 },
      ]}
      onPress={() => onPlay(card)}
      activeOpacity={0.75}
      disabled={disabled}
    >
      <Text style={s.cardIcon}>{card.icon}</Text>
      <Text style={s.cardName}>{card.name}</Text>
      <Text style={s.cardDesc}>{card.desc}</Text>
      <View style={s.cardReqBadge}>
        <Text style={s.cardReqText}>{card.req}</Text>
      </View>
      {isLocked && (
        <View style={[StyleSheet.absoluteFill, s.lockOverlay]}>
          <Text style={s.lockIcon}>🔒</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EnemyDieDisplay({ val, rotation, isAnimating }) {
  const spin = isAnimating && rotation ? rotation.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '3600deg'],
  }) : null;

  return (
    <Animated.View
      style={[
        s.enemyDie,
        { opacity: val !== null ? 1 : 0.5 },
        spin ? { transform: [{ rotate: spin }] } : {},
      ]}
    >
      <Text style={s.enemyDieText}>{val !== null ? val : '?'}</Text>
    </Animated.View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function App() {
  const { width: winW, height: winH } = useWindowDimensions();
  const charScale = Math.min(2.5, Math.max(0.5, winW / 1920));

  const [statusBarKey, setStatusBarKey] = useState(0);
  const diceRotations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const [diceAnimating, setDiceAnimating] = useState([false, false, false]);
  const enemyDiceRotation = useRef(new Animated.Value(0)).current;
  const shakeAnim         = useRef(new Animated.Value(0)).current;
  const bribeFlashAnim    = useRef(new Animated.Value(0)).current;
  const playerHitFlash    = useRef(new Animated.Value(0)).current;
  const victoryFlashAnim  = useRef(new Animated.Value(0)).current;
  const playerSlashOpacity = useRef(new Animated.Value(0)).current;
  const playerSlashScale   = useRef(new Animated.Value(1)).current;
  const enemyAnims        = useRef(new Map()); // id → { lunge, glowOpacity, deathOpacity, deathFlash, slashOpacity, slashScale }
  const diceSoundRef      = useRef(null);
  const cardSoundRef      = useRef(null);
  const hitSoundRef       = useRef(null);
  const cardDrawAnims     = useRef(new Map()); // instId → Animated.Value(translateY)
  const cardZeroAnim      = useRef(new Animated.Value(0)).current; // fallback for non-animating cards

  // ── Permanent progression (never reset on retry) ─────────────────────────
  const [runes,         setRunes]         = useState(0);   // permanent shrine rune pool
  const [runRunes,      setRunRunes]      = useState(0);   // in-run rune pool (resets each run)
  const [pCardSlots,    setPCardSlots]    = useState(6);   // card loadout limit
  const [pDiceSlots,    setPDiceSlots]    = useState(3);   // dice loadout limit
  const [pHpBonus,      setPHpBonus]      = useState(0);   // bonus to starting HP
  const [pGoldBonus,    setPGoldBonus]    = useState(0);   // bonus runes each run start
  const [pRareCard,     setPRareCard]     = useState(false); // start with rare card
  const [pRareDie,      setPRareDie]      = useState(false); // start with rare die
  const [shrineFrom,    setShrineFrom]    = useState('lose'); // 'lose'|'equip'
  const [deviceId,      setDeviceId]      = useState(null); // unique device ID for separate profiles

  // ── Persistent run state ──────────────────────────────────────────────────
  const [screen,           setScreen]          = useState('mainMenu'); // 'mainMenu'|'equip'|'preCombat'|'combat'|'cardReward'|'lose'|'story'|'shrine'
  const [hasActiveRun,     setHasActiveRun]    = useState(false); // track if run in progress
  const [equipFromScreen,  setEquipFromScreen] = useState('mainMenu'); // track return screen from equip
  const [lastRunScreen,    setLastRunScreen]   = useState('preCombat'); // screen to restore on continue
  const [usedScenarioIds,  setUsedScenarioIds]  = useState([]);
  const [playerMaxHp,      setPlayerMaxHp]      = useState(PLAYER_MAX_HP);
  const [combatCount,      setCombatCount]      = useState(0);
  const [diceCollection,   setDiceCollection]   = useState(initialCollection);
  const [cardCollection,   setCardCollection]   = useState(BASE_CARD_COLLECTION);
  const [equippedCardIds,  setEquippedCardIds]  = useState([]);

  // ── Per-combat state ──────────────────────────────────────────────────────
  const [equippedDice,     setEquippedDice]     = useState([]);
  const [playerHP,         setPlayerHP]         = useState(PLAYER_MAX_HP);
  const [enemyHP,          setEnemyHP]          = useState(ENEMY_MAX_HP);
  const [dice,             setDice]             = useState([]);
  const [rollsLeft,        setRollsLeft]        = useState(MAX_ROLLS);
  const [shield,           setShield]           = useState(0);
  const [message,          setMessage]          = useState('');
  const [phase,            setPhase]            = useState('player'); // 'player'|'cardReward'|'lose'
  const [playerAnim,       setPlayerAnim]       = useState('idle');   // 'idle'|'attacking'|'hurt'|'dying'
  const [playerAnimKey,    setPlayerAnimKey]    = useState(0);        // increment to restart GIF
  const [hoveredCardId,    setHoveredCardId]    = useState(null);     // card hovered on PC
  const [bgSize,           setBgSize]          = useState({ w: SCREEN_W, h: SCREEN_H }); // measured content area
  const [weightedPickerDie, setWeightedPickerDie] = useState(null); // { idx } | null
  const [deck,             setDeck]             = useState([]);
  const [hand,             setHand]             = useState([]);
  const [discard,          setDiscard]          = useState([]);
  const [cardsPlayedThisTurn, setCardsPlayedThisTurn] = useState(0);
  const [lastCardId,       setLastCardId]       = useState(null);
  const [lastCardResult,   setLastCardResult]   = useState(null);
  const [encounterType,    setEncounterType]    = useState('regular'); // 'regular'|'miniBoss'|'boss'
  const [enemyMaxHP,       setEnemyMaxHP]       = useState(ENEMY_MAX_HP);
  const [enemyDamage,      setEnemyDamage]      = useState(ENEMY_ATTACK);
  const [enemyAttackRange, setEnemyAttackRange] = useState([ENEMY_ATTACK, ENEMY_ATTACK]);
  const [enemyShieldRange, setEnemyShieldRange] = useState([8, 12]);
  const [miniBossTurnCounter, setMiniBossTurnCounter] = useState(0);
  const [miniBossAbility,  setMiniBossAbility]  = useState(null);
  const [miniBossSelectedAbilities, setMiniBossSelectedAbilities] = useState([]);
  const [bossAbilities,      setBossAbilities]      = useState([null, null]);
  const [bossSelectedAbilities, setBossSelectedAbilities] = useState([]);
  const [bossAbilityIndex,   setBossAbilityIndex]   = useState(0);
  const [bossCurrentAbility, setBossCurrentAbility] = useState(null);
  const [statusEffects,    setStatusEffects]    = useState({
    shield: false,
    rage: { active: false, turnsLeft: 0 },
    curse: { active: false },
  });
  const [lockedCards,      setLockedCards]      = useState([]);
  const [enemyDice,        setEnemyDice]        = useState([null, null, null]);
  const [enemyRollStatus,  setEnemyRollStatus]  = useState(null);
  const [enemyDiceSum,     setEnemyDiceSum]     = useState(0);
  const [enemyTurnCount,   setEnemyTurnCount]   = useState(0);
  const [showingEnemyRoll, setShowingEnemyRoll] = useState(true);
  const [enemyRolling,     setEnemyRolling]     = useState(false);
  const [selectedAbilityInfo, setSelectedAbilityInfo] = useState(null);
  const [enemyIntention,      setEnemyIntention]      = useState(null); // 'attack'|'defence'|'ability'
  const [enemyIntentionValue, setEnemyIntentionValue] = useState(0);
  const [enemyShield,         setEnemyShield]         = useState(0);
  const [activeAbilities,     setActiveAbilities]     = useState([]);
  const [voidCursed,          setVoidCursed]          = useState(false);
  const [pendingEnemyHeal,    setPendingEnemyHeal]    = useState(0);
  // Ref tracks damage dealt this turn for Death Mark — synchronous, no batching issues
  const damageDealtThisTurnRef = useRef(0);

  // ── Card upgrade system (permanent) ──────────────────────────────────────
  // Maps base card ID → current upgraded card ID  e.g. { 'slash': 'slash_epic' }
  const [upgradedCards, setUpgradedCards] = useState({});

  // ── DoT / Freeze combat state ─────────────────────────────────────────────
  const [enemyDotDmg,    setEnemyDotDmg]    = useState(0);
  const [enemyDotTurns,  setEnemyDotTurns]  = useState(0);
  const [enemyDotType,   setEnemyDotType]   = useState('poison'); // 'poison'|'burn'
  const [enemyFrozenTurns, setEnemyFrozenTurns] = useState(0);

  // ── Multi-enemy state ─────────────────────────────────────────────────
  const [enemies,          setEnemies]          = useState([]); // active during regular combat
  const [selectedEnemyIdx, setSelectedEnemyIdx] = useState(0);
  const [dyingEnemyIds,    setDyingEnemyIds]    = useState(new Set()); // enemies mid-death animation
  const [floatingDamages,     setFloatingDamages]     = useState([]); // player: [{ id, value, y, opacity }]
  const [enemyFloatingDamages, setEnemyFloatingDamages] = useState([]); // enemies: [{ id, enemyId, value, y, opacity }]

  // ── Bribe system ─────────────────────────────────────────────────────────
  const [showBribeScreen,  setShowBribeScreen]  = useState(false);
  const [bribeUsed,        setBribeUsed]        = useState(false); // one bribe per combat
  const [enragedTurns,     setEnragedTurns]     = useState(0);  // turns enemy is enraged after failed bribe
  const [bribeFlashColor,  setBribeFlashColor]  = useState('success'); // 'success'|'fail'
  const [bribeRefundAmount,setBribeRefundAmount] = useState(0); // runes to refund if player wins after failed bribe
  const [postShopAction,    setPostShopAction]    = useState('nextEncounter'); // 'nextEncounter'|'levelComplete'
  const [shrineLockedToast, setShrineLockedToast] = useState(false);

  // ── Boss Soul & Buff system ───────────────────────────────────────────────
  const [bossSouls,        setBossSouls]        = useState(0);
  const [activeBuffs,      setActiveBuffs]      = useState([]);
  const [showBuffShop,     setShowBuffShop]     = useState(false);
  const [pendingNewBuff,   setPendingNewBuff]   = useState(null);
  const [showDropBuff,     setShowDropBuff]     = useState(false);
  const [titanAttackCount,  setTitanAttackCount]  = useState(0);
  const [divineGraceUsed,   setDivineGraceUsed]   = useState(false);
  const [purchasedBuffIds,  setPurchasedBuffIds]  = useState([]);

  // ── Level system ─────────────────────────────────────────────────────────
  const [currentLevel,        setCurrentLevel]        = useState(1);
  const [levelCombatCount,    setLevelCombatCount]    = useState(0); // 0-9 within level
  const [chaosModifier,       setChaosModifier]       = useState(null); // active chaos modifier
  const [usedModifierIds,     setUsedModifierIds]     = useState([]); // avoid repeats
  const [levelRunesEarned,    setLevelRunesEarned]    = useState(0); // runes this level
  const [totalRunesEarned,    setTotalRunesEarned]    = useState(0); // runes this run
  const [pendingNextModifier, setPendingNextModifier] = useState(null); // for level complete screen

  // ── Buff helpers ─────────────────────────────────────────────────────────
  const hasBuff = (id) => activeBuffs.some(b => b.id === id);
  const handSize = () => 6 + (hasBuff('cardDraw') ? 1 : 0) + (hasBuff('mysticHand') ? 1 : 0);
  const rollsPerTurn = () => MAX_ROLLS + (hasBuff('luckyRolls') ? 1 : 0);

  // ── UI effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    let sound;
    Audio.Sound.createAsync(require('./assets/dice_roll.wav'))
      .then(({ sound: s }) => { sound = s; diceSoundRef.current = s; })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

  function playDiceSound() {
    if (!diceSoundRef.current) return;
    diceSoundRef.current.setPositionAsync(0)
      .then(() => diceSoundRef.current?.playAsync())
      .catch(() => {});
  }

  useEffect(() => {
    let sound;
    Audio.Sound.createAsync(require('./assets/card_draw.wav'))
      .then(({ sound: s }) => { sound = s; cardSoundRef.current = s; })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

  useEffect(() => {
    let sound;
    Audio.Sound.createAsync(require('./assets/hit.wav'))
      .then(({ sound: s }) => { sound = s; hitSoundRef.current = s; })
      .catch(() => {});
    return () => { sound?.unloadAsync(); };
  }, []);

  function triggerCardDraw(newIds) {
    if (!newIds || newIds.length === 0) return;
    // Pre-create Animated.Values at 80 (below final position) before React renders them
    newIds.forEach(id => {
      cardDrawAnims.current.set(id, new Animated.Value(80));
    });
    // Staggered: animate + play sound per card
    newIds.forEach((id, index) => {
      setTimeout(() => {
        // Sound — rewind and play for each card
        if (cardSoundRef.current) {
          cardSoundRef.current.setPositionAsync(0)
            .then(() => cardSoundRef.current?.playAsync())
            .catch(() => {});
        }
        // Spring with slight bounce
        const anim = cardDrawAnims.current.get(id);
        if (anim) {
          Animated.spring(anim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 220,
            friction: 11,
          }).start();
        }
      }, index * 150 + 30); // +30ms lets React render the starting position first
    });
  }

  useEffect(() => {
    const hideBars = () => {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    };

    hideBars();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        hideBars();
        setTimeout(hideBars, 100);
        setTimeout(hideBars, 400);
      }
    });

    return () => sub.remove();
  }, []);

  // ── Load shrine progress from AsyncStorage on mount ─────────────────────────
  useEffect(() => {
    const loadProgress = async () => {
      try {
        // Generate or load unique device ID
        let id = await AsyncStorage.getItem('@runeboundduel:deviceId');
        if (!id) {
          id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem('@runeboundduel:deviceId', id);
        }
        setDeviceId(id);

        // Try to load active run state
        const runData = await AsyncStorage.getItem(`@runeboundduel:run_${id}`);
        if (runData !== null) {
          // Run exists, restore it and go to pre-combat
          try {
            const parsed = JSON.parse(runData);
            // Restore all run state
            setDeck(parsed.deck || []);
            setHand(parsed.hand || []);
            setDiscard(parsed.discard || []);
            setPlayerHP(parsed.playerHP || PLAYER_MAX_HP);
            setPlayerMaxHp(parsed.playerMaxHp || PLAYER_MAX_HP);
            setCombatCount(parsed.combatCount || 0);
            setDiceCollection(parsed.diceCollection || initialCollection());
            setCardCollection(parsed.cardCollection || BASE_CARD_COLLECTION);
            setEquippedCardIds(parsed.equippedCardIds || []);
            setEquippedDice(parsed.equippedDice || []);
            setUsedScenarioIds(parsed.usedScenarioIds || []);
            setEnemyHP(parsed.enemyHP || ENEMY_MAX_HP);
            setEnemyMaxHP(parsed.enemyMaxHP || ENEMY_MAX_HP);
            setEnemyDamage(parsed.enemyDamage || ENEMY_ATTACK);
            setEncounterType(parsed.encounterType || 'regular');
            setPhase(parsed.phase || 'player');
            setDice(parsed.dice || []);
            setRollsLeft(parsed.rollsLeft || MAX_ROLLS);
            setMessage(parsed.message || '');
            setCurrentLevel(parsed.currentLevel || 1);
            setLevelCombatCount(parsed.levelCombatCount || 0);
            setChaosModifier(parsed.chaosModifier || null);
            setUsedModifierIds(parsed.usedModifierIds || []);
            setLevelRunesEarned(parsed.levelRunesEarned || 0);
            setTotalRunesEarned(parsed.totalRunesEarned || 0);
            setUpgradedCards(parsed.upgradedCards || {});
            setRunRunes(parsed.runRunes || 0);
            setPendingNextModifier(parsed.pendingNextModifier || null);
            setEnragedTurns(parsed.enragedTurns || 0);
            setHasActiveRun(true);
            const savedScreen = parsed.screen;
            setLastRunScreen(savedScreen === 'mainMenu' || !savedScreen ? 'preCombat' : savedScreen);
            setScreen('mainMenu'); // Always start at main menu
          } catch (e) {
            console.log('Error parsing run data:', e);
          }
        } else {
          // No active run, go to main menu
          setScreen('mainMenu');
        }

        const val = await AsyncStorage.getItem(`@runeboundduel:shrine_${id}`);
        let loadedPCardSlots = 6;
        let loadedPDiceSlots = 3;

        if (val !== null) {
          const data = JSON.parse(val);
          setRunes(data.runes ?? 0);
          loadedPCardSlots = data.pCardSlots ?? 6;
          loadedPDiceSlots = data.pDiceSlots ?? 3;
          setPCardSlots(loadedPCardSlots);
          setPDiceSlots(loadedPDiceSlots);
          setPHpBonus(data.pHpBonus ?? 0);
          setPGoldBonus(data.pGoldBonus ?? 0);
          setPRareCard(data.pRareCard ?? false);
          setPRareDie(data.pRareDie ?? false);
        }

        // Only rebuild base collections if there's no active run.
        // If a run exists, its saved cardCollection/diceCollection are already restored above.
        if (runData === null) {
          let newDice = initialCollection();
          for (let i = 3; i < loadedPDiceSlots; i++) {
            newDice.push(makeInstance(STANDARD_DIE));
          }
          setDiceCollection(newDice);

          let newCards = [...BASE_CARD_COLLECTION];
          for (let i = 6; i < loadedPCardSlots; i++) {
            newCards.push(makeCardInstance(cardDisplayInfo(CARDS[0])));
          }
          setCardCollection(newCards);
        }
      } catch (error) {
        console.log('Error loading shrine progress:', error);
      }
    };
    loadProgress();
  }, []);

  // ── Reset shrine (debug) ──────────────────────────────────────────────────
  const resetShrine = async () => {
    try {
      if (deviceId) await AsyncStorage.removeItem(`@runeboundduel:shrine_${deviceId}`);
      setRunes(0);
      setPCardSlots(6);
      setPDiceSlots(3);
      setPHpBonus(0);
      setPGoldBonus(0);
      setPRareCard(false);
      setPRareDie(false);
      setDiceCollection(initialCollection());
      setCardCollection(BASE_CARD_COLLECTION);
      alert('Shrine reset! Restart the app.');
    } catch (error) {
      console.log('Error resetting shrine:', error);
    }
  };

  // ── Save shrine progress to AsyncStorage ──────────────────────────────────
  useEffect(() => {
    const saveProgress = async () => {
      if (!deviceId) return; // Don't save until device ID is set
      try {
        const data = {
          runes,
          pCardSlots,
          pDiceSlots,
          pHpBonus,
          pGoldBonus,
          pRareCard,
          pRareDie,
        };
        await AsyncStorage.setItem(`@runeboundduel:shrine_${deviceId}`, JSON.stringify(data));
      } catch (error) {
        console.log('Error saving shrine progress:', error);
      }
    };
    saveProgress();
  }, [runes, pCardSlots, pDiceSlots, pHpBonus, pGoldBonus, pRareCard, pRareDie, deviceId]);

  // ── Save run state to AsyncStorage ─────────────────────────────────────────
  useEffect(() => {
    const saveRunState = async () => {
      if (!deviceId || !hasActiveRun) return; // Don't save if no active run
      try {
        const data = {
          deck,
          hand,
          discard,
          playerHP,
          playerMaxHp,
          combatCount,
          diceCollection,
          cardCollection,
          equippedCardIds,
          equippedDice,
          usedScenarioIds,
          enemyHP,
          enemyMaxHP,
          enemyDamage,
          encounterType,
          phase,
          dice,
          rollsLeft,
          message,
          screen,
          shield,
          statusEffects,
          lockedCards,
          currentLevel,
          levelCombatCount,
          chaosModifier,
          usedModifierIds,
          levelRunesEarned,
          totalRunesEarned,
          pendingNextModifier,
          enragedTurns,
          upgradedCards,
          runRunes,
        };
        await AsyncStorage.setItem(`@runeboundduel:run_${deviceId}`, JSON.stringify(data));
      } catch (error) {
        console.log('Error saving run state:', error);
      }
    };
    saveRunState();
  }, [deviceId, hasActiveRun, deck, hand, discard, playerHP, playerMaxHp, combatCount,
      diceCollection, cardCollection, equippedCardIds, equippedDice, usedScenarioIds,
      enemyHP, enemyMaxHP, enemyDamage, encounterType, phase, dice, rollsLeft, message,
      screen, shield, statusEffects, lockedCards, currentLevel, levelCombatCount,
      chaosModifier, usedModifierIds, levelRunesEarned, totalRunesEarned, pendingNextModifier,
      enragedTurns, upgradedCards, runRunes]);

  // ── Main Menu Navigation Helpers ──────────────────────────────────────────
  const clearRunState = async () => {
    if (!deviceId) return;
    try {
      await AsyncStorage.removeItem(`@runeboundduel:run_${deviceId}`);
    } catch (error) {
      console.log('Error clearing run state:', error);
    }
    // Reset all ephemeral run state
    setDeck([]);
    setHand([]);
    setDiscard([]);
    setPlayerHP(PLAYER_MAX_HP + pHpBonus);
    setPlayerMaxHp(PLAYER_MAX_HP + pHpBonus);
    setCombatCount(0);
    setDiceCollection(initialCollection());
    setCardCollection(BASE_CARD_COLLECTION);
    setEquippedCardIds([]);
    setEquippedDice([]);
    setUsedScenarioIds([]);
    setEnemyHP(ENEMY_MAX_HP);
    setEnemyMaxHP(ENEMY_MAX_HP);
    setEnemyDamage(ENEMY_ATTACK);
    setEncounterType('regular');
    setPhase('player');
    setDice([]);
    setRollsLeft(MAX_ROLLS);
    setMessage('');
    setShield(0);
    setStatusEffects({ shield: false, rage: { active: false, turnsLeft: 0 }, curse: { active: false } });
    setLockedCards([]);
    setCurrentLevel(1);
    setLevelCombatCount(0);
    setChaosModifier(null);
    setUsedModifierIds([]);
    setLevelRunesEarned(0);
    setTotalRunesEarned(0);
    setPendingNextModifier(null);
    setEnragedTurns(0);
    setShowBribeScreen(false);
    setEnemyDotDmg(0);
    setEnemyDotTurns(0);
    setEnemyFrozenTurns(0);
    setEnemies([]);
    setSelectedEnemyIdx(0);
    setUpgradedCards({});
    setRunRunes(0);
    setBossSouls(0);
    setActiveBuffs([]);
    setShowBuffShop(false);
    setPendingNewBuff(null);
    setShowDropBuff(false);
    setTitanAttackCount(0);
    setDivineGraceUsed(false);
    setPurchasedBuffIds([]);
    setHasActiveRun(false);
  };

  const handleStartNewRun = async () => {
    await clearRunState();
    startNewRun(); // Apply shrine bonuses and build proper collections
  };

  const handleContinueRun = () => {
    if (hasActiveRun) {
      setScreen(lastRunScreen);
    } else {
      setScreen('equip');
    }
  };

  const handleMainMenuFromCombat = () => {
    // Run state is automatically saved by the useEffect
    setScreen('mainMenu');
  };

  function handleLevelComplete() {
    const nextLevel = currentLevel + 1;
    const currentUsedIds = chaosModifier ? [...usedModifierIds, chaosModifier.id] : [...usedModifierIds];
    const nextModifier = pickModifierForLevel(nextLevel, currentUsedIds);
    setCurrentLevel(nextLevel);
    setLevelCombatCount(0);
    setChaosModifier(null); // will be set when entering next level
    setPendingNextModifier(nextModifier);
    setPlayerHP(playerMaxHp); // FULL HP restore on level complete
    // Note: levelRunesEarned is NOT reset here so the screen can display it
    setScreen('levelComplete');
  }

  function handleEnterNextLevel() {
    const modifier = pendingNextModifier;
    if (modifier) {
      setUsedModifierIds(prev => [...prev, modifier.id]);
    }
    setChaosModifier(modifier);
    setPendingNextModifier(null);
    setLevelRunesEarned(0); // Reset for next level
    setScreen('levelStart');
  }

  // ── Buff Shop handlers ────────────────────────────────────────────────────

  function handleCloseBuffShop() {
    setShowBuffShop(false);
    setPhase('cardReward');
  }

  function handleBuyBuff(buff) {
    if (bossSouls < buff.cost) return;
    if (purchasedBuffIds.includes(buff.id)) return;
    setBossSouls(prev => prev - buff.cost);
    setPurchasedBuffIds(prev => [...prev, buff.id]);
    // Immediate permanent stat effects
    if (buff.id === 'vitality') {
      setPlayerMaxHp(prev => { const n = prev + 20; setPlayerHP(hp => Math.min(hp + 20, n)); return n; });
    } else if (buff.id === 'warCrown') {
      setPlayerMaxHp(prev => { const n = prev + 20; setPlayerHP(hp => Math.min(hp + 20, n)); return n; });
    } else if (buff.id === 'soulHarvest') {
      setPlayerMaxHp(prev => { const n = Math.max(1, prev - 40); setPlayerHP(hp => Math.min(hp, n)); return n; });
    }
    if (activeBuffs.length >= 3) {
      setPendingNewBuff(buff);
      setShowDropBuff(true);
    } else {
      setActiveBuffs(prev => [...prev, buff]);
    }
  }

  function handleDropBuff(dropId) {
    setActiveBuffs(prev => [...prev.filter(b => b.id !== dropId), pendingNewBuff]);
    setPendingNewBuff(null);
    setShowDropBuff(false);
  }

  // ── Card upgrade handler ──────────────────────────────────────────────────

  function handleUpgradeCard(baseId, currentId, nextId, cost) {
    if (!cost || runRunes < cost) return;

    // Deduct from in-run rune pool
    setRunRunes(prev => prev - cost);

    // Get upgraded card display info
    const upgradedDef = CARD_MAP[nextId];
    if (!upgradedDef) return;
    const upgradedDisplay = cardDisplayInfo(upgradedDef);

    // Update all instances in the collection that belong to this base card
    setCardCollection(prev => prev.map(inst => {
      const instBase = getBaseCardId(inst.id);
      return instBase === baseId ? { ...inst, ...upgradedDisplay } : inst;
    }));

    // Persist permanently: base card ID → current upgraded card ID
    setUpgradedCards(prev => ({ ...prev, [baseId]: nextId }));
  }

  // ── Bribe system helpers ──────────────────────────────────────────────────

  function triggerBribeFlash(color) {
    setBribeFlashColor(color);
    bribeFlashAnim.setValue(0.7);
    Animated.timing(bribeFlashAnim, { toValue: 0, duration: 900, useNativeDriver: true }).start();
  }

  function triggerShake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  }

  // Play a player GIF for `duration` ms then return to idle
  function playPlayerAnim(anim, duration) {
    setPlayerAnim(anim);
    setPlayerAnimKey(k => k + 1);
    setTimeout(() => { setPlayerAnim('idle'); setPlayerAnimKey(k => k + 1); }, duration);
  }

  // Play a minion GIF state for `duration` ms then return to idle (pass null duration to stay)
  function setEnemyGifAnim(id, anim, duration) {
    setEnemies(prev => prev.map(e =>
      e.id === id ? { ...e, gifAnim: anim, gifKey: (e.gifKey || 0) + 1 } : e
    ));
    if (duration) {
      setTimeout(() => {
        setEnemies(prev => prev.map(e =>
          e.id === id ? { ...e, gifAnim: 'idle', gifKey: (e.gifKey || 0) + 1 } : e
        ));
      }, duration);
    }
  }

  function handleBribeAttempt(goldAmount) {
    const chance = getBribeChance(goldAmount, encounterType);
    setRunRunes(prev => prev - goldAmount);   // deduct from in-run pool regardless
    setShowBribeScreen(false);
    setBribeUsed(true);

    if (Math.random() * 100 < chance) {
      // ── SUCCESS ──
      setMessage('He takes the runes and walks away... 🏃');
      const newLevelCombatCount = levelCombatCount + 1;
      setLevelCombatCount(prev => prev + 1);
      setCombatCount(prev => prev + 1);
      triggerBribeFlash('success');
      if (encounterType === 'boss' && currentLevel === 10) {
        setScreen('runComplete');
      } else if (encounterType === 'boss') {
        // Combat 10 bribe success → show shop, then level complete
        setPostShopAction('levelComplete');
        setPhase('player');
        setScreen('upgradeShop');
      } else if (newLevelCombatCount === 5) {
        // Combat 5 bribe success → show shop, then next encounter
        setPostShopAction('nextEncounter');
        setPhase('player');
        setScreen('upgradeShop');
      } else {
        startNextEncounter();
      }
    } else {
      // ── FAIL ── runes will be refunded if player wins this combat
      setBribeRefundAmount(goldAmount);
      setEnragedTurns(2);
      triggerBribeFlash('fail');
      triggerShake();
      setMessage('He laughs and attacks in rage! 😡');
    }
  }

  const goToEquipFromMainMenu = () => {
    setEquipFromScreen('mainMenu');
    setScreen('equip');
  };

  const goToEquipFromPreCombat = () => {
    setEquipFromScreen('preCombat');
    setScreen('equip');
  };

  // ── Enemy animation helpers ───────────────────────────────────────────────

  function getEnemyAnims(id) {
    if (!enemyAnims.current.has(id)) {
      enemyAnims.current.set(id, {
        lunge:        new Animated.Value(0),
        glowOpacity:  new Animated.Value(0),
        deathOpacity: new Animated.Value(1),
        deathFlash:   new Animated.Value(0),
        slashOpacity: new Animated.Value(0),
        slashScale:   new Animated.Value(1),
      });
    }
    return enemyAnims.current.get(id);
  }

  function playSlash(opacityAnim, scaleAnim) {
    opacityAnim.setValue(1);
    scaleAnim.setValue(0.2);
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 1.5, duration: 160, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();
  }

  function playEnemyDeath(enemyId, onDone) {
    // gifAnim is already set to 'dying' before this is called
    // Wait for dying GIF to finish (adjust DYING_GIF_MS if GIFs are longer/shorter)
    const DYING_GIF_MS = 1950; // exact duration of dying GIFs (15 frames × 130ms)
    setTimeout(onDone, DYING_GIF_MS);
  }

  function addFloatingDamage(value) {
    const id  = Date.now() + Math.random();
    const fdY = new Animated.Value(0);
    const fdO = new Animated.Value(1);
    setFloatingDamages(prev => [...prev, { id, value, y: fdY, opacity: fdO }]);
    Animated.parallel([
      Animated.timing(fdY, { toValue: -44, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(fdO, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => setFloatingDamages(prev => prev.filter(f => f.id !== id)));
  }

  function addEnemyFloatingDamage(enemyId, value) {
    const id  = Date.now() + Math.random();
    const fdY = new Animated.Value(0);
    const fdO = new Animated.Value(1);
    setEnemyFloatingDamages(prev => [...prev, { id, enemyId, value, y: fdY, opacity: fdO }]);
    Animated.parallel([
      Animated.timing(fdY, { toValue: -44, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(fdO, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => setEnemyFloatingDamages(prev => prev.filter(f => f.id !== id)));
  }

  // ── Divine Grace: free full reroll once per combat ───────────────────────

  function handleDivineGrace() {
    if (!hasBuff('divineGrace') || divineGraceUsed) return;
    setDivineGraceUsed(true);
    const next = dice.map(d => {
      if (d.used) return d;
      if (d.dieId === 'legendary_die' && d.val !== null) return d;
      return { ...d, val: rollDie(d.dieId) };
    });
    setDice(next);
    setMessage('🌟 Divine Luck! All dice rerolled for free!');
  }

  // ── Roll ──────────────────────────────────────────────────────────────────

  function rollDice() {
    if (rollsLeft <= 0) {
      setMessage('No rolls left! Play a card or end your turn.');
      return;
    }

    playDiceSound();

    // Reset all animation values
    diceRotations.forEach(rot => rot.setValue(0));

    // Determine which dice are being rolled
    const isRolling = dice.map((d, i) => !d.used && !(d.dieId === 'legendary_die' && d.val !== null));
    setDiceAnimating(isRolling);

    // Animate rolling dice
    const animations = isRolling.map((rolling, i) => {
      if (!rolling) return null;
      return Animated.timing(diceRotations[i], {
        toValue: 10,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    }).filter(Boolean);

    if (animations.length > 0) {
      Animated.parallel(animations).start(() => {
        setDiceAnimating([false, false, false]);
      });
    }

    const next = dice.map((d) => {
      if (d.used) return d;
      if (d.dieId === 'legendary_die' && d.val !== null) return d; // can never be rerolled
      let val = rollDie(d.dieId);
      if (d.dieId === 'explosion' && val === 6) {
        val = 6 + rollDie('standard');
      }
      return { ...d, val };
    });

    // Chaos: Reverse Dice — 6 becomes 1, 1 becomes 6, etc.
    if (chaosModifier?.id === 'reverseDice') {
      next.forEach((d, i) => {
        if (!d.used && d.val !== null) next[i] = { ...next[i], val: 7 - d.val };
      });
    }
    // Chaos: Dice Frenzy — double all roll values
    if (chaosModifier?.id === 'diceFrenzy') {
      next.forEach((d, i) => {
        if (!d.used && d.val !== null) next[i] = { ...next[i], val: d.val * 2 };
      });
    }
    // Chaos: Chaos Dice — force to 1, 3, or 6 only
    if (chaosModifier?.id === 'chaosDice') {
      const chaosFaces = [1, 3, 6];
      next.forEach((d, i) => {
        if (!d.used && d.val !== null) next[i] = { ...next[i], val: chaosFaces[Math.floor(Math.random() * 3)] };
      });
    }

    // Handle boss Void Curse: force all dice to their minimum value, no rerolls
    if (voidCursed) {
      const voidMin = { standard: 1, heavy: 3, lucky: 3, legendary_die: 6, death: 1 };
      next.forEach((d, i) => {
        if (!d.used) next[i].val = voidMin[d.dieId] ?? 1;
      });
      setDice(next);
      setRollsLeft(0);
      setVoidCursed(false);
      setDiceAnimating([false, false, false]);
      setMessage(`🌀 Void Curse! Minimum values forced. No rerolls this turn!`);
      return;
    }
    // Handle mini boss Curse: force one random die to reroll (random value)
    else if (statusEffects.curse.active && next.some((d) => !d.used && d.val !== null)) {
      const curseIdx = next.findIndex((d) => !d.used && d.val !== null);
      if (curseIdx !== -1) {
        next[curseIdx].val = rnd6();
        setStatusEffects(prev => ({ ...prev, curse: { active: false } }));
      }
    }

    // Mirror die: copies highest value from other two dice
    const mirrorIdx = next.findIndex((d) => d.dieId === 'mirror' && !d.used && d.val !== null);
    if (mirrorIdx !== -1) {
      const otherVals = next
        .filter((d, i) => i !== mirrorIdx && !d.used && d.val !== null)
        .map((d) => d.val);
      if (otherVals.length > 0) {
        next[mirrorIdx].val = Math.max(...otherVals);
      }
    }

    // Vampire die: heal HP equal to roll value
    const vampireVals = next
      .filter((d) => d.dieId === 'vampire' && !d.used && d.val !== null)
      .map((d) => d.val);
    let totalHeal = vampireVals.reduce((sum, val) => sum + val, 0);
    if (totalHeal > 0) {
      const newHP = Math.min(playerMaxHp, playerHP + totalHeal);
      setPlayerHP(newHP);
    }

    // Buff: Star Blessed — legendary dice always 6, epic dice always 5+
    if (hasBuff('starBlessed')) {
      const epicIds = ['mirror', 'vampire', 'storm'];
      next.forEach((d, i) => {
        if (d.used) return;
        if (d.dieId === 'legendary_die') next[i] = { ...next[i], val: 6 };
        else if (epicIds.includes(d.dieId) && (next[i].val ?? 0) < 5) next[i] = { ...next[i], val: 5 };
      });
    }
    // Buff: Chaos Embrace — all dice roll 1, 3 or 6 only
    if (hasBuff('chaosEmbrace')) {
      const cFaces = [1, 3, 6];
      next.forEach((d, i) => {
        if (!d.used && d.val !== null) next[i] = { ...next[i], val: cFaces[Math.floor(Math.random() * 3)] };
      });
    }

    // Storm die: show picker with two roll options
    const stormIdx = next.findIndex((d) => d.dieId === 'storm' && !d.used);
    if (stormIdx !== -1) {
      const roll1 = next[stormIdx].val;
      const roll2 = rollDie('standard');
      setWeightedPickerDie({ idx: stormIdx, type: 'storm', rolls: [roll1, roll2] });
    }

    // Weighted die: show picker after roll
    const wIdx = next.findIndex((d) => d.dieId === 'weighted' && !d.used);
    if (wIdx !== -1 && stormIdx === -1) {
      setWeightedPickerDie({ idx: wIdx, type: 'weighted' });
    }

    const remaining = rollsLeft - 1;
    setDice(next);
    setRollsLeft(remaining);
    const healMsg = totalHeal > 0 ? ` Vampire healed ${totalHeal} HP!` : '';
    setMessage(`Rolled! ${remaining} roll${remaining !== 1 ? 's' : ''} remaining${healMsg}`);
  }

  // ── Play card ─────────────────────────────────────────────────────────────

  function playCard(card, cardInstId) {
    // Precision buff: cards needing specific values accept 1 lower
    const checkDice = hasBuff('precision')
      ? dice.map(d => (!d.used && d.val !== null) ? { ...d, val: Math.min(d.val + 1, 6) } : d)
      : dice;
    if (!card.canPlay(checkDice)) {
      setMessage(`Can't play — needs: ${card.req}`);
      return;
    }

    if (lockedCards.includes(cardInstId)) {
      setMessage(`🔒 This card is locked by the Mini Boss!`);
      return;
    }

    const ctx = { lastCardId, cardsPlayedThisTurn, lastCardResult };
    const result = card.play(dice, ctx);

    let newEnemyHP  = enemyHP;
    let newPlayerHP = playerHP;
    let newShield   = shield + (result.shield ?? 0);
    let newEnemyShield = enemyShield;
    let abilityEffectMsg = '';

    if (result.enemyDmg) {
      // Apply buff damage multipliers
      let dmgMult = 1;
      if (hasBuff('sharpness'))    dmgMult *= 1.1;
      if (hasBuff('critMastery'))  dmgMult *= 1.15;
      if (hasBuff('warCrown'))     dmgMult *= 1.3;
      if (hasBuff('deathPact'))    dmgMult *= 1.5;
      if (hasBuff('bloodFrenzy'))  dmgMult *= 1.4;
      if (hasBuff('chaosEmbrace')) dmgMult *= 1.35;
      if (hasBuff('glassCanon'))   dmgMult *= 3;
      if (hasBuff('berserkerOath')) {
        dmgMult *= playerHP <= playerMaxHp * 0.3 ? 1.6 : 0.7;
      }
      result.enemyDmg = Math.round(result.enemyDmg * dmgMult);

      // Titan Strength: every 3rd attack auto-crits
      if (hasBuff('titanStrength')) {
        const newCount = titanAttackCount + 1;
        setTitanAttackCount(newCount);
        if (newCount % 3 === 0) {
          const critMult = hasBuff('critMastery') ? 3 : 2;
          result.enemyDmg = Math.round(result.enemyDmg * critMult);
          abilityEffectMsg += ' 🔱 Titan Crit!';
        }
      }

      let dmgToEnemy = result.enemyDmg;
      if (dmgToEnemy > 0) playPlayerAnim('attacking', 700);

      if (enemies.length > 0) {
        // ── Multi-enemy (regular combat) ──────────────────────────────────
        const isAoe = ['thunder_combo', 'chaos_nova'].includes(card.id) ||
                      ['thunder_combo', 'chaos_nova'].includes(getBaseCardId(card.id));
        const newEnemiesArr = enemies.map(e => ({ ...e }));

        if (isAoe) {
          // AoE: hit all living enemies
          newEnemiesArr.forEach((e, i) => {
            if (e.hp <= 0) return;
            const abs = Math.min(e.shield, dmgToEnemy);
            const actualDmg = dmgToEnemy - abs;
            const willDie = e.hp - actualDmg <= 0;
            newEnemiesArr[i] = { ...e, hp: Math.max(0, e.hp - actualDmg), shield: Math.max(0, e.shield - abs),
              gifAnim: actualDmg > 0 ? (willDie ? 'dying' : 'hurt') : e.gifAnim,
              gifKey: actualDmg > 0 ? (e.gifKey || 0) + 1 : e.gifKey,
            };
            if (actualDmg > 0) {
              const ea = getEnemyAnims(e.id);
              playSlash(ea.slashOpacity, ea.slashScale);
              addEnemyFloatingDamage(e.id, actualDmg);
              if (!willDie) {
                const eid = e.id;
                setTimeout(() => setEnemies(prev => prev.map(en => en.id === eid ? { ...en, gifAnim: 'idle', gifKey: (en.gifKey || 0) + 1 } : en)), 500);
              }
            }
          });
        } else {
          // Single target: hit selected enemy (resolve stale index if needed)
          let ti = selectedEnemyIdx;
          if (!newEnemiesArr[ti] || newEnemiesArr[ti].hp <= 0) {
            ti = newEnemiesArr.findIndex(e => e.hp > 0);
          }
          if (ti >= 0) {
            const abs = Math.min(newEnemiesArr[ti].shield, dmgToEnemy);
            const actualDmg = dmgToEnemy - abs;
            const willDie = newEnemiesArr[ti].hp - actualDmg <= 0 && enemies[ti]?.hp > 0;
            newEnemiesArr[ti] = { ...newEnemiesArr[ti], hp: Math.max(0, newEnemiesArr[ti].hp - actualDmg), shield: Math.max(0, newEnemiesArr[ti].shield - abs),
              gifAnim: actualDmg > 0 ? (willDie ? 'dying' : 'hurt') : newEnemiesArr[ti].gifAnim,
              gifKey: actualDmg > 0 ? (newEnemiesArr[ti].gifKey || 0) + 1 : newEnemiesArr[ti].gifKey,
            };
            dmgToEnemy = actualDmg; // for lifebond calc
            if (actualDmg > 0) {
              const ea = getEnemyAnims(newEnemiesArr[ti].id);
              playSlash(ea.slashOpacity, ea.slashScale);
              addEnemyFloatingDamage(newEnemiesArr[ti].id, actualDmg);
              if (!willDie) {
                const eid = newEnemiesArr[ti].id;
                setTimeout(() => setEnemies(prev => prev.map(en => en.id === eid ? { ...en, gifAnim: 'idle', gifKey: (en.gifKey || 0) + 1 } : en)), 500);
              }
            }
            // Individual death animation (if not all dead — all-dead handled below)
            const justDied = newEnemiesArr[ti].hp <= 0 && enemies[ti]?.hp > 0;
            if (justDied) {
              const dId = newEnemiesArr[ti].id;
              setDyingEnemyIds(prev => new Set([...prev, dId]));
              playEnemyDeath(dId, () => {
                setDyingEnemyIds(prev => { const n = new Set(prev); n.delete(dId); return n; });
              });
            }
          }
        }

        setEnemies(newEnemiesArr);
        const allDead = newEnemiesArr.every(e => e.hp <= 0);
        newEnemyHP = allDead ? 0 : 1; // triggers kill detection when all die

        // AoE individual death animations (non-allDead case handled here; allDead handled in kill block below)
        if (isAoe && !allDead) {
          newEnemiesArr.forEach((e, i) => {
            if (e.hp <= 0 && enemies[i]?.hp > 0) {
              const dId = e.id;
              setDyingEnemyIds(prev => new Set([...prev, dId]));
              playEnemyDeath(dId, () => {
                setDyingEnemyIds(prev => { const n = new Set(prev); n.delete(dId); return n; });
              });
            }
          });
        }

        if (!allDead && newEnemiesArr[selectedEnemyIdx]?.hp <= 0) {
          const nxt = newEnemiesArr.findIndex(e => e.hp > 0);
          if (nxt >= 0) setSelectedEnemyIdx(nxt);
        }

        // Lifebond (single-target only in multi-enemy mode)
        if (!isAoe && hasBuff('lifebond') && dmgToEnemy > 0 && !hasBuff('deathPact')) {
          const lbHeal = Math.max(1, Math.round(dmgToEnemy * 0.1));
          newPlayerHP = Math.min(playerMaxHp, newPlayerHP + lbHeal);
        }
      } else {
        // ── Single enemy (boss / miniBoss) ────────────────────────────────
        // Mirror: reflect 50% of damage dealt back to player (before shield reduction)
        if (activeAbilities.some(a => a.id === 'mirror')) {
          const reflectedDmg = Math.floor(result.enemyDmg * 0.5);
          newPlayerHP = Math.max(0, newPlayerHP - reflectedDmg);
          abilityEffectMsg += ` 🔄 Mirror! ${reflectedDmg} reflected!`;
        }

        // Shield absorbs damage before HP
        if (newEnemyShield > 0) {
          const absorbed = Math.min(newEnemyShield, dmgToEnemy);
          dmgToEnemy -= absorbed;
          newEnemyShield -= absorbed;
        }
        newEnemyHP = Math.max(0, enemyHP - dmgToEnemy);

        // Chaos: Vampire Rules — enemy heals 50% of damage dealt (only if not dead)
        if (chaosModifier?.id === 'vampireRules' && newEnemyHP > 0) {
          const vampHeal = Math.floor(result.enemyDmg * 0.5);
          newEnemyHP = Math.min(enemyMaxHP, newEnemyHP + vampHeal);
          abilityEffectMsg += ` 🩸 +${vampHeal}!`;
        }

        // Lifebond: heal 10% of damage dealt
        if (hasBuff('lifebond') && dmgToEnemy > 0 && !hasBuff('deathPact')) {
          const lbHeal = Math.max(1, Math.round(dmgToEnemy * 0.1));
          newPlayerHP = Math.min(playerMaxHp, newPlayerHP + lbHeal);
        }
      }

      // Track for Death Mark (use ref for synchronous access in triggerEnemyTurn)
      damageDealtThisTurnRef.current += result.enemyDmg;
    } else {
      // Chaos: Death Touch — no damage dealt → player takes 5 penalty
      if (chaosModifier?.id === 'deathTouch') {
        newPlayerHP = Math.max(0, newPlayerHP - 5);
        abilityEffectMsg += ` 💀 Death Touch! -5 HP!`;
      }
    }
    if (result.playerDmg)  newPlayerHP = Math.max(0, playerHP - result.playerDmg);
    if (result.playerHeal && !hasBuff('deathPact')) newPlayerHP = Math.min(playerMaxHp, newPlayerHP + result.playerHeal);

    const newHand = hand.filter((id) => id !== cardInstId);
    const newDiscard = [...discard, cardInstId];

    // Apply DoT (poison/burn) from upgraded card effects
    if (result.enemyDot) {
      setEnemyDotDmg(result.enemyDot.dmg);
      setEnemyDotTurns(prev => prev + result.enemyDot.turns);
      setEnemyDotType(result.enemyDot.type || 'poison');
    }
    // Apply Freeze from upgraded card effects
    if (result.enemyFreeze) {
      setEnemyFrozenTurns(prev => prev + result.enemyFreeze);
    }

    setDice(result.dice);
    setEnemyHP(newEnemyHP);
    setPlayerHP(newPlayerHP);
    setShield(newShield);
    setEnemyShield(newEnemyShield);
    setHand(newHand);
    setDiscard(newDiscard);
    setCardsPlayedThisTurn((prev) => prev + 1);
    setLastCardId(card.id);
    setLastCardResult(result);
    if (result.enemyDmg) {
      if (hitSoundRef.current) {
        hitSoundRef.current.setPositionAsync(0)
          .then(() => hitSoundRef.current?.playAsync())
          .catch(() => {});
      }
    }
    setMessage(result.msg + abilityEffectMsg);

    if (newEnemyHP <= 0) {
      // Award runes: 10 base + bonus for elite enemies
      const runesBase = 10
        + (encounterType === 'miniBoss' ? 20 : 0)
        + (encounterType === 'boss'     ? 50 : 0);
      // Chaos: Gold Curse — no runes for regular enemies
      const earnedRunes = (chaosModifier?.id === 'goldCurse' && encounterType === 'regular') ? 0 : runesBase;
      if (earnedRunes > 0) {
        setRunRunes(prev => prev + earnedRunes);
        setLevelRunesEarned(prev => prev + earnedRunes);
        setTotalRunesEarned(prev => prev + earnedRunes);
      }
      // Refund bribe runes if the player won after a failed bribe
      if (bribeRefundAmount > 0) {
        setRunRunes(prev => prev + bribeRefundAmount);
        setBribeRefundAmount(0);
        setMessage(`💰 Bribe refunded! +${bribeRefundAmount} runes returned.`);
      }
      // Soul Harvest: heal 20 HP on any kill
      if (hasBuff('soulHarvest') && !hasBuff('deathPact')) {
        newPlayerHP = Math.min(playerMaxHp, newPlayerHP + 20);
      }
      // Chain Reaction: overflow damage from killing blow → bonus runes (single-enemy only)
      if (hasBuff('chainReaction') && result.enemyDmg && enemies.length === 0) {
        const overflow = Math.abs(Math.min(0, enemyHP - result.enemyDmg));
        if (overflow > 0) {
          const bonusRunes = Math.floor(overflow * 0.2);
          if (bonusRunes > 0) {
            setRunRunes(prev => prev + bonusRunes);
            abilityEffectMsg += ` ⚡ +${bonusRunes} chain runes!`;
          }
        }
      }
      setLevelCombatCount(prev => prev + 1);
      setCombatCount(prev => prev + 1);
      if (encounterType === 'boss' && currentLevel === 10) {
        setScreen('runComplete');
      } else if (encounterType === 'boss') {
        // Award Boss Souls and open buff shop
        const soulsEarned = 1 + (hasBuff('soulFinder') ? 1 : 0);
        setBossSouls(prev => prev + soulsEarned);
        setShowBuffShop(true);
      } else if (enemies.length > 0) {
        // Multi-enemy: wait for ALL dying GIFs to finish, then show reward
        const newlyDead = enemies.filter(e => e.hp > 0);
        const dyingSet = new Set(newlyDead.map(e => e.id));
        setDyingEnemyIds(dyingSet);
        let doneCount = 0;
        const total = newlyDead.length;
        const onOneDead = () => {
          doneCount++;
          if (doneCount >= total) {
            victoryFlashAnim.setValue(0.45);
            Animated.timing(victoryFlashAnim, { toValue: 0, duration: 700, useNativeDriver: true }).start();
            setDyingEnemyIds(new Set());
            setPhase('cardReward');
          }
        };
        newlyDead.forEach(e => {
          playEnemyDeath(e.id, onOneDead);
        });
      } else {
        setPhase('cardReward');
      }
      return;
    }
    if (newPlayerHP <= 0) { setPhase('lose'); return; }

    // Turn only ends manually via the End Turn button
  }

  // ── Multi-enemy turn (regular combat) ────────────────────────────────────

  function triggerMultiEnemyTurn(currentPlayerHP = playerHP, currentShield = shield, currentHand = hand, currentDiscard = discard) {
    const livingEnemies = enemies
      .map((e, arrIdx) => ({ ...e, arrIdx }))
      .filter(e => e.hp > 0);

    if (livingEnemies.length === 0) return;

    setEnemyRolling(true);
    setHoveredCardId(null);
    damageDealtThisTurnRef.current = 0;

    // ── DoT tick: applied to selected enemy before attacks ──
    let startHP = currentPlayerHP;
    let startShield = currentShield;
    let livArr = [...enemies]; // mutable copy for DoT/freeze

    if (enemyDotTurns > 0) {
      const ti = selectedEnemyIdx;
      if (livArr[ti] && livArr[ti].hp > 0) {
        const newTargetHP = Math.max(0, livArr[ti].hp - enemyDotDmg);
        livArr = livArr.map((e, i) => i === ti ? { ...e, hp: newTargetHP } : e);
        setEnemyDotTurns(prev => Math.max(0, prev - 1));
        if (livArr.every(e => e.hp <= 0)) {
          setEnemies(livArr);
          setEnemyRolling(false);
          const earnedRunes = chaosModifier?.id === 'goldCurse' ? 0 : 10;
          if (earnedRunes > 0) {
            setRunRunes(pr => pr + earnedRunes);
            setLevelRunesEarned(pr => pr + earnedRunes);
            setTotalRunesEarned(pr => pr + earnedRunes);
          }
          setLevelCombatCount(pr => pr + 1);
          setCombatCount(pr => pr + 1);
          setPhase('cardReward');
          return;
        }
        setEnemies(livArr);
      } else {
        setEnemyDotTurns(prev => Math.max(0, prev - 1));
      }
    }

    // ── Freeze: all enemies skip their turn ──
    if (enemyFrozenTurns > 0) {
      setEnemyFrozenTurns(prev => Math.max(0, prev - 1));
      setEnemyRolling(false);
      const { hand: refHand, deck: newDeck, discard: newDiscard } = refillHand(deck, currentHand, currentDiscard, handSize());
      const fDrawn = refHand.filter(id => !currentHand.includes(id));
      triggerCardDraw(fDrawn);
      setDice(makeFreshDice(equippedDice));
      setRollsLeft(rollsPerTurn());
      setHand(refHand);
      setDeck(newDeck);
      setDiscard(newDiscard);
      setCardsPlayedThisTurn(0);
      setLockedCards([]);
      setMessage('❄️ Enemies are frozen! They skip their turn.');
      setEnemies(prev => prev.map(e => e.hp > 0 ? { ...e, intention: determineIntention('regular') } : e));
      return;
    }

    // Reset all enemy shields at start of their turn (same as single-enemy flow)
    livArr = livArr.map(e => ({ ...e, shield: 0 }));
    setEnemies(livArr);

    // Re-derive living enemies after DoT (in case one died)
    const attackerList = livArr
      .map((e, arrIdx) => ({ ...e, arrIdx }))
      .filter(e => e.hp > 0);

    const attackEnemy = (listIdx, hp, shld) => {
      if (hp <= 0) {
        setPhase('lose');
        setEnemyRolling(false);
        return;
      }
      if (listIdx >= attackerList.length) {
        // All enemies done attacking — apply passive buffs
        let finalHP = hp;
        if (hasBuff('bloodFrenzy') && finalHP > 0) finalHP = Math.max(0, finalHP - 8);
        if (hasBuff('regeneration') && finalHP > 0 && !hasBuff('deathPact')) finalHP = Math.min(playerMaxHp, finalHP + 3);
        setPlayerHP(finalHP);
        setShield(0);
        setEnemyRolling(false);
        if (finalHP <= 0) { setPhase('lose'); return; }

        // Refill hand + reset dice
        const { hand: refHand, deck: newDeck, discard: newDiscard } = refillHand(deck, currentHand, currentDiscard, handSize());
        const drawnIds = refHand.filter(id => !currentHand.includes(id));
        triggerCardDraw(drawnIds);
        setDice(makeFreshDice(equippedDice));
        setRollsLeft(rollsPerTurn());
        setHand(refHand);
        setDeck(newDeck);
        setDiscard(newDiscard);
        setCardsPlayedThisTurn(0);

        if (chaosModifier?.id === 'cardLock' && refHand.length > 0) {
          setLockedCards([refHand[Math.floor(Math.random() * refHand.length)]]);
        } else {
          setLockedCards([]);
        }

        // Update enrage
        if (enragedTurns > 0) setEnragedTurns(prev => Math.max(0, prev - 1));

        // Set new intentions for living enemies
        setEnemies(prev => prev.map(e => e.hp > 0 ? { ...e, intention: determineIntention('regular') } : e));
        setMessage('Your turn — roll!');
        return;
      }

      const enemy = attackerList[listIdx];
      const diceVals = rollEnemyDice();
      const sum = diceVals.reduce((a, b) => a + b, 0);

      const intention = enemy.intention || 'attack';
      setEnemyDice(diceVals);
      setEnemyDiceSum(sum);
      setShowingEnemyRoll(true);
      setEnemyRollStatus(getEnemyRollStatus(sum, intention));

      setTimeout(() => {
        const rollStatus = getEnemyRollStatus(sum, intention);
        const numAlive = attackerList.length;
        const enm = numAlive > 1 ? `${enemy.icon} Enemy ${listIdx + 1}/${numAlive}` : `${enemy.icon} Enemy`;

        if (intention === 'defence') {
          // Enemy shields up instead of attacking — no lunge for defence
          let shieldGained = 0;
          if (rollStatus.status === 'Defence') {
            shieldGained = enemy.damage;
          } else if (rollStatus.status === 'StrongDefence') {
            shieldGained = enemy.damage * 2;
          }
          if (shieldGained > 0) {
            setEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, shield: e.shield + shieldGained } : e));
          }
          setMessage(`${enm} rolls ${sum} (${rollStatus.label})${shieldGained > 0 ? ` — gains ${shieldGained} shield!` : '!'}`);
          setTimeout(() => { attackEnemy(listIdx + 1, hp, shld); }, 350);
          return;
        }

        // Compute damage
        let dmg = enemy.damage;
        if (rollStatus.status === 'Miss') {
          dmg = 0;
        } else if (rollStatus.status === 'Crit') {
          dmg *= 2;
          if (hasBuff('glassCanon') && dmg > 0) {
            setPlayerHP(0); setEnemyRolling(false); setPhase('lose'); return;
          }
        }
        if (chaosModifier?.id === 'speedRound' && dmg > 0) dmg *= 2;
        if (enragedTurns > 0 && dmg > 0) dmg *= 2;
        const absorbed = Math.min(shld, dmg);
        const remainingShield = shld - absorbed;
        dmg = Math.max(0, dmg - absorbed);
        if (hasBuff('ironSkin') && dmg > 0) dmg = Math.max(0, Math.round(dmg * 0.9));
        const newHP = Math.max(0, hp - dmg);

        // ── 1. Attack animation (GIF) ───────────────────────────────────────
        if (dmg > 0) setEnemyGifAnim(enemy.id, 'attacking', 500);
        setTimeout(() => {
          // ── 2. Apply damage + slash animation ──────────────────────────
          const isMiss = rollStatus.status === 'Miss';
          setPlayerHP(newHP);
          setShield(remainingShield);
          setMessage(`${enm} rolls ${sum} (${rollStatus.label})${dmg > 0 ? ` — ${dmg} dmg!` : '!'}`);
          if (!isMiss && dmg > 0) {
            playSlash(playerSlashOpacity, playerSlashScale);
            playerHitFlash.setValue(0.75);
            Animated.timing(playerHitFlash, { toValue: 0, duration: 500, useNativeDriver: true }).start();
            addFloatingDamage(dmg);
            playPlayerAnim('hurt', 600);
          }
          setTimeout(() => { attackEnemy(listIdx + 1, newHP, remainingShield); }, 350);
        });
      }, 400);
    };

    attackEnemy(0, startHP, startShield);
  }

  // ── Enemy turn ────────────────────────────────────────────────────────────

  function applyAbilityEffect(ability, currentHand, newStatusEffects, newLockedCards, abilityTurns) {
    let shieldGain = 0;
    if (ability.id === 'lock' && currentHand.length > 0) {
      newLockedCards.push(currentHand[Math.floor(Math.random() * currentHand.length)]);
    } else if (ability.id === 'curse') {
      newStatusEffects.curse.active = true;
    } else if (ability.id === 'shield') {
      // Enemy gains 30% of max HP as a shield against player attacks
      shieldGain = Math.floor(enemyMaxHP * 0.3);
    } else if (ability.id === 'rage') {
      newStatusEffects.rage.active = true;
      newStatusEffects.rage.turnsLeft = 2;
    }
    return { newActive: [{ ...ability, turnsLeft: abilityTurns }], shieldGain };
  }

  function resolveEnemyRollOutcome(diceValues, currentPlayerHP, currentShield, currentHand, currentDiscard, intentionType, intentionVal) {
    const sum = diceValues.reduce((a, b) => a + b, 0);
    const rollStatus = getEnemyRollStatus(sum, intentionType);

    let dmg = 0;
    let newEnemyShield = 0;
    let abilityMsg = '';
    let immediatePlayerDmg = 0; // instant damage from boss abilities (Chain Lightning, Inferno)
    // Deep copy status effects to avoid mutating current state
    let newStatusEffects = { ...statusEffects, rage: { ...statusEffects.rage } };
    let newLockedCards = [];
    // Decrement active ability badges each turn
    let newActiveAbilities = activeAbilities
      .map(a => ({ ...a, turnsLeft: a.turnsLeft - 1 }))
      .filter(a => a.turnsLeft > 0);

    if (intentionType === 'defence') {
      if (rollStatus.status === 'Defence') {
        newEnemyShield = intentionVal;
        abilityMsg = ` Gains ${newEnemyShield} shield!`;
      } else if (rollStatus.status === 'StrongDefence') {
        newEnemyShield = intentionVal * 2;
        abilityMsg = ` Gains ${newEnemyShield} STRONG shield!`;
      } else {
        abilityMsg = ' Defence fails!';
      }
    } else if (intentionType === 'ability') {
      const abilityTurns = intentionVal || 2;
      if (rollStatus.status === 'Miss') {
        abilityMsg = ' Ability fizzles!';
      } else if (rollStatus.status === 'Ability') {
        // ── Mini Boss: 1 random ability from its pool ──
        if (encounterType === 'miniBoss' && miniBossSelectedAbilities.length > 0) {
          const ability = miniBossSelectedAbilities[Math.floor(Math.random() * miniBossSelectedAbilities.length)];
          abilityMsg = ` ${ability.icon} ${ability.name}!`;
          const { newActive: added, shieldGain } = applyAbilityEffect(ability, currentHand, newStatusEffects, newLockedCards, abilityTurns);
          newActiveAbilities = [...newActiveAbilities, ...added];
          if (shieldGain > 0) newEnemyShield += shieldGain;
        }
        // ── Boss: 1 random ability from its pool ──
        else if (encounterType === 'boss' && bossSelectedAbilities.length > 0) {
          const ability = bossSelectedAbilities[Math.floor(Math.random() * bossSelectedAbilities.length)];
          abilityMsg = ` ${ability.icon} ${ability.name}!`;
          newActiveAbilities.push({ ...ability, turnsLeft: abilityTurns });
          if (ability.id === 'chainLightning') {
            const chainDmg = currentHand.length * 8;
            immediatePlayerDmg += chainDmg;
            abilityMsg += ` ⚡ ${currentHand.length} cards × 8 = ${chainDmg} dmg!`;
          } else if (ability.id === 'inferno') {
            immediatePlayerDmg += 30;
            abilityMsg += ` 🔥 30 dmg!`;
          } else if (ability.id === 'voidCurse') {
            setVoidCursed(true);
          } else if (ability.id === 'bloodlust') {
            setPendingEnemyHeal(20);
          }
          // deathMark and mirror: tracked via activeAbilities, resolved later
        }
      } else if (rollStatus.status === 'Both') {
        // ── ALL abilities trigger ──
        const pool = encounterType === 'boss' ? bossSelectedAbilities : miniBossSelectedAbilities;
        abilityMsg = pool.map(a => a.icon).join(' ') + ' ALL ABILITIES!';
        pool.forEach(ability => {
          if (encounterType === 'miniBoss') {
            const { newActive: added, shieldGain } = applyAbilityEffect(ability, currentHand, newStatusEffects, newLockedCards, abilityTurns);
            newActiveAbilities = [...newActiveAbilities, ...added];
            if (shieldGain > 0) newEnemyShield += shieldGain;
          } else {
            newActiveAbilities.push({ ...ability, turnsLeft: abilityTurns });
            if (ability.id === 'chainLightning') {
              const chainDmg = currentHand.length * 8;
              immediatePlayerDmg += chainDmg;
            } else if (ability.id === 'inferno') {
              immediatePlayerDmg += 30;
            } else if (ability.id === 'voidCurse') {
              setVoidCursed(true);
            } else if (ability.id === 'bloodlust') {
              setPendingEnemyHeal(prev => prev + 20);
            }
          }
        });
      }
      dmg = immediatePlayerDmg; // instant damage lands this turn
    } else {
      // ── Attack ──
      dmg = enemyDamage;
      if (rollStatus.status === 'Miss') {
        dmg = 0;
        abilityMsg = ' Misses!';
      } else if (rollStatus.status === 'Crit') {
        dmg *= 2;
        abilityMsg = ' 🔥 CRIT!';
      }
      // Chaos: Speed Round — attack twice (double damage before shield)
      if (chaosModifier?.id === 'speedRound' && dmg > 0) {
        dmg *= 2;
        abilityMsg += ' ⚡ ×2!';
      }
      // Bribe: Enraged — double attack damage for N turns after a failed bribe
      if (enragedTurns > 0 && dmg > 0) {
        dmg *= 2;
        abilityMsg += ' 😡 ENRAGED!';
        setEnragedTurns(prev => Math.max(0, prev - 1));
      }
      // Apply player shield then reset it
      dmg = Math.max(0, dmg - currentShield);
      // Chaos: Explosive — crit splash bypasses shield entirely
      if (chaosModifier?.id === 'explosive' && rollStatus.status === 'Crit') {
        const splash = Math.floor(enemyDamage * 0.5);
        dmg += splash;
        abilityMsg += ` 💥 +${splash} splash!`;
      }
    }

    // Rage: doubles enemy attack damage for its duration
    if (newStatusEffects.rage.active && intentionType === 'attack') {
      dmg *= 2;
      newStatusEffects.rage.turnsLeft--;
      if (newStatusEffects.rage.turnsLeft === 0) newStatusEffects.rage.active = false;
      abilityMsg += ' 💥 Rage!';
    }

    // Chaos: Vampire Rules — enemy heals 50% of damage dealt
    let vampireEnemyHeal = 0;
    if (chaosModifier?.id === 'vampireRules' && dmg > 0 && intentionType === 'attack') {
      vampireEnemyHeal = Math.floor(dmg * 0.5);
      abilityMsg += ` 🩸 heals ${vampireEnemyHeal}!`;
    }

    // Buff: Iron Skin — reduce all incoming damage by 10%
    if (hasBuff('ironSkin') && dmg > 0) {
      dmg = Math.max(0, Math.round(dmg * 0.9));
    }
    // Buff: Glass Cannon — die instantly on any enemy crit
    if (hasBuff('glassCanon') && rollStatus?.status === 'Crit' && dmg > 0) {
      setPlayerHP(0); setEnemyRolling(false); setPhase('lose'); return;
    }

    let newHP = Math.max(0, currentPlayerHP - dmg);
    if (dmg > 0) playPlayerAnim('hurt', 600);

    // Buff: Blood Frenzy — lose 8 HP each enemy turn passively
    if (hasBuff('bloodFrenzy') && newHP > 0) {
      newHP = Math.max(0, newHP - 8);
      abilityMsg += ' 🩸 -8 Frenzy!';
    }
    // Buff: Regeneration — heal 3 HP at start of next turn (applied now, after damage)
    if (hasBuff('regeneration') && newHP > 0 && !hasBuff('deathPact')) {
      newHP = Math.min(playerMaxHp, newHP + 3);
      abilityMsg += ' 🌿 +3!';
    }

    setPlayerHP(newHP);
    setShield(0);
    setEnemyShield(newEnemyShield);
    setStatusEffects(newStatusEffects);
    setActiveAbilities(newActiveAbilities);
    setEnemyTurnCount(prev => prev + 1);
    if (vampireEnemyHeal > 0) setEnemyHP(prev => Math.min(enemyMaxHP, prev + vampireEnemyHeal));
    setEnemyRolling(false); // Re-enable player inputs after turn resolves
    // showingEnemyRoll stays true so dice remain visible

    if (newHP <= 0) { setPhase('lose'); return; }

    const { hand: refilled, deck: newDeck, discard: newDiscard } = refillHand(deck, currentHand, currentDiscard, handSize());
    const drawnIds = refilled.filter(id => !currentHand.includes(id));
    triggerCardDraw(drawnIds);
    setDice(makeFreshDice(equippedDice));
    setRollsLeft(rollsPerTurn());
    setHand(refilled);
    setDeck(newDeck);
    setDiscard(newDiscard);
    setCardsPlayedThisTurn(0);

    // Chaos: Card Lock — lock one random card each turn
    if (chaosModifier?.id === 'cardLock' && refilled.length > 0) {
      const lockIdx = Math.floor(Math.random() * refilled.length);
      newLockedCards = [refilled[lockIdx]];
    }
    setLockedCards(newLockedCards);

    // Determine NEXT intention — pick fresh values from ranges each turn
    const nextIntention = determineIntention(encounterType);
    const nextAtkVal = randInRange(enemyAttackRange[0], enemyAttackRange[1]);
    const nextShdVal = randInRange(enemyShieldRange[0], enemyShieldRange[1]);
    const nextVal    = nextIntention === 'attack'  ? nextAtkVal
                     : nextIntention === 'defence' ? nextShdVal
                     : Math.floor(Math.random() * 2) + 1;
    if (nextIntention === 'attack') setEnemyDamage(nextAtkVal);
    setEnemyIntention(nextIntention);
    setEnemyIntentionValue(nextVal);

    const enemyLabel = encounterType === 'boss' ? '👹 Boss' : encounterType === 'miniBoss' ? '⚡ Mini Boss' : 'Shadow Wraith';
    const baseMsg = intentionType === 'defence'
      ? `${enemyLabel} rolls ${sum} (${rollStatus.label})!`
      : `${enemyLabel} rolls ${sum} (${rollStatus.label})${dmg > 0 ? ` — ${dmg} dmg!` : '!'}`;
    setMessage(baseMsg + abilityMsg + '\nYour turn — roll!');
  }

  function triggerEnemyTurn(currentPlayerHP = playerHP, currentShield = shield, currentHand = hand, currentDiscard = discard) {
    // Regular combat with multiple enemies: use dedicated multi-enemy function
    if (enemies.length > 0) {
      triggerMultiEnemyTurn(currentPlayerHP, currentShield, currentHand, currentDiscard);
      return;
    }

    const currentIntention = enemyIntention || 'attack';
    const currentIntentionVal = enemyIntentionValue;

    setEnemyRolling(true);
    setHoveredCardId(null); // Lock player inputs during animation

    // ── Death Mark: penalize player if they dealt < 20 damage this turn ──
    let adjustedPlayerHP = currentPlayerHP;
    if (activeAbilities.some(a => a.id === 'deathMark')) {
      if (damageDealtThisTurnRef.current < 20) {
        adjustedPlayerHP = Math.max(0, currentPlayerHP - 30);
        setPlayerHP(adjustedPlayerHP);
      }
    }
    damageDealtThisTurnRef.current = 0; // Reset for next player turn

    // ── Bloodlust: heal enemy HP if pending from last ability roll ──
    if (pendingEnemyHeal > 0) {
      setEnemyHP(prev => Math.min(enemyMaxHP, prev + pendingEnemyHeal));
      setPendingEnemyHeal(0);
    }

    // Death mark killed player
    if (adjustedPlayerHP <= 0) {
      setEnemyRolling(false);
      setPhase('lose');
      return;
    }

    // ── DoT (poison/burn): damage enemy before their action ──
    if (enemyDotTurns > 0) {
      const dotDmg = enemyDotDmg;
      const newEnemyHP = Math.max(0, enemyHP - dotDmg);
      setEnemyHP(newEnemyHP);
      setEnemyDotTurns(prev => Math.max(0, prev - 1));
      if (newEnemyHP <= 0) {
        setEnemyRolling(false);
        const dotIcon = enemyDotType === 'burn' ? '🔥' : '☠️';
        const runesBase = 10 + (encounterType === 'miniBoss' ? 20 : 0) + (encounterType === 'boss' ? 50 : 0);
        const earnedRunes = (chaosModifier?.id === 'goldCurse' && encounterType === 'regular') ? 0 : runesBase;
        if (earnedRunes > 0) {
          setRunRunes(pr => pr + earnedRunes);
          setLevelRunesEarned(pr => pr + earnedRunes);
          setTotalRunesEarned(pr => pr + earnedRunes);
        }
        // Refund bribe runes if the player won after a failed bribe
        if (bribeRefundAmount > 0) {
          setRunRunes(pr => pr + bribeRefundAmount);
          setBribeRefundAmount(0);
        }
        // Soul Harvest: heal 20 HP on kill
        if (hasBuff('soulHarvest') && !hasBuff('deathPact')) {
          setPlayerHP(hp => Math.min(playerMaxHp, hp + 20));
        }
        setLevelCombatCount(pr => pr + 1);
        setCombatCount(pr => pr + 1);
        setMessage(`${dotIcon} DoT kills the enemy!`);
        if (encounterType === 'boss' && currentLevel === 10) {
          setScreen('runComplete');
        } else if (encounterType === 'boss') {
          const soulsEarned = 1 + (hasBuff('soulFinder') ? 1 : 0);
          setBossSouls(prev => prev + soulsEarned);
          setShowBuffShop(true);
        } else {
          setPhase('cardReward');
        }
        return;
      }
    }

    // ── Freeze: enemy skips their turn ──
    if (enemyFrozenTurns > 0) {
      setEnemyFrozenTurns(prev => Math.max(0, prev - 1));
      setEnemyRolling(false);
      const { hand: refHand, deck: refDeck, discard: refDiscard } = refillHand(deck, currentHand, currentDiscard, handSize());
      const frozenDrawnIds = refHand.filter(id => !currentHand.includes(id));
      triggerCardDraw(frozenDrawnIds);
      setDice(makeFreshDice(equippedDice));
      setRollsLeft(rollsPerTurn());
      setHand(refHand);
      setDeck(refDeck);
      setDiscard(refDiscard);
      setCardsPlayedThisTurn(0);
      // Determine next intention — pick fresh values from ranges
      const frozenNextInt = determineIntention(encounterType);
      const frozenAtkVal  = randInRange(enemyAttackRange[0], enemyAttackRange[1]);
      const frozenShdVal  = randInRange(enemyShieldRange[0], enemyShieldRange[1]);
      const frozenNextVal = frozenNextInt === 'attack'  ? frozenAtkVal
                          : frozenNextInt === 'defence' ? frozenShdVal
                          : Math.floor(Math.random() * 2) + 1;
      if (frozenNextInt === 'attack') setEnemyDamage(frozenAtkVal);
      setEnemyIntention(frozenNextInt);
      setEnemyIntentionValue(frozenNextVal);
      if (chaosModifier?.id === 'cardLock' && refHand.length > 0) {
        setLockedCards([refHand[Math.floor(Math.random() * refHand.length)]]);
      } else {
        setLockedCards([]);
      }
      setMessage('❄️ Enemy is frozen! They skip their turn.');
      return;
    }

    // Reset enemy shield at start of enemy turn
    setEnemyShield(0);

    const diceValues = rollEnemyDice();
    const sum = diceValues.reduce((a, b) => a + b, 0);

    playDiceSound();
    enemyDiceRotation.setValue(0);
    Animated.timing(enemyDiceRotation, {
      toValue: 10, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    setEnemyDice(diceValues);
    setEnemyDiceSum(sum);
    setEnemyRollStatus(getEnemyRollStatus(sum, currentIntention));
    setShowingEnemyRoll(true);

    setTimeout(() => {
      resolveEnemyRollOutcome(diceValues, adjustedPlayerHP, currentShield, currentHand, currentDiscard, currentIntention, currentIntentionVal);
    }, 500);
  }

  // ── Start combat (called by EquipScreen) ──────────────────────────────────

  function startCombat(cardIds, equipped) {
    const shuffledDeck = shuffle(cardIds);
    const [initialHand, remainingDeck] = drawN(handSize(), shuffledDeck);

    // Use levelCombatCount to determine encounter type within current level
    const currentEncounterType = getEncounterType(levelCombatCount + 1);
    const stats = getScaledEnemyStats(currentEncounterType, levelCombatCount + 1, currentLevel);

    // Chaos modifier: Dice Frenzy doubles enemy HP
    let startingEnemyHP = chaosModifier?.id === 'diceFrenzy' ? stats.maxHp * 2 : stats.maxHp;
    // Chaos modifier: Iron Skin gives enemy starting shield
    const startingEnemyShield = chaosModifier?.id === 'ironSkin' ? Math.floor(startingEnemyHP * 0.3) : 0;

    setEncounterType(currentEncounterType);
    setEquippedCardIds(cardIds);
    setEquippedDice(equipped);
    cardDrawAnims.current.clear(); // clear any leftover anims from previous combat
    enemyAnims.current.clear();
    setDyingEnemyIds(new Set());
    setFloatingDamages([]);
    triggerCardDraw(initialHand);
    setDeck(remainingDeck);
    setHand(initialHand);
    setDiscard([]);
    setDice(makeFreshDice(equipped));
    setRollsLeft(rollsPerTurn());
    setShield(hasBuff('magicShield') ? 15 : 0);
    setEnemyHP(startingEnemyHP);
    setEnemyMaxHP(startingEnemyHP);
    setEnemyDamage(stats.damage);
    setEnemyAttackRange(stats.attackRange);
    setEnemyShieldRange(stats.shieldRange);

    // ── Multi-enemy: generate 1-5 enemies for regular combat ──────────────
    if (currentEncounterType === 'regular') {
      const numEnemies = Math.floor(Math.random() * 5) + 1;
      const hpValues  = distributeAmong(startingEnemyHP, numEnemies, 5);
      const atkValues = distributeAmong(stats.damage,    numEnemies, 1);
      const iconPicks = [...MULTI_ENEMY_ICONS].sort(() => Math.random() - 0.5).slice(0, numEnemies);
      let generatedEnemies = hpValues.map((hp, i) => ({
        id: i,
        hp,
        maxHp: hp,
        damage:    atkValues[i],
        shield:    chaosModifier?.id === 'ironSkin' ? Math.floor(hp * 0.3) : 0,
        icon:      iconPicks[i],
        intention: 'attack',
        gifType:   pickMinionType(currentLevel),
        gifAnim:   'idle',
        gifKey:    0,
      }));
      // Sudden Death: all enemies start at 30% HP
      if (chaosModifier?.id === 'suddenDeath') {
        setPlayerHP(Math.max(1, Math.floor(playerMaxHp * 0.3)));
        generatedEnemies = generatedEnemies.map(e => ({ ...e, hp: Math.max(1, Math.floor(e.maxHp * 0.3)) }));
      }
      setEnemies(generatedEnemies);
      setSelectedEnemyIdx(0);
    } else {
      setEnemies([]);
      setSelectedEnemyIdx(0);
    }

    setMiniBossTurnCounter(0);
    setLockedCards([]);
    setStatusEffects({ shield: false, rage: { active: false, turnsLeft: 0 }, curse: { active: false } });
    setEnemyTurnCount(0);
    setEnemyDice([null, null, null]);
    setEnemyRollStatus(null);
    setShowingEnemyRoll(true);
    setEnemyRolling(false);
    setMiniBossSelectedAbilities([]);
    setBossSelectedAbilities([]);
    setSelectedAbilityInfo(null);
    setEnemyShield(startingEnemyShield);
    setActiveAbilities([]);
    setVoidCursed(false);
    setPendingEnemyHeal(0);
    damageDealtThisTurnRef.current = 0;
    setEnragedTurns(0);
    setShowBribeScreen(false);
    setBribeUsed(false);
    setBribeRefundAmount(0);
    setEnemyDotDmg(0);
    setEnemyDotTurns(0);
    setEnemyFrozenTurns(0);
    setTitanAttackCount(0);
    setDivineGraceUsed(false);

    // Chaos modifiers that override starting HP
    if (chaosModifier?.id === 'suddenDeath') {
      setPlayerHP(Math.max(1, Math.floor(playerMaxHp * 0.3)));
      setEnemyHP(Math.max(1, Math.floor(startingEnemyHP * 0.3)));
    } else if (chaosModifier?.id === 'identitySwap') {
      // Swap: player gets enemy's starting HP (capped at player max), enemy gets player's current HP
      setPlayerHP(Math.min(playerMaxHp, startingEnemyHP));
      setEnemyHP(Math.min(startingEnemyHP, playerHP));
    }

    // Set initial intention shown to player before first dice roll
    const firstIntention = determineIntention(currentEncounterType);
    const firstAtkVal = stats.damage; // already picked from range
    const firstShdVal = randInRange(stats.shieldRange[0], stats.shieldRange[1]);
    const firstVal    = firstIntention === 'attack'  ? firstAtkVal
                      : firstIntention === 'defence' ? firstShdVal
                      : Math.floor(Math.random() * 2) + 1;
    setEnemyIntention(firstIntention);
    setEnemyIntentionValue(firstVal);

    // Initialize abilities and start message
    let startMsg = 'Roll your dice to begin!';
    const modTag = chaosModifier ? ` ${chaosModifier.icon} ${chaosModifier.name}!` : '';
    if (currentEncounterType === 'miniBoss') {
      const selected = getMiniBossSelectedAbilities();
      setMiniBossSelectedAbilities(selected);
      setMiniBossAbility(null);
      setBossCurrentAbility(null);
      startMsg = `⚡ Mini Boss! ${startingEnemyHP} HP.${modTag} Ability roll every 3rd turn!`;
    } else if (currentEncounterType === 'boss') {
      const selected = getBossSelectedAbilities();
      setBossSelectedAbilities(selected);
      setBossAbilities([]);
      setBossAbilityIndex(0);
      setBossCurrentAbility(null); // No active ability - triggered only on ability rolls
      startMsg = `👹 BOSS! ${startingEnemyHP} HP.${modTag} Ability roll every 3rd turn!`;
    } else {
      setBossCurrentAbility(null);
      startMsg = `Roll to start your journey${modTag ? modTag : ''}`;
    }

    setPhase('player');
    setWeightedPickerDie(null);
    setMessage(startMsg);
    setScreen('combat');
  }

  // ── Start next encounter (after loot / story reward) ─────────────────────

  function startNextEncounter() {
    setEnemyHP(ENEMY_MAX_HP);
    setShield(0);
    setPhase('player');
    setMessage('');
    setDeck([]);
    setHand([]);
    setDiscard([]);
    setWeightedPickerDie(null);
    setEnragedTurns(0);
    setShowBribeScreen(false);
    setEnemyDotDmg(0);
    setEnemyDotTurns(0);
    setEnemyFrozenTurns(0);
    setScreen('preCombat'); // Go to pre-combat preparation screen
  }

  // ── Reward handler ────────────────────────────────────────────────────────

  function handleRewardSelected(result) {
    if (result.kind === 'die') {
      const newDie = { ...result.die, instanceId: `die_${Date.now()}` };
      setDiceCollection((prev) => [...prev, newDie]);
    } else if (result.kind === 'card') {
      const newCard = makeCardInstance(cardDisplayInfo(result.card));
      setCardCollection((prev) => [...prev, newCard]);
    } else if (result.kind === 'damage') {
      setPlayerHP((hp) => Math.max(1, hp - result.amount));
    } else if (result.kind === 'runes') {
      setRunRunes((prev) => prev + result.amount);
    }

    // After boss or combat 5 → show upgrade shop first
    // (level 10 boss goes directly to runComplete before card reward, so never reaches here)
    if (encounterType === 'boss') {
      setPostShopAction('levelComplete');
      setPhase('player');
      setScreen('upgradeShop');
    } else if (levelCombatCount === 5) {
      // Just finished the 5th combat of this level
      setPostShopAction('nextEncounter');
      setPhase('player');
      setScreen('upgradeShop');
    } else if (encounterType === 'regular' && Math.random() < 0.2) {
      // 20% chance of story choice after other regular combats
      setScreen('story');
    } else {
      startNextEncounter();
    }
  }

  // ── Upgrade shop continue handler ─────────────────────────────────────────

  function handleShopContinue() {
    if (postShopAction === 'levelComplete') {
      handleLevelComplete();
    } else {
      startNextEncounter();
    }
  }

  // ── Story screen handler ──────────────────────────────────────────────────

  function handleStoryComplete(scenario, choice) {
    const { effect } = choice;

    setUsedScenarioIds((ids) => [...ids, scenario.id]);

    let hpDelta    = 0;
    let maxHpDelta = 0;
    if (effect.type === 'heal')       hpDelta    = effect.amount;
    if (effect.type === 'curseRelic') hpDelta    = -effect.damage;
    if (effect.type === 'goldHeal') { hpDelta    = effect.hp; setRunRunes(prev => prev + (effect.gold || 0)); }
    if (effect.type === 'gold')       setRunRunes(prev => prev + (effect.amount || 0));
    if (effect.type === 'maxHp')    { maxHpDelta = effect.amount; hpDelta = effect.amount; }

    const newMaxHp = playerMaxHp + maxHpDelta;
    const newHp    = Math.max(1, Math.min(newMaxHp, playerHP + hpDelta));

    setPlayerMaxHp(newMaxHp);
    setPlayerHP(newHp);
    startNextEncounter(); // goes to equip screen
  }

  // ── Shrine: buy an upgrade ────────────────────────────────────────────────

  function handleShrineBuy(upgradeId) {
    const costs = { cardSlot: 50, dieSlot: 75, hp: 30, gold: 20, rareCard: 100, rareDie: 100 };
    const cost  = costs[upgradeId];
    if (!cost || runes < cost) return;
    setRunes(prev => prev - cost);
    switch (upgradeId) {
      case 'cardSlot':  setPCardSlots(prev => Math.min(10, prev + 1)); break;
      case 'dieSlot':
        setPDiceSlots(prev => Math.min(5,  prev + 1));
        setDiceCollection(prev => [...prev, makeInstance(STANDARD_DIE)]);
        break;
      case 'hp':        setPHpBonus(prev => prev + 10); break;
      case 'gold':      setPGoldBonus(prev => prev + 5); break;
      case 'rareCard':  setPRareCard(true); break;
      case 'rareDie':   setPRareDie(true);  break;
    }
  }

  // ── Start new run (called from Shrine "Begin Run") ─────────────────────────
  // Applies shrine bonuses. Does NOT touch permanent state (runes, shrine upgrades).

  function startNewRun() {
    // Apply HP bonus from shrine
    const startingHp = PLAYER_MAX_HP + pHpBonus;
    setPlayerMaxHp(startingHp);
    setPlayerHP(startingHp);

    // (Starting rune bonus applied via setRunRunes(pGoldBonus) below)

    // Reset per-run upgrades (upgrades are temporary — run only)
    setUpgradedCards({});

    // In-run rune pool starts fresh (0 + pGoldBonus bonus from shrine upgrade)
    setRunRunes(pGoldBonus);

    // Build card collection (fresh instances) with shrine upgrades and optional rare card gift
    let newCards = [...BASE_CARD_COLLECTION];
    // Add extra card slots from shrine upgrades
    for (let i = 6; i < pCardSlots; i++) {
      newCards.push(makeCardInstance(cardDisplayInfo(CARDS[0]))); // Slash card as default
    }
    // Add rare card gift if purchased
    if (pRareCard) {
      const rareCards = CARDS.filter(c => c.rarity === 'rare');
      if (rareCards.length > 0) {
        const pick = rareCards[Math.floor(Math.random() * rareCards.length)];
        newCards = [...newCards, makeCardInstance(cardDisplayInfo(pick))];
      }
    }
    setCardCollection(newCards);

    // Build dice collection with shrine upgrades and optional rare die gift
    let newDice = initialCollection();
    // Add extra dice slots from shrine upgrades
    for (let i = 3; i < pDiceSlots; i++) {
      newDice.push(makeInstance(STANDARD_DIE));
    }
    // Add rare die gift if purchased
    if (pRareDie && RARE_DICE.length > 0) {
      const pick = RARE_DICE[Math.floor(Math.random() * RARE_DICE.length)];
      newDice = [...newDice, makeInstance(pick)];
    }
    setDiceCollection(newDice);

    // Reset all per-run state
    setEnemyHP(ENEMY_MAX_HP);
    setEnemyMaxHP(ENEMY_MAX_HP);
    setEnemyDamage(ENEMY_ATTACK);
    setDice([]);
    setRollsLeft(MAX_ROLLS);
    setShield(0);
    setUsedScenarioIds([]);
    setCombatCount(0);
    setMessage('');
    setPhase('player');
    setEquippedDice([]);
    setEquippedCardIds([]);
    setDeck([]);
    setHand([]);
    setDiscard([]);
    setWeightedPickerDie(null);
    setMiniBossTurnCounter(0);
    setMiniBossAbility(null);
    setBossAbilities([null, null]);
    setBossAbilityIndex(0);
    setBossCurrentAbility(null);
    setStatusEffects({ shield: false, rage: { active: false, turnsLeft: 0 }, curse: { active: false } });
    setLockedCards([]);
    setEnemyTurnCount(0);
    setEnemyDice([null, null, null]);
    setEnemyRollStatus(null);
    setShowingEnemyRoll(true);
    setEnemyRolling(false);
    setMiniBossSelectedAbilities([]);
    setBossSelectedAbilities([]);
    setSelectedAbilityInfo(null);
    setEnemyIntention(null);
    setEnemyIntentionValue(0);
    setEnemyShield(0);
    setActiveAbilities([]);
    setVoidCursed(false);
    setPendingEnemyHeal(0);
    damageDealtThisTurnRef.current = 0;
    setCurrentLevel(1);
    setLevelCombatCount(0);
    setChaosModifier(null);
    setUsedModifierIds([]);
    setLevelRunesEarned(0);
    setTotalRunesEarned(0);
    setPendingNextModifier(null);
    setEnragedTurns(0);
    setShowBribeScreen(false);
    setEnemyDotDmg(0);
    setEnemyDotTurns(0);
    setEnemyFrozenTurns(0);
    setEnemies([]);
    setSelectedEnemyIdx(0);
    setHasActiveRun(true); // Mark that a run is now active
    // upgradedCards already reset at top of startNewRun
    setScreen('levelStart'); // Show level 1 intro
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ width: winW, height: winH, overflow: 'hidden', backgroundColor: C.bg }}>
      <StatusBar translucent />
      {/* ── Scale wrapper: everything scales from top-left with screen size ── */}
      <View style={{
        width: winW / charScale,
        height: winH / charScale,
        transformOrigin: [0, 0],
        transform: [{ scale: charScale }],
      }}>

      {/* ── Enemy HP bar ── */}
      <View style={s.enemyBar}>
        <View style={s.enemyHeader}>
          <Text style={s.combatNumber}>
            Lvl {currentLevel} · {levelCombatCount + 1}/10
          </Text>
          {chaosModifier && (
            <TouchableOpacity
              style={s.chaosBadge}
              onPress={() => setSelectedAbilityInfo({ icon: chaosModifier.icon, name: chaosModifier.name, desc: chaosModifier.desc })}
              activeOpacity={0.8}
            >
              <Text style={s.chaosBadgeText}>{chaosModifier.icon} {chaosModifier.name}</Text>
            </TouchableOpacity>
          )}
          {/* 💎 Runes + 💰 Bribe — grouped together as currency/bribe pair */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={[s.runesBadge, { marginLeft: 0 }]}>💎 {runRunes}</Text>
            {(() => {
              const minBribe = getMinBribeAmount(encounterType);
              const bribeDisabled = enemyRolling || phase !== 'player' || bribeUsed || runRunes < minBribe || chaosModifier?.id === 'goldCurse' || encounterType === 'boss';
              return (
                <TouchableOpacity
                  style={[s.bribeGameBtn, bribeDisabled && { opacity: 0.3 }]}
                  onPress={() => !bribeDisabled && setShowBribeScreen(true)}
                  disabled={bribeDisabled}
                  activeOpacity={0.8}
                >
                  <Text style={s.bribeGameBtnText}>💰</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
          <Text style={s.enemyName}>
            {enemies.length > 0
              ? `Enemies: ${enemies.filter(e => e.hp > 0).length}/${enemies.length}`
              : ENEMY_NAME + (encounterType === 'boss' ? ' 👹 BOSS' : encounterType === 'miniBoss' ? ' ⚡ Mini Boss' : '')
            }
          </Text>
        </View>

        {/* ── Enemy shield (single-enemy only) ── */}
        {enemies.length === 0 && enemyShield > 0 && (
          <Text style={s.enemyShieldLabel}>🛡️ Shield: {enemyShield}</Text>
        )}

        {/* ── DoT badge (single-enemy only) ── */}
        {enemies.length === 0 && enemyDotTurns > 0 && (
          <View style={[s.enragedBadge, { borderColor: enemyDotType === 'burn' ? '#FF6B00' : '#6B00FF', backgroundColor: enemyDotType === 'burn' ? 'rgba(255,107,0,0.18)' : 'rgba(107,0,255,0.18)' }]}>
            <Text style={[s.enragedBadgeText, { color: enemyDotType === 'burn' ? '#FF8C30' : '#BB66FF' }]}>
              {enemyDotType === 'burn' ? '🔥' : '☠️'} {enemyDotDmg} dmg/turn — {enemyDotTurns} left
            </Text>
          </View>
        )}

        {/* ── Frozen badge (single-enemy only) ── */}
        {enemies.length === 0 && enemyFrozenTurns > 0 && (
          <View style={[s.enragedBadge, { borderColor: '#5BC8E8', backgroundColor: 'rgba(91,200,232,0.15)' }]}>
            <Text style={[s.enragedBadgeText, { color: '#5BC8E8' }]}>❄️ FROZEN — {enemyFrozenTurns} turn{enemyFrozenTurns !== 1 ? 's' : ''} left</Text>
          </View>
        )}

        {/* ── Enraged badge ── */}
        {enragedTurns > 0 && (
          <View style={s.enragedBadge}>
            <Text style={s.enragedBadgeText}>😡 ENRAGED — {enragedTurns} turn{enragedTurns !== 1 ? 's' : ''} left</Text>
          </View>
        )}

        {/* ── Ability badges (single-enemy only) ── */}
        {enemies.length === 0 && activeAbilities.length > 0 && (
          <View style={s.activeBadgesRow}>
            {activeAbilities.map((ab, i) => (
              <TouchableOpacity key={i} style={s.activeBadge} onPress={() => setSelectedAbilityInfo(ab)} activeOpacity={0.7}>
                <Text style={s.activeBadgeIcon}>{ab.icon}</Text>
                <Text style={s.activeBadgeTurns}>{ab.turnsLeft}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Clickable ability emojis (mini boss / boss only) ── */}
        {enemies.length === 0 && (encounterType === 'miniBoss' || encounterType === 'boss') && (
          <View style={s.abilitiesRow}>
            {(encounterType === 'miniBoss' ? miniBossSelectedAbilities : bossSelectedAbilities).map((ability) => (
              <TouchableOpacity key={ability.id} onPress={() => setSelectedAbilityInfo(ability)} activeOpacity={0.7}>
                <Text style={s.abilityEmoji}>{ability.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Content below top bar (background lives here) ── */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBgSize({ w: width, h: height });
        }}
      >
        {currentLevel === 1 && (
          <Image
            source={require('./background/Level1.jpg')}
            style={{ position: 'absolute', top: 0, left: 0, width: bgSize.w, height: bgSize.h }}
            resizeMode="stretch"
            pointerEvents="none"
          />
        )}

      {/* ── Battlefield ── */}
      <Animated.View style={[s.battlefield, { transform: [{ translateX: shakeAnim }] }]}>

        {/* ── LEFT: Player character ── */}
        <View style={s.playerSide}>
          <View style={{ position: 'relative' }}>
            <Image
              key={playerAnimKey}
              source={PLAYER_GIFS[phase === 'lose' ? 'dying' : playerAnim]}
              style={s.playerCharacterImg}
              resizeMode="contain"
            />
            {/* Floating damage numbers over player */}
            {floatingDamages.map(fd => (
              <Animated.Text
                key={fd.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  top: '30%',
                  color: '#FF4444',
                  fontSize: 28,
                  fontWeight: 'bold',
                  opacity: fd.opacity,
                  transform: [{ translateY: fd.y }],
                  zIndex: 20,
                  textShadowColor: '#000',
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                -{fd.value}
              </Animated.Text>
            ))}
            {/* Slash overlay on player when hit */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: playerSlashOpacity,
                transform: [{ scale: playerSlashScale }],
              }}
            >
              <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', width: 70, height: 5, backgroundColor: '#FF3333', borderRadius: 3, transform: [{ rotate: '45deg' }] }} />
                <View style={{ position: 'absolute', width: 70, height: 5, backgroundColor: '#FF3333', borderRadius: 3, transform: [{ rotate: '-45deg' }] }} />
              </View>
            </Animated.View>
          </View>
          {shield > 0 && (
            <View style={{ position: 'absolute', bottom: 28, right: -8, backgroundColor: 'rgba(91,200,232,0.2)', borderRadius: 10, borderWidth: 1, borderColor: '#5BC8E8', paddingHorizontal: 6, paddingVertical: 2, zIndex: 10 }}>
              <Text style={{ color: '#5BC8E8', fontSize: 11, fontWeight: 'bold' }}>🛡️ {shield}</Text>
            </View>
          )}
          <CharacterHpBar current={playerHP} max={playerMaxHp} barWidth={130} />
          {bossSouls > 0 && <Text style={s.soulsBadge}>💠 {bossSouls}</Text>}
          <Text style={s.avatarLabel}>You</Text>
        </View>

        {/* ── RIGHT: Enemy content ── */}
        <View style={s.enemySide}>

          {enemies.length > 0 ? (
            // ── Multi-enemy: side-by-side cards ──────────────────────────
            <View style={s.multiEnemyRow}>
              {enemies.map((enemy, idx) => {
                const isDying = dyingEnemyIds.has(enemy.id);
                if (enemy.hp <= 0 && !isDying) return null;
                const isSelected = selectedEnemyIdx === idx;
                const numAlive = enemies.filter(e => e.hp > 0).length;
                const iconSize = numAlive > 3 ? 20 : 28;
                const ea = getEnemyAnims(enemy.id);
                return (
                  <View
                    key={enemy.id}
                    style={{ position: 'relative' }}
                  >
                    {/* Floating damage numbers over enemy */}
                    {enemyFloatingDamages.filter(fd => fd.enemyId === enemy.id).map(fd => (
                      <Animated.Text
                        key={fd.id}
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          alignSelf: 'center',
                          top: '20%',
                          color: '#FF4444',
                          fontSize: 22,
                          fontWeight: 'bold',
                          opacity: fd.opacity,
                          transform: [{ translateY: fd.y }],
                          zIndex: 30,
                          textShadowColor: '#000',
                          textShadowOffset: { width: 1, height: 1 },
                          textShadowRadius: 3,
                        }}
                      >
                        -{fd.value}
                      </Animated.Text>
                    ))}
                    {/* Slash overlay on enemy when hit by player */}
                    <Animated.View
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, {
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        zIndex: 7,
                        opacity: ea.slashOpacity,
                        transform: [{ scale: ea.slashScale }],
                      }]}
                    >
                      <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ position: 'absolute', width: 44, height: 4, backgroundColor: '#FFD700', borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
                        <View style={{ position: 'absolute', width: 44, height: 4, backgroundColor: '#FFD700', borderRadius: 2, transform: [{ rotate: '-45deg' }] }} />
                      </View>
                    </Animated.View>
                    <TouchableOpacity
                      style={[s.multiEnemyCard, isSelected && s.multiEnemyCardSelected]}
                      onPress={() => !enemyRolling && setSelectedEnemyIdx(idx)}
                      activeOpacity={0.8}
                    >
                      {isSelected && <Text style={s.multiEnemyTargetIcon}>🎯</Text>}
                      {MINION_GIFS[currentLevel] && enemy.gifType ? (
                        <Image
                          key={enemy.gifKey}
                          source={MINION_GIFS[currentLevel][enemy.gifType][enemy.gifAnim || 'idle']}
                          style={{ width: numAlive > 3 ? (IS_PC ? 100 : 48) : (IS_PC ? 130 : 64), height: numAlive > 3 ? (IS_PC ? 100 : 48) : (IS_PC ? 130 : 64) }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={{ fontSize: iconSize }}>{enemy.icon}</Text>
                      )}
                      <Text style={s.multiEnemyIntention}>
                        {enemy.intention === 'attack' ? '⚔️' : '🛡️'} {enemy.damage}
                      </Text>
                    </TouchableOpacity>
                    {enemy.shield > 0 && (
                      <View style={{ position: 'absolute', bottom: 28, right: -6, backgroundColor: 'rgba(91,200,232,0.2)', borderRadius: 8, borderWidth: 1, borderColor: '#5BC8E8', paddingHorizontal: 4, paddingVertical: 2, zIndex: 10 }}>
                        <Text style={{ color: '#5BC8E8', fontSize: 9, fontWeight: 'bold' }}>🛡️ {enemy.shield}</Text>
                      </View>
                    )}
                    <CharacterHpBar current={enemy.hp} max={enemy.maxHp} barWidth={numAlive > 3 ? 56 : 70} />
                  </View>
                );
              })}
            </View>
          ) : (
            // ── Single enemy (boss / miniBoss) ──────────────────────────
            <>
              <View style={s.enemyAvatarRow}>
                <View style={[s.avatarWrap, enragedTurns > 0 && s.avatarWrapEnraged]}>
                  {currentLevel === 1 && encounterType === 'boss' ? (
                    <Image
                      source={require('./boss_level1.png')}
                      style={{ width: 160, height: 190 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={s.avatar}>👹</Text>
                  )}
                </View>
                {enemyIntention && chaosModifier?.id !== 'blind' && (
                  <TouchableOpacity
                    style={s.intentionBox}
                    onPress={() => setSelectedAbilityInfo({
                      icon: enemyIntention === 'attack' ? '⚔️' : enemyIntention === 'defence' ? '🛡️' : '🌀',
                      name: enemyIntention === 'attack' ? 'Attack' : enemyIntention === 'defence' ? 'Defence' : 'Ability',
                      desc: enemyIntention === 'attack' ? 'enemy will attack' : enemyIntention === 'defence' ? 'enemy will shield up' : 'enemy will use an ability',
                    })}
                    activeOpacity={0.75}
                  >
                    <Text style={s.intentionIcon}>
                      {enemyIntention === 'attack' ? '⚔️' : enemyIntention === 'defence' ? '🛡️' : '🌀'}
                    </Text>
                    <Text style={[s.intentionValue, {
                      color: enemyIntention === 'attack' ? C.red : enemyIntention === 'defence' ? C.blue : '#AA00FF'
                    }]}>
                      {enemyIntentionValue}
                    </Text>
                  </TouchableOpacity>
                )}
                {chaosModifier?.id === 'blind' && (
                  <View style={s.intentionBox}>
                    <Text style={s.intentionIcon}>❓</Text>
                    <Text style={[s.intentionValue, { color: C.muted }]}>?</Text>
                  </View>
                )}
              </View>
              <Text style={s.avatarLabel}>{ENEMY_NAME}</Text>
              {chaosModifier?.id !== 'blind' ? (
                <CharacterHpBar current={enemyHP} max={enemyMaxHP} barWidth={140} />
              ) : (
                <Text style={{ color: C.muted, fontSize: 11 }}>??? HP</Text>
              )}
            </>
          )}


        </View>
      </Animated.View>

      {/* ── Controls row: player dice | enemy dice | buttons ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
        {/* Left: dice */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.rollsLeft}>Rolls: {rollsLeft}</Text>
          {hasBuff('divineGrace') && !divineGraceUsed && (
            <TouchableOpacity style={[s.divineBtn, enemyRolling && { opacity: 0.35 }]} onPress={handleDivineGrace} disabled={enemyRolling} activeOpacity={0.8}>
              <Text style={s.divineBtnText}>🌟</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.rollBtn, (rollsLeft === 0 || enemyRolling || dice.every(d => d.used)) && s.rollBtnOff]}
            onPress={rollDice}
            disabled={rollsLeft === 0 || enemyRolling || dice.every(d => d.used)}
            activeOpacity={0.8}
          >
            <Text style={s.rollBtnText}>ROLL</Text>
          </TouchableOpacity>
          <View style={s.diceRow}>
            {dice.map((die, i) => (
              <Die key={i} die={die} rotation={diceRotations[i]} isAnimating={diceAnimating[i]} />
            ))}
          </View>
        </View>
        {/* Center: Enemy dice — HIDDEN, will be re-enabled later */}

        {/* Right: End Turn + Kill */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.endTurnBtn, { flex: 0, paddingHorizontal: 16, minWidth: 120 }, enemyRolling && { opacity: 0.35 }]}
            onPress={() => !enemyRolling && triggerEnemyTurn()}
            disabled={enemyRolling}
            activeOpacity={0.8}
          >
            <Text style={s.endTurnText} numberOfLines={1}>End Turn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.debugKillBtn}
            onPress={() => {
              const runesBase = 10 + (encounterType === 'miniBoss' ? 20 : 0) + (encounterType === 'boss' ? 50 : 0);
              const earnedRunes = (chaosModifier?.id === 'goldCurse' && encounterType === 'regular') ? 0 : runesBase;
              if (earnedRunes > 0) { setRunRunes(prev => prev + earnedRunes); setLevelRunesEarned(prev => prev + earnedRunes); setTotalRunesEarned(prev => prev + earnedRunes); }
              setLevelCombatCount(prev => prev + 1); setEnemyHP(0); setCombatCount(prev => prev + 1);
              if (enemies.length > 0) { setEnemies(prev => prev.map(e => ({ ...e, hp: 0 }))); setPhase('cardReward'); }
              else if (encounterType === 'boss' && currentLevel === 10) { setScreen('runComplete'); }
              else if (encounterType === 'boss') { const soulsEarned = 1 + (activeBuffs.some(b => b.id === 'soulFinder') ? 1 : 0); setBossSouls(prev => prev + soulsEarned); setShowBuffShop(true); }
              else { setPhase('cardReward'); }
            }}
            activeOpacity={0.8}
          >
            <Text style={s.debugKillText}>☠ Kill</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Message ── */}
      <View style={s.messageRow}>
        <Text style={s.messageText}>{message}</Text>
      </View>

      {/* ── Player HP bar ── */}
      <View style={s.playerBar}>
        {/* ── Active buffs row ── */}
        {activeBuffs.length > 0 && (
          <View style={s.activeBuffsRow}>
            {activeBuffs.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[s.activeBuffIcon, { borderColor: b.cursed ? C.red : b.cost === 3 ? '#FF8C00' : C.gold }]}
                onPress={() => setSelectedAbilityInfo({ icon: b.cursed ? '☠️' : b.icon, name: b.name, desc: b.desc })}
                activeOpacity={0.75}
              >
                <Text style={s.activeBuffEmoji}>{b.cursed ? '☠️' : b.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>


      {/* ── Card hover preview (PC only) ── */}
      {hoveredCardId && (() => {
        const inst = cardCollection.find(c => c.instanceId === hoveredCardId);
        const hcard = inst ? CARD_MAP[inst.id] : null;
        if (!hcard) return null;
        const playable = hcard.canPlay(dice) && !enemyRolling;
        const rarityColor = RARITY_COLOR[hcard.rarity] || '#3A3A5A';
        return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 175,
              alignSelf: 'center',
              width: 190,
              backgroundColor: '#0A1628',
              borderRadius: 16,
              borderWidth: 2.5,
              borderColor: playable ? rarityColor : '#333',
              padding: 16,
              alignItems: 'center',
              gap: 10,
              zIndex: 500,
              shadowColor: playable ? rarityColor : '#000',
              shadowOpacity: 0.8,
              shadowRadius: 20,
              elevation: 30,
            }}
          >
            <Text style={{ fontSize: 52 }}>{hcard.icon}</Text>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 }}>{hcard.name}</Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
              <Text style={{ color: '#AAA', fontSize: 11, fontWeight: 'bold' }}>{hcard.req}</Text>
            </View>
            <Text style={{ color: '#CCC', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>{hcard.desc}</Text>
          </View>
        );
      })()}

      {/* ── Cards ── */}
      <View style={s.cardsRow}>
        {hand.map((instId, idx) => {
          const inst = cardCollection.find((c) => c.instanceId === instId);
          const card = inst ? CARD_MAP[inst.id] : null;
          const isLocked = lockedCards.includes(instId);
          const drawAnim = cardDrawAnims.current.get(instId) ?? cardZeroAnim;
          const n = hand.length;
          const mid = (n - 1) / 2;
          const offset = idx - mid;
          const rotateDeg = offset * 5;
          const arcY = Math.abs(offset) * 7;
          const isHovered = hoveredCardId === instId;
          return card ? (
            <Animated.View
              key={instId}
              onMouseEnter={() => setHoveredCardId(instId)}
              onMouseLeave={() => setHoveredCardId(null)}
              style={{
                transform: [
                  { translateY: drawAnim },
                  { translateY: isHovered ? arcY - 16 : arcY },
                  { rotate: isHovered ? '0deg' : `${rotateDeg}deg` },
                  { scale: isHovered ? 1.08 : 1 },
                ],
                zIndex: isHovered ? 100 : idx,
              }}
            >
              <CardView
                card={card}
                dice={dice}
                onPlay={enemyRolling || isLocked ? () => {} : () => { setHoveredCardId(null); playCard(card, instId); }}
                disabled={enemyRolling || isLocked}
                isLocked={isLocked}
              />
            </Animated.View>
          ) : null;
        })}
      </View>


      {/* ── Buff shop overlay ── */}
      {showBuffShop && !showDropBuff && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 998, elevation: 998 }]}>
          <BuffShopScreen
            bossSouls={bossSouls}
            activeBuffs={activeBuffs}
            purchasedBuffIds={purchasedBuffIds}
            onBuy={handleBuyBuff}
            onClose={handleCloseBuffShop}
          />
        </View>
      )}

      {/* ── Drop buff overlay ── */}
      {showDropBuff && pendingNewBuff && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 998, elevation: 998 }]}>
          <DropBuffScreen
            activeBuffs={activeBuffs}
            pendingBuff={pendingNewBuff}
            onDrop={handleDropBuff}
          />
        </View>
      )}

      {/* ── Bribe screen overlay ── */}
      {showBribeScreen && (
        <View style={StyleSheet.absoluteFill}>
          <BribeScreen
            runes={runRunes}
            encounterType={encounterType}
            onBribe={handleBribeAttempt}
            onCancel={() => setShowBribeScreen(false)}
          />
        </View>
      )}

      {/* ── Bribe result flash overlay ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: bribeFlashColor === 'success'
              ? 'rgba(39,174,96,0.38)'
              : 'rgba(192,57,43,0.42)',
            opacity: bribeFlashAnim,
          },
        ]}
      />

      {/* ── Victory flash overlay (last enemy dies) ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#27AE60', opacity: victoryFlashAnim }]}
      />

      {/* ── Die picker overlay (weighted or storm) ── */}
      {weightedPickerDie !== null && (
        <View style={s.weightedOverlay}>
          {weightedPickerDie.type === 'storm' ? (
            <>
              <Text style={s.weightedTitle}>Storm Die</Text>
              <Text style={s.weightedSub}>Choose one result</Text>
              <View style={s.weightedRow}>
                {weightedPickerDie.rolls.map((val, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={s.weightedBtn}
                    onPress={() => {
                      const next = dice.map((d, i) =>
                        i === weightedPickerDie.idx ? { ...d, val } : d
                      );
                      setDice(next);
                      setWeightedPickerDie(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.weightedBtnText}>{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={s.weightedTitle}>Weighted Die</Text>
              <Text style={s.weightedSub}>Choose any face (1–5)</Text>
              <View style={s.weightedRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={s.weightedBtn}
                    onPress={() => {
                      const next = dice.map((d, i) =>
                        i === weightedPickerDie.idx ? { ...d, val: n } : d
                      );
                      setDice(next);
                      const nextWIdx = next.findIndex((d, i) => i > weightedPickerDie.idx && d.dieId === 'weighted' && !d.used);
                      if (nextWIdx !== -1) {
                        setWeightedPickerDie({ idx: nextWIdx, type: 'weighted' });
                      } else {
                        setWeightedPickerDie(null);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.weightedBtnText}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Card reward screen ── */}
      {phase === 'cardReward' && (
        <View style={StyleSheet.absoluteFill}>
          <CardReward encounterType={encounterType} onRewardSelected={handleRewardSelected} onRollSound={playDiceSound} />
        </View>
      )}

      {/* ── Ability info modal ── */}
      {selectedAbilityInfo && (
        <TouchableOpacity
          style={s.abilityModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedAbilityInfo(null)}
        >
          <View style={s.abilityModalBox}>
            <Text style={s.abilityModalIcon}>{selectedAbilityInfo.icon}</Text>
            <Text style={s.abilityModalName}>{selectedAbilityInfo.name}</Text>
            <Text style={s.abilityModalDesc}>{selectedAbilityInfo.desc}</Text>
            <Text style={s.abilityModalHint}>Tap to close</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Lose overlay ── */}
      {phase === 'lose' && (
        <View style={s.overlay}>
          <Text style={s.overlayTitle}>💀 Defeated!</Text>
          <Text style={s.overlaySub}>You have been vanquished after {combatCount} combat{combatCount !== 1 ? 's' : ''}.</Text>
          <Text style={s.overlayRunes}>💎 {runRunes} runes carried forward</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => {
              setRunes(prev => prev + runRunes);
              setRunRunes(0);
              setHasActiveRun(false);
              setShrineFrom('lose');
              setScreen('shrine');
            }}
            activeOpacity={0.8}
          >
            <Text style={s.retryText}>🏛️ Visit Shrine</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main Menu screen ── */}
      {screen === 'mainMenu' && (
        <View style={[StyleSheet.absoluteFill, s.mainMenuContainer]}>
          <Text style={s.mainMenuTitle}>⚔️ Runebound Duel</Text>
          <View style={s.mainMenuButtonsContainer}>
            <TouchableOpacity
              style={s.mainMenuBtn}
              onPress={handleStartNewRun}
              activeOpacity={0.8}
            >
              <Text style={s.mainMenuBtnText}>Start New Run</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.mainMenuBtn, !hasActiveRun && s.mainMenuBtnDisabled]}
              onPress={handleContinueRun}
              disabled={!hasActiveRun}
              activeOpacity={0.8}
            >
              <Text style={s.mainMenuBtnText}>Continue Run</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.mainMenuBtn}
              onPress={goToEquipFromMainMenu}
              activeOpacity={0.8}
            >
              <Text style={s.mainMenuBtnText}>Loadout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Pre-Combat screen ── */}
      {screen === 'preCombat' && (
        <View style={[StyleSheet.absoluteFill, s.preCombatContainer]}>
          <View style={s.preCombatContent}>
            <View style={s.preCombatHeader}>
              <Text style={s.preCombatLevelLabel}>LEVEL {currentLevel} — {LEVEL_NAMES[currentLevel] || ''}</Text>
              <Text style={s.preCombatTitle}>
                Combat {levelCombatCount + 1} of 10
                {getEncounterType(levelCombatCount + 1) === 'miniBoss' ? '  ⚡' : getEncounterType(levelCombatCount + 1) === 'boss' ? '  👹' : ''}
              </Text>
              {chaosModifier && (
                <View style={s.preCombatChaosTag}>
                  <Text style={s.preCombatChaosText}>{chaosModifier.icon} {chaosModifier.name}</Text>
                </View>
              )}
            </View>
            <View style={s.preCombatButtons}>
              <TouchableOpacity
                style={[s.preCombatBtn, s.preCombatBtnSecondary]}
                onPress={() => setScreen('mainMenu')}
                activeOpacity={0.8}
              >
                <Text style={s.preCombatBtnText}>⌂ Menu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.preCombatBtn, s.preCombatBtnSecondary]}
                onPress={goToEquipFromPreCombat}
                activeOpacity={0.8}
              >
                <Text style={s.preCombatBtnText}>Loadout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.preCombatBtn}
                onPress={() => {
                  const dice = equippedDice.length > 0
                    ? equippedDice
                    : diceCollection.slice(0, pDiceSlots);
                  const cards = equippedCardIds.length > 0
                    ? equippedCardIds
                    : cardCollection.slice(0, pCardSlots).map(c => c.instanceId);
                  startCombat(cards, dice);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.preCombatBtnText}>Ready →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Story screen ── */}
      {screen === 'story' && (
        <View style={StyleSheet.absoluteFill}>
          <StoryScreen usedIds={usedScenarioIds} onComplete={handleStoryComplete} />
        </View>
      )}

      {/* ── Shrine screen ── */}
      {screen === 'shrine' && (
        <View style={StyleSheet.absoluteFill}>
          <ShrineScreen
            runes={runes}
            upgrades={{
              cardSlots: pCardSlots,
              diceSlots: pDiceSlots,
              hpBonus:   pHpBonus,
              goldBonus: pGoldBonus,
              rareCard:  pRareCard,
              rareDie:   pRareDie,
            }}
            onBuy={handleShrineBuy}
            onContinue={startNewRun}
            onBack={shrineFrom === 'equip' ? () => setScreen('equip') : null}
            onMainMenu={shrineFrom !== 'equip' ? () => setScreen('mainMenu') : null}
          />
        </View>
      )}

      {/* ── Equip screen ── */}
      {screen === 'equip' && (
        <View style={StyleSheet.absoluteFill}>
          <EquipScreen
            cardCollection={cardCollection}
            defaultCards={equippedCardIds}
            diceCollection={diceCollection}
            defaultDice={equippedDice.map((d) => d.instanceId)}
            onReady={(cardIds, equipped) => {
              setEquippedCardIds(cardIds);
              setEquippedDice(equipped);
              setScreen(equipFromScreen);
            }}
            cardLimit={pCardSlots}
            diceLimit={pDiceSlots}
            runes={runes}
            onShrine={() => {
              if (hasActiveRun) {
                setShrineLockedToast(true);
                setTimeout(() => setShrineLockedToast(false), 2800);
              } else {
                setShrineFrom('equip');
                setScreen('shrine');
              }
            }}
            readyLabel="Done"
          />
          {/* ── Shrine locked toast ── */}
          {shrineLockedToast && (
            <View style={s.shrineLockedToast} pointerEvents="none">
              <Text style={s.shrineLockedText}>🏛️ The Shrine awaits your return...</Text>
              <Text style={s.shrineLockedSub}>Finish your run first</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Upgrade Shop screen ── */}
      {screen === 'upgradeShop' && (
        <View style={StyleSheet.absoluteFill}>
          <UpgradeShopScreen
            cardCollection={cardCollection}
            runes={runRunes}
            upgradeNext={UPGRADE_NEXT}
            upgradeCost={UPGRADE_COST}
            upgradeTierLabel={UPGRADE_TIER_LABEL}
            upgradeCardMap={UPGRADE_CARDS_BY_ID}
            onUpgrade={handleUpgradeCard}
            onContinue={handleShopContinue}
          />
        </View>
      )}

      {/* ── Level Start screen ── */}
      {screen === 'levelStart' && (
        <View style={StyleSheet.absoluteFill}>
          <LevelStartScreen
            level={currentLevel}
            modifier={chaosModifier}
            onEnter={() => setScreen('preCombat')}
          />
        </View>
      )}

      {/* ── Level Complete screen ── */}
      {screen === 'levelComplete' && (
        <View style={StyleSheet.absoluteFill}>
          <LevelCompleteScreen
            completedLevel={currentLevel - 1}
            runesEarned={levelRunesEarned}
            nextModifier={pendingNextModifier}
            nextLevel={currentLevel}
            isRunComplete={false}
            onNext={handleEnterNextLevel}
          />
        </View>
      )}

      {/* ── Run Complete screen ── */}
      {screen === 'runComplete' && (
        <View style={[StyleSheet.absoluteFill, s.runCompleteContainer]}>
          <Text style={s.runCompleteTitle}>🏆 RUN COMPLETE!</Text>
          <Text style={s.runCompleteSubtitle}>All 10 levels conquered</Text>
          <View style={s.runCompleteStats}>
            <Text style={s.runCompleteStat}>💎 {totalRunesEarned} runes earned</Text>
            <Text style={s.runCompleteStat}>⚔️ {combatCount} combats won</Text>
            <Text style={[s.runCompleteStat, { color: C.gold, fontSize: 18 }]}>+200 bonus runes!</Text>
          </View>
          <TouchableOpacity
            style={s.runCompleteBtn}
            onPress={() => {
              setRunes(prev => prev + runRunes + 200);
              setRunRunes(0);
              setShrineFrom('lose');
              setHasActiveRun(false);
              setScreen('shrine');
            }}
            activeOpacity={0.8}
          >
            <Text style={s.runCompleteBtnText}>🏛️ Claim Rewards</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>{/* end content-below-top-bar wrapper */}
      </View>{/* end scale wrapper */}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const mobileStyles = StyleSheet.create({
  root: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: C.bg,
    overflow: 'hidden',
    paddingTop: RNStatusBar.currentHeight || 0,
  },

  // Enemy bar
  enemyBar: {
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  enemyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  combatNumber: {
    color: C.gold,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  enemyName: {
    color: C.red,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bossAbilitiesPreview: {
    color: C.gold,
    fontSize: 10,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  // Intention display
  enemyAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intentionBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  intentionIcon: {
    fontSize: 18,
  },
  intentionValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Enemy shield
  enemyShieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  enemyShieldLabel: {
    color: C.blue,
    fontSize: 11,
    fontWeight: 'bold',
    width: 52,
  },

  // Active ability badges
  activeBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(170,0,255,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#AA00FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  activeBadgeIcon: {
    fontSize: 14,
  },
  activeBadgeTurns: {
    color: '#AA00FF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  abilitiesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  abilityEmoji: {
    fontSize: 22,
  },
  abilityModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abilityModalBox: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
    width: '75%',
  },
  abilityModalIcon: {
    fontSize: 40,
  },
  abilityModalName: {
    color: C.gold,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  abilityModalDesc: {
    color: C.text,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
  },
  abilityModalHint: {
    color: C.muted,
    fontSize: 10,
    marginTop: 8,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hpLabel: {
    color: C.muted,
    fontSize: 11,
    width: 52,
  },
  hpTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 5,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 5,
  },
  shieldBadge: {
    color: C.blue,
    fontSize: 12,
    marginLeft: 4,
  },
  runesBadge: {
    color: '#27AE60',
    fontSize: 12,
    marginLeft: 4,
  },
  soulsBadge: {
    color: '#5BC8E8',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  activeBuffsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  activeBuffIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#16213E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBuffEmoji: {
    fontSize: 16,
  },
  divineBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E2B04A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  divineBtnText: {
    fontSize: 20,
  },

  // Battlefield
  battlefield: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  playerSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  enemySide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playerCharacterImg: {
    width: Math.round(140 * CHAR_SCALE),
    height: Math.round(170 * CHAR_SCALE),
  },
  avatarBox: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    fontSize: 52,
  },
  avatarLabel: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
  divider: {
    width: '70%',
    height: 1,
    backgroundColor: C.purple,
    opacity: 0.35,
  },

  // Message
  messageRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    minHeight: 34,
    position: 'relative',
    top: -15,
  },
  messageText: {
    color: C.gold,
    fontSize: 13,
    textAlign: 'center',
  },

  // Player bar
  playerBar: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    position: 'relative',
    top: -15,
  },

  // Dice
  diceSection: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 4,
    marginBottom: 4,
  },
  diceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  die: {
    width: 48,
    height: 48,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieEmpty: {
    backgroundColor: '#1A1A3A',
    borderColor: '#3A3A5A',
  },
  dieRolled: {
    backgroundColor: C.primary,
    borderColor: C.purple,
  },
  dieUsed: {
    backgroundColor: '#111',
    borderColor: '#2A2A2A',
    opacity: 0.35,
  },
  dieIcon: {
    fontSize: 20,
  },
  dieText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Enemy dice roll
  enemyRollSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  enemyRollLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  enemyDiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  enemyDie: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.red,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyDieText: {
    color: C.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  enemyRollResult: {
    alignItems: 'center',
    gap: 4,
  },
  enemyDiceSum: {
    color: C.gold,
    fontSize: 20,
    fontWeight: 'bold',
  },
  enemyRollStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  rollControls: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    height: 48,
    gap: 4,
  },
  rollsLeft: {
    color: C.muted,
    fontSize: 12,
  },
  rollBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
  },
  rollBtnOff: {
    opacity: 0.3,
  },
  rollBtnText: {
    color: C.text,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },

  // Cards
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 0,
    overflow: 'visible',
    gap: 4,
  },
  card: {
    width: 72,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    gap: 2,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  cardOn: {
    backgroundColor: C.primary,
  },
  cardOff: {
    backgroundColor: '#0D0D1A',
    opacity: 0.55,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardName: {
    color: C.text,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardDesc: {
    color: C.muted,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 13,
  },
  cardReqBadge: {
    backgroundColor: C.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },
  cardReqText: {
    color: C.purple,
    fontSize: 8,
    textAlign: 'center',
  },
  lockOverlay: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF4444',
  },
  lockIcon: {
    fontSize: 24,
  },

  // End Turn
  bottomRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 8,
  },
  endTurnBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  endTurnText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  menuBtn: {
    flex: 0.8,
    backgroundColor: C.purple,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.gold,
  },
  menuBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  debugKillBtn: {
    backgroundColor: 'rgba(192,57,43,0.3)',
    borderWidth: 1,
    borderColor: C.red,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugKillText: {
    color: C.red,
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Weighted picker
  weightedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 999,
    elevation: 999,
  },
  weightedTitle: {
    color: '#E2B04A',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  weightedSub: {
    color: '#777',
    fontSize: 14,
  },
  weightedRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  weightedBtn: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#7B2FBE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightedBtnText: {
    color: '#EFEFEF',
    fontSize: 22,
    fontWeight: 'bold',
  },

  // Overlays
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  overlayTitle: {
    color: C.gold,
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  overlaySub: {
    color: C.text,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.8,
  },
  overlayRunes: {
    color:       C.gold,
    fontSize:    20,
    fontWeight:  'bold',
    letterSpacing: 1,
    marginTop:   4,
  },
  retryBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: 44,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Main Menu
  mainMenuContainer: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mainMenuTitle: {
    color: C.gold,
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 60,
    letterSpacing: 2,
  },
  mainMenuButtonsContainer: {
    width: '100%',
    gap: 14,
  },
  mainMenuBtn: {
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  mainMenuBtnDisabled: {
    opacity: 0.4,
  },
  mainMenuBtnText: {
    color: C.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Pre-Combat
  preCombatContainer: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  preCombatContent: {
    alignItems: 'center',
    gap: 40,
  },
  preCombatTitle: {
    color: C.gold,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  preCombatButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  preCombatBtn: {
    flex: 1,
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  preCombatBtnSecondary: {
    backgroundColor: 'transparent',
  },
  preCombatBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Pre-combat level info
  preCombatHeader: {
    alignItems: 'center',
    gap: 8,
  },
  preCombatLevelLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  preCombatChaosTag: {
    backgroundColor: 'rgba(170,0,255,0.2)',
    borderWidth: 1,
    borderColor: '#AA00FF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  preCombatChaosText: {
    color: '#CC66FF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Chaos modifier badge in combat
  chaosBadge: {
    backgroundColor: 'rgba(170,0,255,0.18)',
    borderWidth: 1,
    borderColor: '#AA00FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chaosBadgeText: {
    color: '#CC66FF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Bribe system
  bribeGameBtn: {
    backgroundColor: 'rgba(226,176,74,0.12)',
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bribeGameBtnText: {
    fontSize: 18,
  },
  enragedBadge: {
    backgroundColor: 'rgba(192,57,43,0.22)',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  enragedBadgeText: {
    color: C.red,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  avatarWrap: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  avatarWrapEnraged: {
    borderColor: C.red,
    backgroundColor: 'rgba(192,57,43,0.18)',
  },

  // Run Complete screen
  runCompleteContainer: {
    backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 30,
  },
  runCompleteTitle: {
    color: C.gold,
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  runCompleteSubtitle: {
    color: C.text,
    fontSize: 16,
    opacity: 0.7,
    letterSpacing: 1,
  },
  runCompleteStats: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  runCompleteStat: {
    color: C.text,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  runCompleteBtn: {
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  runCompleteBtnText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Multi-enemy
  multiEnemyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  multiEnemyCard: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  multiEnemyCardSelected: {
    // selection shown by 🎯 icon only
  },
  multiEnemyTargetIcon: {
    fontSize: 12,
    position: 'absolute',
    top: 2,
    right: 4,
  },
  multiEnemyHP: {
    color: '#EFEFEF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  multiEnemyShieldText: {
    color: '#5BC8E8',
    fontSize: 10,
  },
  multiEnemyIntention: {
    fontSize: 14,
    color: '#EFEFEF',
    fontWeight: 'bold',
  },

  // Shrine locked toast
  shrineLockedToast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,52,96,0.95)',
    borderWidth: 1.5,
    borderColor: '#E2B04A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
  },
  shrineLockedText: {
    color: '#E2B04A',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  shrineLockedSub: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
  },
});

// ─── PC Styles (width ≥ 768) ─────────────────────────────────────────────────

const pcStyles = StyleSheet.create({
  root: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: C.bg,
    overflow: 'hidden',
    paddingTop: RNStatusBar.currentHeight || 0,
  },

  // Enemy bar
  enemyBar: {
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  enemyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  combatNumber: {
    color: C.gold,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  enemyName: {
    color: C.red,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bossAbilitiesPreview: {
    color: C.gold,
    fontSize: 10,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  // Intention display
  enemyAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  intentionBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  intentionIcon: {
    fontSize: 18,
  },
  intentionValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Enemy shield
  enemyShieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  enemyShieldLabel: {
    color: C.blue,
    fontSize: 11,
    fontWeight: 'bold',
    width: 52,
  },

  // Active ability badges
  activeBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(170,0,255,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#AA00FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  activeBadgeIcon: {
    fontSize: 14,
  },
  activeBadgeTurns: {
    color: '#AA00FF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  abilitiesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  abilityEmoji: {
    fontSize: 22,
  },
  abilityModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abilityModalBox: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
    width: '75%',
  },
  abilityModalIcon: {
    fontSize: 40,
  },
  abilityModalName: {
    color: C.gold,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  abilityModalDesc: {
    color: C.text,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
  },
  abilityModalHint: {
    color: C.muted,
    fontSize: 10,
    marginTop: 8,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hpLabel: {
    color: C.muted,
    fontSize: 11,
    width: 52,
  },
  hpTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 5,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 5,
  },
  shieldBadge: {
    color: C.blue,
    fontSize: 12,
    marginLeft: 4,
  },
  runesBadge: {
    color: '#27AE60',
    fontSize: 12,
    marginLeft: 4,
  },
  soulsBadge: {
    color: '#5BC8E8',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  activeBuffsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  activeBuffIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#16213E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBuffEmoji: {
    fontSize: 16,
  },
  divineBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E2B04A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  divineBtnText: {
    fontSize: 20,
  },

  // Battlefield
  battlefield: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  playerSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  enemySide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playerCharacterImg: {
    width: Math.round(150 * CHAR_SCALE),
    height: Math.round(180 * CHAR_SCALE),
  },
  avatarBox: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    fontSize: 52,
  },
  avatarLabel: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
  divider: {
    width: '70%',
    height: 1,
    backgroundColor: C.purple,
    opacity: 0.35,
  },

  // Message
  messageRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    minHeight: 34,
    position: 'relative',
    top: -15,
  },
  messageText: {
    color: C.gold,
    fontSize: 13,
    textAlign: 'center',
  },

  // Player bar
  playerBar: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    position: 'relative',
    top: -15,
  },

  // Dice
  diceSection: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingBottom: 4,
    marginBottom: 4,
  },
  diceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  die: {
    width: 48,
    height: 48,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dieEmpty: {
    backgroundColor: '#1A1A3A',
    borderColor: '#3A3A5A',
  },
  dieRolled: {
    backgroundColor: C.primary,
    borderColor: C.purple,
  },
  dieUsed: {
    backgroundColor: '#111',
    borderColor: '#2A2A2A',
    opacity: 0.35,
  },
  dieIcon: {
    fontSize: 20,
  },
  dieText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Enemy dice roll
  enemyRollSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  enemyRollLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  enemyDiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  enemyDie: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.red,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyDieText: {
    color: C.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  enemyRollResult: {
    alignItems: 'center',
    gap: 4,
  },
  enemyDiceSum: {
    color: C.gold,
    fontSize: 20,
    fontWeight: 'bold',
  },
  enemyRollStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  rollControls: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    height: 48,
    gap: 4,
  },
  rollsLeft: {
    color: C.muted,
    fontSize: 12,
  },
  rollBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
  },
  rollBtnOff: {
    opacity: 0.3,
  },
  rollBtnText: {
    color: C.text,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },

  // Cards
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 8,
    overflow: 'visible',
    gap: 6,
  },
  card: {
    width: 72,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 3,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  cardOn: {
    backgroundColor: C.primary,
  },
  cardOff: {
    backgroundColor: '#0D0D1A',
    opacity: 0.55,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardName: {
    color: C.text,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardDesc: {
    color: C.muted,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 13,
  },
  cardReqBadge: {
    backgroundColor: C.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },
  cardReqText: {
    color: C.purple,
    fontSize: 8,
    textAlign: 'center',
  },
  lockOverlay: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF4444',
  },
  lockIcon: {
    fontSize: 24,
  },

  // End Turn
  bottomRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 8,
  },
  endTurnBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  endTurnText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  menuBtn: {
    flex: 0.8,
    backgroundColor: C.purple,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.gold,
  },
  menuBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  debugKillBtn: {
    backgroundColor: 'rgba(192,57,43,0.3)',
    borderWidth: 1,
    borderColor: C.red,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugKillText: {
    color: C.red,
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Weighted picker
  weightedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 999,
    elevation: 999,
  },
  weightedTitle: {
    color: '#E2B04A',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  weightedSub: {
    color: '#777',
    fontSize: 14,
  },
  weightedRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  weightedBtn: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#7B2FBE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightedBtnText: {
    color: '#EFEFEF',
    fontSize: 22,
    fontWeight: 'bold',
  },

  // Overlays
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  overlayTitle: {
    color: C.gold,
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  overlaySub: {
    color: C.text,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.8,
  },
  overlayRunes: {
    color:       C.gold,
    fontSize:    20,
    fontWeight:  'bold',
    letterSpacing: 1,
    marginTop:   4,
  },
  retryBtn: {
    backgroundColor: C.purple,
    paddingHorizontal: 44,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Main Menu
  mainMenuContainer: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mainMenuTitle: {
    color: C.gold,
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 60,
    letterSpacing: 2,
  },
  mainMenuButtonsContainer: {
    width: '100%',
    gap: 14,
  },
  mainMenuBtn: {
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  mainMenuBtnDisabled: {
    opacity: 0.4,
  },
  mainMenuBtnText: {
    color: C.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Pre-Combat
  preCombatContainer: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  preCombatContent: {
    alignItems: 'center',
    gap: 40,
  },
  preCombatTitle: {
    color: C.gold,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  preCombatButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  preCombatBtn: {
    flex: 1,
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  preCombatBtnSecondary: {
    backgroundColor: 'transparent',
  },
  preCombatBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Pre-combat level info
  preCombatHeader: {
    alignItems: 'center',
    gap: 8,
  },
  preCombatLevelLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  preCombatChaosTag: {
    backgroundColor: 'rgba(170,0,255,0.2)',
    borderWidth: 1,
    borderColor: '#AA00FF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  preCombatChaosText: {
    color: '#CC66FF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Chaos modifier badge in combat
  chaosBadge: {
    backgroundColor: 'rgba(170,0,255,0.18)',
    borderWidth: 1,
    borderColor: '#AA00FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chaosBadgeText: {
    color: '#CC66FF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Bribe system
  bribeGameBtn: {
    backgroundColor: 'rgba(226,176,74,0.12)',
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bribeGameBtnText: {
    fontSize: 18,
  },
  enragedBadge: {
    backgroundColor: 'rgba(192,57,43,0.22)',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  enragedBadgeText: {
    color: C.red,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  avatarWrap: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  avatarWrapEnraged: {
    borderColor: C.red,
    backgroundColor: 'rgba(192,57,43,0.18)',
  },

  // Run Complete screen
  runCompleteContainer: {
    backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 30,
  },
  runCompleteTitle: {
    color: C.gold,
    fontSize: 38,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  runCompleteSubtitle: {
    color: C.text,
    fontSize: 16,
    opacity: 0.7,
    letterSpacing: 1,
  },
  runCompleteStats: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  runCompleteStat: {
    color: C.text,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  runCompleteBtn: {
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.gold,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  runCompleteBtnText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Multi-enemy
  multiEnemyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  multiEnemyCard: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  multiEnemyCardSelected: {
    // selection shown by 🎯 icon only
  },
  multiEnemyTargetIcon: {
    fontSize: 12,
    position: 'absolute',
    top: 2,
    right: 4,
  },
  multiEnemyHP: {
    color: '#EFEFEF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  multiEnemyShieldText: {
    color: '#5BC8E8',
    fontSize: 10,
  },
  multiEnemyIntention: {
    fontSize: 14,
    color: '#EFEFEF',
    fontWeight: 'bold',
  },

  // Shrine locked toast
  shrineLockedToast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,52,96,0.95)',
    borderWidth: 1.5,
    borderColor: '#E2B04A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
  },
  shrineLockedText: {
    color: '#E2B04A',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  shrineLockedSub: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
  },
});

// ─── Active style set (refreshing the page switches between PC and mobile) ───
const IS_PC = SCREEN_W >= 768;
const s = IS_PC ? pcStyles : mobileStyles;
