/**
 * CardUpgrades.js
 * Defines all upgrade variants of existing cards, new base cards,
 * and the metadata (upgrade chains, costs, tier labels) for the upgrade system.
 */

import { getDamageMultiplier, rollDie } from './DiceTypes';

// ─── Local dice helpers (mirrors of App.js) ───────────────────────────────────
const rnd6 = () => Math.floor(Math.random() * 6) + 1;
const avail = (dice) => dice.filter(d => !d.used && d.val !== null).map(d => d.val);
const hasPair = (dice) => {
  const v = avail(dice); const c = {};
  v.forEach(x => (c[x] = (c[x] || 0) + 1));
  return Object.values(c).some(n => n >= 2);
};
const hasTriple = (dice) => {
  const v = avail(dice); const c = {};
  v.forEach(x => (c[x] = (c[x] || 0) + 1));
  return Object.values(c).some(n => n >= 3);
};
const hasThreeDiff = (dice) => new Set(avail(dice)).size >= 3;
const hasTwoDiff   = (dice) => new Set(avail(dice)).size >= 2;

function usePair(dice) {
  const v = avail(dice); const c = {};
  v.forEach(x => (c[x] = (c[x] || 0) + 1));
  const pv = Number(Object.keys(c).find(k => c[k] >= 2));
  const next = dice.map(d => ({ ...d })); let rem = 0;
  for (let i = 0; i < next.length && rem < 2; i++) {
    if (!next[i].used && next[i].val === pv) { next[i].used = true; rem++; }
  }
  return next;
}
function useTriple(dice) {
  const v = avail(dice); const c = {};
  v.forEach(x => (c[x] = (c[x] || 0) + 1));
  const tv = Number(Object.keys(c).find(k => c[k] >= 3));
  const next = dice.map(d => ({ ...d })); let rem = 0;
  for (let i = 0; i < next.length && rem < 3; i++) {
    if (!next[i].used && next[i].val === tv) { next[i].used = true; rem++; }
  }
  return next;
}
function useThreeDiff(dice) {
  const uniq = [...new Set(avail(dice))].slice(0, 3);
  const next = dice.map(d => ({ ...d }));
  for (const v of uniq) {
    const i = next.findIndex(d => !d.used && d.val === v);
    if (i !== -1) next[i].used = true;
  }
  return next;
}
function useTwoDiff(dice) {
  const uniq = [...new Set(avail(dice))].slice(0, 2);
  const next = dice.map(d => ({ ...d }));
  for (const v of uniq) {
    const i = next.findIndex(d => !d.used && d.val === v);
    if (i !== -1) next[i].used = true;
  }
  return next;
}
function useAny(dice) {
  const next = dice.map(d => ({ ...d }));
  const i = next.findIndex(d => !d.used && d.val !== null);
  if (i !== -1) next[i].used = true;
  return next;
}
function useDie(dice, minVal) {
  const next = dice.map(d => ({ ...d }));
  const i = next.findIndex(d => !d.used && d.val >= minVal);
  if (i !== -1) next[i].used = true;
  return { next, die: dice[i] || {} };
}

// ─── Attack card IDs (for Chain Strike isChained detection) ──────────────────
export const ALL_ATTACK_IDS = [
  'slash','slash_rare','slash_epic','slash_legendary',
  'inferno','inferno_rare','inferno_epic','inferno_legendary',
  'gambler','gambler_rare','gambler_epic','gambler_legendary',
  'blood_pact','blood_pact_epic','blood_pact_legendary',
  'death_wish','death_wish_legendary',
  'soul_drain','soul_drain_legendary',
  'chain_strike','chain_strike_rare','chain_strike_epic','chain_strike_legendary',
  'thunder_combo','thunder_combo_epic','thunder_combo_legendary',
  'reaper','reaper_epic','reaper_legendary',
  'lifesteal','lifesteal_epic','lifesteal_legendary',
  'chain','chain_epic','chain_legendary',
  'death_touch','perfect_strike','chaos_nova','explosion_chain',
];

// ─── Upgrade metadata ─────────────────────────────────────────────────────────

