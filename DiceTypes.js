// ─── Die definitions ─────────────────────────────────────────────────────────

export const DICE_TYPES = [
  // Common
  {
    id: 'standard', name: 'Standard Die', icon: '⬜', rarity: 'common',
    desc: 'Rolls 1–6 normally',
  },
  {
    id: 'heavy', name: 'Heavy Die', icon: '🔵', rarity: 'common',
    desc: 'Rolls 3–6 only, never low',
  },
  {
    id: 'lucky', name: 'Lucky Die', icon: '🟡', rarity: 'common',
    desc: 'Auto-rerolls if it lands 1 or 2',
  },
  // Rare
  {
    id: 'cursed', name: 'Cursed Die', icon: '🟣', rarity: 'rare',
    desc: 'If rolls 6 — cards deal double damage',
  },
  {
    id: 'explosion', name: 'Explosion Die', icon: '🔴', rarity: 'rare',
    desc: 'If rolls 6 — reroll and add both results',
  },
  {
    id: 'weighted', name: 'Weighted Die', icon: '🟤', rarity: 'rare',
    desc: 'After rolling, choose any face 1–5',
  },
  // Epic
  {
    id: 'mirror', name: 'Mirror Die', icon: '🟠', rarity: 'epic',
    desc: 'Copies the highest value of your other two dice',
  },
  {
    id: 'vampire', name: 'Vampire Die', icon: '🟠', rarity: 'epic',
    desc: 'Whatever it rolls, heal that amount as HP',
  },
  {
    id: 'storm', name: 'Storm Die', icon: '🟠', rarity: 'epic',
    desc: 'Rolls twice, you pick which result to use',
  },
  // Legendary
  {
    id: 'legendary_die', name: 'Legendary Die', icon: '⭐', rarity: 'legendary',
    desc: 'Always rolls 6, cannot be rerolled',
  },
  {
    id: 'chaos', name: 'Chaos Die', icon: '🌀', rarity: 'legendary',
    desc: 'Only rolls 1, 3, or 6',
  },
  {
    id: 'death', name: 'Death Die', icon: '💀', rarity: 'legendary',
    desc: 'Always rolls 1, but cards using it deal 5× damage',
  },
];

export const COMMON_DICE     = DICE_TYPES.filter(d => d.rarity === 'common');
export const RARE_DICE       = DICE_TYPES.filter(d => d.rarity === 'rare');
export const EPIC_DICE       = DICE_TYPES.filter(d => d.rarity === 'epic');
export const LEGENDARY_DICE  = DICE_TYPES.filter(d => d.rarity === 'legendary');

// ─── Roll logic ──────────────────────────────────────────────────────────────

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function rollDie(dieId) {
  switch (dieId) {
    case 'standard':     return rnd(1, 6);
    case 'heavy':        return rnd(3, 6);
    case 'lucky': {
      const v = rnd(1, 6);
      return v <= 2 ? rnd(1, 6) : v;   // one auto-reroll on 1-2
    }
    case 'cursed':       return rnd(1, 6);    // modifier applied at damage calc
    case 'explosion':    return rnd(1, 6);    // explosion handled in rollDice()
    case 'weighted':     return rnd(1, 6);    // value overridden by picker UI
    case 'mirror':       return rnd(1, 6);    // value overridden in rollDice()
    case 'vampire':      return rnd(1, 6);    // healing applied in rollDice()
    case 'storm':        return rnd(1, 6);    // second roll shown in picker
    case 'legendary_die': return 6;
    case 'chaos':        return [1, 3, 6][rnd(0, 2)];
    case 'death':        return 1;            // 5× damage at calc
    default:             return rnd(1, 6);
  }
}

// ─── Damage modifier ─────────────────────────────────────────────────────────

// Returns the multiplier that should be applied when a card uses this die.
export function getDamageMultiplier(dieId, dieVal) {
  if (dieId === 'cursed' && dieVal === 6) return 2;
  if (dieId === 'death') return 5;
  return 1;
}

// ─── Rarity border colours ───────────────────────────────────────────────────

export const RARITY_COLOR = {
  common:    '#3A3A5A',
  rare:      '#7B2FBE',
  epic:      '#FF8C00',
  legendary: '#E2B04A',
};