/** Maps a card ID to the next (upgraded) card ID. null = already at max. */
export const UPGRADE_NEXT = {
  // Common → Rare (50g)
  slash:       'slash_rare',       shield:      'shield_rare',
  inferno:     'inferno_rare',     gambler:     'gambler_rare',
  chain_strike:'chain_strike_rare',
  // Rare → Epic (120g)
  slash_rare:       'slash_epic',       shield_rare:      'shield_epic',
  inferno_rare:     'inferno_epic',     gambler_rare:     'gambler_epic',
  chain_strike_rare:'chain_strike_epic',
  reaper:       'reaper_epic',       lifesteal:    'lifesteal_epic',
  freeze:       'freeze_epic',       chain:        'chain_epic',
  thunder_combo:'thunder_combo_epic', blood_pact:  'blood_pact_epic',
  // Epic → Legendary (300g)
  slash_epic:       'slash_legendary',       shield_epic:      'shield_legendary',
  inferno_epic:     'inferno_legendary',     gambler_epic:     'gambler_legendary',
  chain_strike_epic:'chain_strike_legendary',
  reaper_epic:      'reaper_legendary',      lifesteal_epic:   'lifesteal_legendary',
  freeze_epic:      'freeze_legendary',      chain_epic:       'chain_legendary',
  thunder_combo_epic:'thunder_combo_legendary', blood_pact_epic:'blood_pact_legendary',
  echo:         'echo_legendary',
  death_wish:   'death_wish_legendary',
  soul_drain:   'soul_drain_legendary',
};

/** Rune cost to perform each upgrade. */
export const UPGRADE_COST = {
  // 50g  – Common → Rare
  slash:50, shield:50, inferno:50, gambler:50, chain_strike:50,
  // 120g – Rare → Epic
  slash_rare:120, shield_rare:120, inferno_rare:120, gambler_rare:120,
  chain_strike_rare:120,
  reaper:120, lifesteal:120, freeze:120, chain:120,
  thunder_combo:120, blood_pact:120,
  // 300g – Epic → Legendary
  slash_epic:300, shield_epic:300, inferno_epic:300, gambler_epic:300,
  chain_strike_epic:300,
  reaper_epic:300, lifesteal_epic:300, freeze_epic:300, chain_epic:300,
  thunder_combo_epic:300, blood_pact_epic:300,
  echo:300, death_wish:300, soul_drain:300,
};

/** Maps upgraded card ID → base card ID. */
export const CARD_BASE_ID = {
  slash_rare:'slash', slash_epic:'slash', slash_legendary:'slash',
  shield_rare:'shield', shield_epic:'shield', shield_legendary:'shield',
  inferno_rare:'inferno', inferno_epic:'inferno', inferno_legendary:'inferno',
  gambler_rare:'gambler', gambler_epic:'gambler', gambler_legendary:'gambler',
  reaper_epic:'reaper', reaper_legendary:'reaper',
  lifesteal_epic:'lifesteal', lifesteal_legendary:'lifesteal',
  freeze_epic:'freeze', freeze_legendary:'freeze',
  chain_epic:'chain', chain_legendary:'chain',
  thunder_combo_epic:'thunder_combo', thunder_combo_legendary:'thunder_combo',
  blood_pact_epic:'blood_pact', blood_pact_legendary:'blood_pact',
  chain_strike_rare:'chain_strike', chain_strike_epic:'chain_strike', chain_strike_legendary:'chain_strike',
  echo_legendary:'echo',
  death_wish_legendary:'death_wish',
  soul_drain_legendary:'soul_drain',
};

/** Human-readable upgrade tier label per card ID. */
export const UPGRADE_TIER_LABEL = {
  slash:'Common', shield:'Common', inferno:'Common', gambler:'Common', chain_strike:'Common',
  slash_rare:'Rare', shield_rare:'Rare', inferno_rare:'Rare', gambler_rare:'Rare', chain_strike_rare:'Rare',
  reaper:'Rare', lifesteal:'Rare', freeze:'Rare', chain:'Rare', thunder_combo:'Rare', blood_pact:'Rare',
  slash_epic:'Epic', shield_epic:'Epic', inferno_epic:'Epic', gambler_epic:'Epic', chain_strike_epic:'Epic',
  reaper_epic:'Epic', lifesteal_epic:'Epic', freeze_epic:'Epic', chain_epic:'Epic',
  thunder_combo_epic:'Epic', blood_pact_epic:'Epic',
  echo:'Epic', death_wish:'Epic', soul_drain:'Epic',
  slash_legendary:'Legendary', shield_legendary:'Legendary', inferno_legendary:'Legendary',
  gambler_legendary:'Legendary', chain_strike_legendary:'Legendary',
  reaper_legendary:'Legendary', lifesteal_legendary:'Legendary', freeze_legendary:'Legendary',
  chain_legendary:'Legendary', thunder_combo_legendary:'Legendary', blood_pact_legendary:'Legendary',
  echo_legendary:'Legendary', death_wish_legendary:'Legendary', soul_drain_legendary:'Legendary',
};

/** Returns upgrade preview info for a card ID, or null if max tier. */
export function getUpgradePreview(currentId, allCardsById) {
  const nextId = UPGRADE_NEXT[currentId];
  if (!nextId) return null;
  const nextCard = allCardsById[nextId];
  if (!nextCard) return null;
  return {
    cost: UPGRADE_COST[currentId] || 0,
    nextId,
    nextCard: { id: nextCard.id, icon: nextCard.icon, name: nextCard.name, desc: nextCard.desc, req: nextCard.req, rarity: nextCard.rarity },
  };
}

// ─── Helper: get the base card ID of any card (base or upgraded) ─────────────
export function getBaseCardId(cardId) {
  return CARD_BASE_ID[cardId] || cardId;
}

// ─── New base cards (Rare starters that don't exist in the original game) ─────

export const NEW_BASE_CARDS = [
  {
    id: 'reaper', icon: '💀', name: 'Reaper',
    desc: 'Deal 50 damage, lose 10 HP',
    req: 'Triple any', rarity: 'rare',
    canPlay: hasTriple,
    play(dice) {
      return { dice: useTriple(dice), enemyDmg: 50, playerDmg: 10, msg: '💀 Reaper! 50 damage, -10 HP' };
    },
  },
  {
    id: 'lifesteal', icon: '🩸', name: 'Lifesteal',
    desc: 'Deal die × 1.5, heal half',
    req: 'Die 4+', rarity: 'rare',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 4),
    play(dice) {
      const { next, die } = useDie(dice, 4);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 1.5 * mult);
      const heal = Math.floor(dmg / 2);
      return { dice: next, enemyDmg: dmg, playerHeal: heal, msg: `🩸 Lifesteal! ${dmg} damage, +${heal} HP` };
    },
  },
  {
    id: 'freeze', icon: '❄️', name: 'Freeze',
    desc: 'Enemy skips next turn',
    req: 'Any pair', rarity: 'rare',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), enemyFreeze: 1, msg: '❄️ Freeze! Enemy skips their next turn.' };
    },
  },
  {
    id: 'chain', icon: '⛓️', name: 'Chain',
    desc: 'Deal 10 damage 3 times',
    req: 'Three different', rarity: 'rare',
    canPlay: hasThreeDiff,
    play(dice) {
      return { dice: useThreeDiff(dice), enemyDmg: 30, msg: '⛓️ Chain! 3 × 10 = 30 damage' };
    },
  },
];

// ─── Upgrade card variants ────────────────────────────────────────────────────

export const UPGRADE_CARDS = [

  // ── ⚔️ Slash upgrades ──────────────────────────────────────────────────────
  {
    id: 'slash_rare', icon: '⚔️', name: 'Slash+', rarity: 'rare',
    desc: 'Deal die × 3 damage', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = dice.map(d => ({ ...d }));
      const idx  = next.findIndex(d => !d.used && d.val !== null);
      const die  = next[idx]; die.used = true;
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 3 * mult);
      return { dice: next, enemyDmg: dmg, msg: `⚔️ Slash+! ${die.val} × 3 = ${dmg} damage` };
    },
  },
  {
    id: 'slash_epic', icon: '⚔️', name: 'Slash★', rarity: 'epic',
    desc: 'Deal die × 3, poison 2 turns', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = dice.map(d => ({ ...d }));
      const idx  = next.findIndex(d => !d.used && d.val !== null);
      const die  = next[idx]; die.used = true;
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 3 * mult);
      return { dice: next, enemyDmg: dmg, enemyDot: { dmg: 5, turns: 2, type: 'poison' },
               msg: `⚔️ Slash★! ${dmg} damage + ☠️ Poison 2 turns` };
    },
  },
  {
    id: 'slash_legendary', icon: '⚔️', name: 'Slash✦', rarity: 'legendary',
    desc: 'Die × 4, poison 3 turns, +5 HP', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = dice.map(d => ({ ...d }));
      const idx  = next.findIndex(d => !d.used && d.val !== null);
      const die  = next[idx]; die.used = true;
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 4 * mult);
      return { dice: next, enemyDmg: dmg, playerHeal: 5, enemyDot: { dmg: 5, turns: 3, type: 'poison' },
               msg: `⚔️ Slash✦! ${dmg} damage + ☠️ Poison 3t + +5 HP` };
    },
  },

  // ── 🛡️ Shield Wall upgrades ───────────────────────────────────────────────
  {
    id: 'shield_rare', icon: '🛡️', name: 'Shield Wall+', rarity: 'rare',
    desc: 'Block 25 damage', req: 'Any pair',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), shield: 25, msg: '🛡️ Shield Wall+! Blocking 25 damage' };
    },
  },
  {
    id: 'shield_epic', icon: '🛡️', name: 'Shield Wall★', rarity: 'epic',
    desc: 'Block 25, reflect 10 damage', req: 'Any pair',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), shield: 25, enemyDmg: 10, msg: '🛡️ Shield Wall★! 25 shield + 10 reflect!' };
    },
  },
  {
    id: 'shield_legendary', icon: '🛡️', name: 'Shield Wall✦', rarity: 'legendary',
    desc: 'Block 40, reflect 20, +10 HP', req: 'Any pair',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), shield: 40, enemyDmg: 20, playerHeal: 10,
               msg: '🛡️ Shield Wall✦! 40 shield + 20 reflect + +10 HP!' };
    },
  },

  // ── 🔥 Inferno upgrades ────────────────────────────────────────────────────
  {
    id: 'inferno_rare', icon: '🔥', name: 'Inferno+', rarity: 'rare',
    desc: 'Deal 40 damage', req: 'Die 5+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 5),
    play(dice) {
      const { next, die } = useDie(dice, 5);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(40 * mult);
      return { dice: next, enemyDmg: dmg, msg: `🔥 Inferno+! ${dmg} damage!` };
    },
  },
  {
    id: 'inferno_epic', icon: '🔥', name: 'Inferno★', rarity: 'epic',
    desc: 'Deal 40, burn 5/turn 3 turns', req: 'Die 5+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 5),
    play(dice) {
      const { next, die } = useDie(dice, 5);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(40 * mult);
      return { dice: next, enemyDmg: dmg, enemyDot: { dmg: 5, turns: 3, type: 'burn' },
               msg: `🔥 Inferno★! ${dmg} damage + 🔥 Burn 3 turns` };
    },
  },
  {
    id: 'inferno_legendary', icon: '🔥', name: 'Inferno✦', rarity: 'legendary',
    desc: 'Deal 60, burn 8/turn 4 turns', req: 'Die 4+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 4),
    play(dice) {
      const { next, die } = useDie(dice, 4);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(60 * mult);
      return { dice: next, enemyDmg: dmg, enemyDot: { dmg: 8, turns: 4, type: 'burn' },
               msg: `🔥 Inferno✦! ${dmg} damage + 🔥 Burn 4 turns` };
    },
  },

  // ── 🎲 Gambler upgrades ────────────────────────────────────────────────────
  {
    id: 'gambler_rare', icon: '🎲', name: 'Gambler+', rarity: 'rare',
    desc: '5-6 = 30 dmg · 1 = −15 HP', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = useAny(dice);
      const roll = rnd6();
      if (roll >= 5) return { dice: next, enemyDmg: 30, msg: `🎲 Gambler+ rolled ${roll}! 30 damage!` };
      if (roll === 1) return { dice: next, playerDmg: 15, msg: `🎲 Gambler+ rolled ${roll}! −15 HP!` };
      return { dice: next, msg: `🎲 Gambler+ rolled ${roll}. Nothing happens.` };
    },
  },
  {
    id: 'gambler_epic', icon: '🎲', name: 'Gambler★', rarity: 'epic',
    desc: '4-6 = 40 dmg · 1 = −10 HP', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = useAny(dice);
      const roll = rnd6();
      if (roll >= 4) return { dice: next, enemyDmg: 40, msg: `🎲 Gambler★ rolled ${roll}! 40 damage!` };
      if (roll === 1) return { dice: next, playerDmg: 10, msg: `🎲 Gambler★ rolled ${roll}! −10 HP!` };
      return { dice: next, msg: `🎲 Gambler★ rolled ${roll}. Nothing happens.` };
    },
  },
  {
    id: 'gambler_legendary', icon: '🎲', name: 'Gambler✦', rarity: 'legendary',
    desc: '3-6 = 50 dmg · 1 = −5 HP', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      const next = useAny(dice);
      const roll = rnd6();
      if (roll >= 3) return { dice: next, enemyDmg: 50, msg: `🎲 Gambler✦ rolled ${roll}! 50 damage!` };
      if (roll === 1) return { dice: next, playerDmg: 5, msg: `🎲 Gambler✦ rolled ${roll}! −5 HP!` };
      return { dice: next, msg: `🎲 Gambler✦ rolled ${roll}. Nothing happens.` };
    },
  },

  // ── 💀 Reaper upgrades ────────────────────────────────────────────────────
  {
    id: 'reaper_epic', icon: '💀', name: 'Reaper★', rarity: 'epic',
    desc: 'Deal 70 damage, lose 8 HP', req: 'Triple any',
    canPlay: hasTriple,
    play(dice) {
      return { dice: useTriple(dice), enemyDmg: 70, playerDmg: 8, msg: '💀 Reaper★! 70 damage, -8 HP' };
    },
  },
  {
    id: 'reaper_legendary', icon: '💀', name: 'Reaper✦', rarity: 'legendary',
    desc: 'Deal 100 damage, lose 5 HP', req: 'Triple any',
    canPlay: hasTriple,
    play(dice) {
      return { dice: useTriple(dice), enemyDmg: 100, playerDmg: 5, msg: '💀 Reaper✦! 100 damage, -5 HP' };
    },
  },

  // ── 🩸 Lifesteal upgrades ─────────────────────────────────────────────────
  {
    id: 'lifesteal_epic', icon: '🩸', name: 'Lifesteal★', rarity: 'epic',
    desc: 'Deal die × 2, heal half', req: 'Die 3+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 3),
    play(dice) {
      const { next, die } = useDie(dice, 3);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 2 * mult);
      const heal = Math.floor(dmg / 2);
      return { dice: next, enemyDmg: dmg, playerHeal: heal, msg: `🩸 Lifesteal★! ${dmg} damage, +${heal} HP` };
    },
  },
  {
    id: 'lifesteal_legendary', icon: '🩸', name: 'Lifesteal✦', rarity: 'legendary',
    desc: 'Deal die × 2.5, heal full dmg', req: 'Die 3+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 3),
    play(dice) {
      const { next, die } = useDie(dice, 3);
      const mult = getDamageMultiplier(die.dieId, die.val);
      const dmg  = Math.floor(die.val * 2.5 * mult);
      return { dice: next, enemyDmg: dmg, playerHeal: dmg, msg: `🩸 Lifesteal✦! ${dmg} damage, +${dmg} HP` };
    },
  },

  // ── ❄️ Freeze upgrades ────────────────────────────────────────────────────
  {
    id: 'freeze_epic', icon: '❄️', name: 'Freeze★', rarity: 'epic',
    desc: 'Enemy skips turn, lose 15 HP', req: 'Any pair',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), playerDmg: 15, enemyFreeze: 1,
               msg: '❄️ Freeze★! Enemy frozen, -15 HP' };
    },
  },
  {
    id: 'freeze_legendary', icon: '❄️', name: 'Freeze✦', rarity: 'legendary',
    desc: 'Enemy skips 2 turns, lose 20 HP', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice) {
      return { dice: useAny(dice), playerDmg: 20, enemyFreeze: 2,
               msg: '❄️ Freeze✦! Enemy frozen 2 turns, -20 HP' };
    },
  },

  // ── ⛓️ Chain upgrades ─────────────────────────────────────────────────────
  {
    id: 'chain_epic', icon: '⛓️', name: 'Chain★', rarity: 'epic',
    desc: 'Deal 15 damage 3 times', req: 'Three different',
    canPlay: hasThreeDiff,
    play(dice) {
      return { dice: useThreeDiff(dice), enemyDmg: 45, msg: '⛓️ Chain★! 3 × 15 = 45 damage' };
    },
  },
  {
    id: 'chain_legendary', icon: '⛓️', name: 'Chain✦', rarity: 'legendary',
    desc: 'Deal 20 damage 4 times', req: 'Two different',
    canPlay: hasTwoDiff,
    play(dice) {
      return { dice: useTwoDiff(dice), enemyDmg: 80, msg: '⛓️ Chain✦! 4 × 20 = 80 damage' };
    },
  },

  // ── ⚡ Thunder Combo upgrades ─────────────────────────────────────────────
  {
    id: 'thunder_combo_epic', icon: '⚡', name: 'Thunder Combo★', rarity: 'epic',
    desc: '20 × 3 dmg if 2+ cards played', req: 'Any pair',
    canPlay: hasPair,
    play(dice, ctx) {
      const isCombo = (ctx && ctx.cardsPlayedThisTurn >= 2);
      const dmg = isCombo ? 60 : 20;
      return { dice: usePair(dice), enemyDmg: dmg,
               msg: isCombo ? `⚡ Thunder Combo★! 60 damage!` : `⚡ Thunder Combo★! ${dmg} damage` };
    },
  },
  {
    id: 'thunder_combo_legendary', icon: '⚡', name: 'Thunder Combo✦', rarity: 'legendary',
    desc: '25 × 4 dmg if 2+ cards played', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice, ctx) {
      const isCombo = (ctx && ctx.cardsPlayedThisTurn >= 2);
      const dmg = isCombo ? 100 : 25;
      return { dice: useAny(dice), enemyDmg: dmg,
               msg: isCombo ? `⚡ Thunder Combo✦! 100 damage!` : `⚡ Thunder Combo✦! ${dmg} damage` };
    },
  },

  // ── 🩸 Blood Pact upgrades ────────────────────────────────────────────────
  {
    id: 'blood_pact_epic', icon: '🩸', name: 'Blood Pact★', rarity: 'epic',
    desc: 'Deal 60 damage, lose 12 HP', req: 'Die 4+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 4),
    play(dice) {
      const { next } = useDie(dice, 4);
      return { dice: next, enemyDmg: 60, playerDmg: 12, msg: '🩸 Blood Pact★! 60 damage, -12 HP' };
    },
  },
  {
    id: 'blood_pact_legendary', icon: '🩸', name: 'Blood Pact✦', rarity: 'legendary',
    desc: 'Deal 80 damage, lose 8 HP', req: 'Die 3+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 3),
    play(dice) {
      const { next } = useDie(dice, 3);
      return { dice: next, enemyDmg: 80, playerDmg: 8, msg: '🩸 Blood Pact✦! 80 damage, -8 HP' };
    },
  },

  // ── 🔗 Chain Strike upgrades ──────────────────────────────────────────────
  {
    id: 'chain_strike_rare', icon: '🔗', name: 'Chain Strike+', rarity: 'rare',
    desc: '15 damage, 30 if after attack', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice, ctx) {
      const isChained = ctx && ALL_ATTACK_IDS.includes(ctx.lastCardId);
      const dmg = isChained ? 30 : 15;
      return { dice: useAny(dice), enemyDmg: dmg, msg: `🔗 Chain Strike+! ${dmg} damage` };
    },
  },
  {
    id: 'chain_strike_epic', icon: '🔗', name: 'Chain Strike★', rarity: 'epic',
    desc: '20 dmg, 40+poison if after attack', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice, ctx) {
      const isChained = ctx && ALL_ATTACK_IDS.includes(ctx.lastCardId);
      const dmg = isChained ? 40 : 20;
      const dot = isChained ? { dmg: 4, turns: 2, type: 'poison' } : undefined;
      return { dice: useAny(dice), enemyDmg: dmg, enemyDot: dot,
               msg: `🔗 Chain Strike★! ${dmg} damage${isChained ? ' + ☠️ Poison' : ''}` };
    },
  },
  {
    id: 'chain_strike_legendary', icon: '🔗', name: 'Chain Strike✦', rarity: 'legendary',
    desc: '25 dmg, 50+poison+burn if after attack', req: 'Any die',
    canPlay: (dice) => avail(dice).length > 0,
    play(dice, ctx) {
      const isChained = ctx && ALL_ATTACK_IDS.includes(ctx.lastCardId);
      const dmg = isChained ? 50 : 25;
      const dot = isChained ? { dmg: 6, turns: 3, type: 'burn' } : undefined;
      return { dice: useAny(dice), enemyDmg: dmg, enemyDot: dot,
               msg: `🔗 Chain Strike✦! ${dmg} damage${isChained ? ' + 🔥 Burn 3t' : ''}` };
    },
  },

  // ── 🌀 Echo upgrade ───────────────────────────────────────────────────────
  {
    id: 'echo_legendary', icon: '🌀', name: 'Echo✦', rarity: 'legendary',
    desc: 'Copy last card effect twice', req: 'Die 2+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 2),
    play(dice, ctx) {
      const { next } = useDie(dice, 2);
      if (!ctx || !ctx.lastCardResult) return { dice: next, msg: '🌀 Echo✦! No card to echo...' };
      const lr = ctx.lastCardResult;
      return {
        dice: next,
        enemyDmg:  (lr.enemyDmg  || 0) * 2,
        playerDmg: (lr.playerDmg || 0) * 2,
        playerHeal:(lr.playerHeal|| 0) * 2,
        shield:    (lr.shield    || 0) * 2,
        msg: `🌀 Echo✦! ×2: ${lr.msg || 'last effect'}`,
      };
    },
  },

  // ── 💀 Death Wish upgrade ─────────────────────────────────────────────────
  {
    id: 'death_wish_legendary', icon: '💀', name: 'Death Wish✦', rarity: 'legendary',
    desc: 'Deal 90 damage, lose 15 HP', req: 'Any pair',
    canPlay: hasPair,
    play(dice) {
      return { dice: usePair(dice), enemyDmg: 90, playerDmg: 15, msg: '💀 Death Wish✦! 90 damage, -15 HP' };
    },
  },

  // ── 😈 Soul Drain upgrade ─────────────────────────────────────────────────
  {
    id: 'soul_drain_legendary', icon: '😈', name: 'Soul Drain✦', rarity: 'legendary',
    desc: 'Deal 50, lose 8 HP, heal 35', req: 'Die 4+',
    canPlay: (dice) => dice.some(d => !d.used && d.val >= 4),
    play(dice) {
      const { next } = useDie(dice, 4);
      return { dice: next, enemyDmg: 50, playerDmg: 8, playerHeal: 35, msg: '😈 Soul Drain✦! 50 damage, -8 HP, +35 HP' };
    },
  },
];

// ─── Build a lookup map for all upgrade cards ─────────────────────────────────
export const UPGRADE_CARDS_BY_ID = Object.fromEntries(
  [...NEW_BASE_CARDS, ...UPGRADE_CARDS].map(c => [c.id, c])
);
