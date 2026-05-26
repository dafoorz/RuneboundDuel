import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
} from 'react-native';
import { COMMON_DICE, RARE_DICE, EPIC_DICE, LEGENDARY_DICE, RARITY_COLOR } from './DiceTypes';

// ─── Card library ─────────────────────────────────────────────────────────────

const CARD_LIBRARY = [
  { id: 'slash',         icon: '⚔️', name: 'Slash',         desc: 'Deal die × 2 damage',       req: 'Any die',    rarity: 'common'    },
  { id: 'shield',        icon: '🛡️', name: 'Shield Wall',   desc: 'Block 15 damage',           req: 'Any pair',   rarity: 'common'    },
  { id: 'chain_strike',  icon: '🔗', name: 'Chain Strike',  desc: '10/20 if chained',           req: 'Any die',    rarity: 'common'    },
  { id: 'inferno',       icon: '🔥', name: 'Inferno',       desc: 'Deal 25 damage',            req: 'Need a 6',   rarity: 'rare'      },
  { id: 'gambler',       icon: '🎲', name: 'Gambler',       desc: '6=30 · 1=−20 HP',           req: 'Any die',    rarity: 'rare'      },
  { id: 'blood_pact',    icon: '🩸', name: 'Blood Pact',    desc: '40 dmg, lose 15 HP',        req: 'Die 4+',     rarity: 'rare'      },
  { id: 'explosion_chain', icon: '🔴', name: 'Explosion Chain', desc: 'Trigger Explosion ×2', req: 'Explosion',  rarity: 'rare'      },
  { id: 'thunder_combo', icon: '⚡', name: 'Thunder Combo', desc: '15 or 45 if combo',         req: 'Pair',       rarity: 'rare'      },
  { id: 'death_wish',    icon: '💀', name: 'Death Wish',    desc: '60 dmg, lose 25 HP',        req: 'Pair',       rarity: 'epic'      },
  { id: 'soul_drain',    icon: '😈', name: 'Soul Drain',    desc: '30 dmg, heal net 10',       req: 'Die 5+',     rarity: 'epic'      },
  { id: 'echo',          icon: '🌀', name: 'Echo',          desc: 'Copy last card',            req: 'Die 3+',     rarity: 'epic'      },
  { id: 'chaos_nova',    icon: '🎲', name: 'Chaos Nova',    desc: 'Chaos × 10 damage',         req: 'Chaos Die',  rarity: 'epic'      },
  { id: 'deathsentence', icon: '👑', name: 'Death Sentence',desc: 'Deal 100 damage',           req: 'Triple 6',   rarity: 'legendary' },
  { id: 'death_touch',   icon: '💀', name: 'Death Touch',   desc: '100 damage',                req: 'Death Die=1',rarity: 'legendary' },
  { id: 'perfect_strike',icon: '⭐', name: 'Perfect Strike',desc: '50 dmg, heal 10',           req: 'Leg Die=6',  rarity: 'legendary' },
  { id: 'divineshield',  icon: '🌟', name: 'Divine Shield', desc: 'Block 50 damage',           req: 'Triple any', rarity: 'legendary' },
  { id: 'stormcall',     icon: '⚡', name: 'Storm Call',    desc: 'Deal 45 damage',            req: '3 consec',   rarity: 'legendary' },
];

const LEGENDARY_CARDS = CARD_LIBRARY.filter(c => c.rarity === 'legendary');
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function rarityBg(rarity) {
  if (rarity === 'legendary') return 'rgba(226,176,74,0.2)';
  if (rarity === 'epic')      return 'rgba(255,140,0,0.2)';
  if (rarity === 'rare')      return 'rgba(123,47,190,0.2)';
  return 'rgba(80,80,110,0.3)';
}

function generateRewards(encounterType = 'regular') {
  const REGULAR_CARD_POOL = CARD_LIBRARY.filter(c => c.rarity === 'common' || c.rarity === 'rare');
  const REGULAR_DIE_POOL = [...COMMON_DICE, ...RARE_DICE];

  const MINIBOSS_CARD_POOL = CARD_LIBRARY.filter(c => c.rarity === 'rare');
  const MINIBOSS_DIE_POOL = [...RARE_DICE];

  const BOSS_CARD_POOL = CARD_LIBRARY.filter(c => c.rarity === 'legendary');
  const BOSS_DIE_POOL = [...LEGENDARY_DICE];

  if (encounterType === 'miniBoss') {
    return {
      card: pick(MINIBOSS_CARD_POOL),
      die: pick(MINIBOSS_DIE_POOL),
      isMiniBoss: true,
    };
  }

  if (encounterType === 'boss') {
    return {
      card: pick(BOSS_CARD_POOL),
      die: pick(BOSS_DIE_POOL),
      isBoss: true,
    };
  }

  // Regular combat
  return {
    card: pick(REGULAR_CARD_POOL),
    die: pick(REGULAR_DIE_POOL),
    isRegular: true,
  };
}

// ─── Die Roller ───────────────────────────────────────────────────────────────

function DieRoller({ onRollComplete, onRollSound }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (onRollSound) onRollSound();
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: 10, duration: 900,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 450, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,   duration: 450, useNativeDriver: true }),
      ]),
    ]).start(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      setResult(roll);
      setTimeout(() => onRollComplete(roll), 700);
    });
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 10], outputRange: ['0deg', '3600deg'] });

  return (
    <View style={s.rollerWrap}>
      <Text style={s.rollerLabel}>Rolling...</Text>
      <Animated.View style={[s.rollerDie, { transform: [{ rotate: spin }, { scale: scaleAnim }] }]}>
        <Text style={s.rollerFace}>{result !== null ? result : '🎲'}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Gamble Result ────────────────────────────────────────────────────────────

function GambleResult({ dieRoll, encounterType = 'regular', onComplete }) {
  const flashAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(60)).current;
  const damageAnim = useRef(new Animated.Value(0)).current;

  // Determine result based on encounter type
  let isWin, isLoss, winTitle, winRewardIsCard, winCard, winDie;

  if (encounterType === 'boss') {
    isWin = dieRoll === 6;
    isLoss = dieRoll <= 2;
    winTitle = isWin ? '🏆 LEGENDARY!' : '— Nothing —';
    winRewardIsCard = Math.random() < 0.5;
    winCard = winRewardIsCard ? pick(CARD_LIBRARY.filter(c => c.rarity === 'legendary')) : null;
    winDie = !winRewardIsCard ? pick(LEGENDARY_DICE) : null;
  } else if (encounterType === 'miniBoss') {
    isWin = dieRoll === 6;
    isLoss = dieRoll <= 2;
    winTitle = isWin ? '🏆 LEGENDARY!' : isLoss ? '💀 Unlucky...' : '— Nothing —';
    winRewardIsCard = Math.random() < 0.5;
    winCard = winRewardIsCard ? pick(CARD_LIBRARY.filter(c => c.rarity === 'legendary')) : null;
    winDie = !winRewardIsCard ? pick(LEGENDARY_DICE) : null;
  } else {
    // Regular
    isWin = dieRoll === 6;
    isLoss = dieRoll <= 2;
    winTitle = isWin ? '🏆 EPIC!' : isLoss ? '💀 Unlucky...' : '— Nothing —';
    winRewardIsCard = Math.random() < 0.5;
    winCard = winRewardIsCard ? pick(CARD_LIBRARY.filter(c => c.rarity === 'epic')) : null;
    winDie = !winRewardIsCard ? pick(EPIC_DICE) : null;
  }

  const flashColor = isWin ? '#FFD700' : isLoss ? '#C0392B' : '#444';
  const title      = isWin ? winTitle : isLoss ? '💀 Unlucky...' : '— Nothing —';

  useEffect(() => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();

    if (isLoss) {
      Animated.timing(damageAnim, { toValue: -60, duration: 700, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  function handleContinue() {
    if (isWin) {
      if (winRewardIsCard) onComplete({ kind: 'card', card: winCard });
      else                 onComplete({ kind: 'die',  die:  winDie  });
    } else if (isLoss) {
      onComplete({ kind: 'damage', amount: 20 });
    } else {
      onComplete({ kind: 'nothing' });
    }
  }

  const rewardIcon = winRewardIsCard ? winCard.icon : winDie.icon;
  const rewardName = winRewardIsCard ? winCard.name : winDie.name;
  const rewardDesc = winRewardIsCard ? winCard.desc : winDie.desc;
  const rewardKind = winRewardIsCard ? winCard.rarity + ' card' : winDie.rarity + ' die';

  return (
    <View style={s.resultScreen}>
      <Animated.View
        style={[s.flashOverlay, { backgroundColor: flashColor, opacity: flashAnim }]}
        pointerEvents="none"
      />

      <Text style={s.resultTitle}>{title}</Text>

      {isWin && (
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View style={s.resultCard}>
            <Text style={s.resultIcon}>{rewardIcon}</Text>
            <Text style={s.resultName}>{rewardName}</Text>
            <Text style={s.resultDesc}>{rewardDesc}</Text>
            <Text style={[s.resultRarity, { color: '#E2B04A' }]}>{rewardKind}</Text>
          </View>
        </Animated.View>
      )}

      {!isWin && !isLoss && (
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <Text style={s.nothingText}>You walk away empty-handed...</Text>
        </Animated.View>
      )}

      {isLoss && (
        <Animated.View style={{ transform: [{ translateY: damageAnim }] }}>
          <Text style={s.damageText}>−20 HP</Text>
        </Animated.View>
      )}

      <TouchableOpacity style={s.continueBtn} onPress={handleContinue} activeOpacity={0.8}>
        <Text style={s.continueBtnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Boss Reward ──────────────────────────────────────────────────────────────

function BossReward({ onRewardSelected }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const legendaryCard = useState(() => pick(LEGENDARY_CARDS))[0];
  const legendaryDie  = useState(() => pick(LEGENDARY_DICE))[0];

  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  function handleTap(idx) {
    if (selectedIdx !== null && selectedIdx !== idx) {
      Animated.timing(scaleAnims[selectedIdx], { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    Animated.timing(scaleAnims[idx], { toValue: 1.06, duration: 150, useNativeDriver: true }).start();
    setSelectedIdx(idx);
  }

  function handleAction() {
    if (selectedIdx === 0) onRewardSelected({ kind: 'card',  card:   legendaryCard });
    if (selectedIdx === 1) onRewardSelected({ kind: 'die',   die:    legendaryDie  });
    if (selectedIdx === 2) onRewardSelected({ kind: 'runes', amount: 50            });
  }

  const G = '#E2B04A';

  return (
    <View style={s.root}>
      <Text style={[s.title, { color: '#FF6B35', fontSize: 22 }]}>👹 BOSS DEFEATED!</Text>
      <Text style={[s.title, { fontSize: 13, color: G, marginTop: 4 }]}>Choose your reward</Text>

      <View style={s.optionsSection}>
        <View style={s.optionsRow}>

          {/* Card */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[0] }] }]}>
            <TouchableOpacity
              style={[s.option, { borderColor: selectedIdx === 0 ? G : '#E2B04A' }, selectedIdx === 0 && s.optionSelectedBg]}
              onPress={() => handleTap(0)}
              activeOpacity={0.85}
            >
              <Text style={s.typeLabel}>Card</Text>
              <Text style={s.optionIcon}>{legendaryCard.icon}</Text>
              <Text style={s.optionName}>{legendaryCard.name}</Text>
              <Text style={s.optionDesc}>{legendaryCard.desc}</Text>
              <Text style={s.optionReq}>{legendaryCard.req}</Text>
              <View style={[s.rarityBadge, { backgroundColor: rarityBg('legendary') }]}>
                <Text style={[s.rarityText, { color: G }]}>legendary</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Die */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[1] }] }]}>
            <TouchableOpacity
              style={[s.option, { borderColor: selectedIdx === 1 ? G : '#E2B04A' }, selectedIdx === 1 && s.optionSelectedBg]}
              onPress={() => handleTap(1)}
              activeOpacity={0.85}
            >
              <Text style={s.typeLabel}>Die</Text>
              <Text style={s.optionIcon}>{legendaryDie.icon}</Text>
              <Text style={s.optionName}>{legendaryDie.name}</Text>
              <Text style={s.optionDesc}>{legendaryDie.desc}</Text>
              <View style={[s.rarityBadge, { backgroundColor: rarityBg('legendary') }]}>
                <Text style={[s.rarityText, { color: G }]}>legendary</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Runes */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[2] }] }]}>
            <TouchableOpacity
              style={[s.option, { borderColor: selectedIdx === 2 ? G : '#27AE60' }, selectedIdx === 2 && s.optionSelectedBg]}
              onPress={() => handleTap(2)}
              activeOpacity={0.85}
            >
              <Text style={[s.typeLabel, { color: '#27AE60' }]}>Runes</Text>
              <Text style={s.optionIcon}>💎</Text>
              <Text style={s.optionName}>Bonus Runes</Text>
              <Text style={s.optionDesc}>+50 runes added to your total</Text>
              <View style={[s.rarityBadge, { backgroundColor: 'rgba(39,174,96,0.2)' }]}>
                <Text style={[s.rarityText, { color: '#27AE60' }]}>+50 RUNES</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </View>

      <TouchableOpacity
        style={[s.actionBtn, selectedIdx === null && s.actionBtnOff]}
        onPress={selectedIdx !== null ? handleAction : undefined}
        disabled={selectedIdx === null}
        activeOpacity={0.8}
      >
        <Text style={s.actionBtnText}>Take It →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Regular / Mini Boss Reward ───────────────────────────────────────────────

function RegularReward({ encounterType, onRewardSelected, onRollSound }) {
  const [rewards]     = useState(() => generateRewards(encounterType));
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [gamblePhase, setGamblePhase] = useState('idle'); // 'idle' | 'rolling' | 'result'
  const [dieRoll,     setDieRoll]     = useState(null);

  // Determine YOLO odds based on encounter type
  const getYoloOdds = () => {
    if (rewards.isBoss) {
      return {
        winRoll: [6],
        winReward: 'Legendary',
        secondRoll: [5],
        secondReward: 'Epic',
      };
    }
    if (rewards.isMiniBoss) {
      return {
        winRoll: [6],
        winReward: 'Legendary',
        secondRoll: [5],
        secondReward: 'Epic',
      };
    }
    // Regular
    return {
      winRoll: [6],
      winReward: 'Epic',
      secondRoll: [5],
      secondReward: 'Rare',
    };
  };
  const yoloOdds = getYoloOdds();

  const scaleAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  function handleTap(idx) {
    if (selectedIdx !== null && selectedIdx !== idx) {
      Animated.timing(scaleAnims[selectedIdx], { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    Animated.timing(scaleAnims[idx], { toValue: 1.06, duration: 150, useNativeDriver: true }).start();
    setSelectedIdx(idx);
  }

  function handleAction() {
    if (selectedIdx === 0)      onRewardSelected({ kind: 'card', card: rewards.card });
    else if (selectedIdx === 1) onRewardSelected({ kind: 'die',  die:  rewards.die  });
    else if (selectedIdx === 2) setGamblePhase('rolling');
  }

  // ── Gamble phases ──────────────────────────────────────────────────────────

  if (gamblePhase === 'rolling') {
    return (
      <View style={s.root}>
        <Text style={s.title}>⚠️ High Risk</Text>
        <DieRoller
          onRollComplete={(roll) => {
            setDieRoll(roll);
            setGamblePhase('result');
          }}
          onRollSound={onRollSound}
        />
      </View>
    );
  }

  if (gamblePhase === 'result') {
    return <GambleResult dieRoll={dieRoll} onComplete={onRewardSelected} />;
  }

  // ── Selection screen ───────────────────────────────────────────────────────

  const cardRarityColor = RARITY_COLOR[rewards.card.rarity] || '#3A3A5A';
  const dieRarityColor = RARITY_COLOR[rewards.die.rarity] || '#3A3A5A';

  return (
    <View style={s.root}>
      <Text style={s.title}>Choose Your Reward</Text>

      <View style={s.optionsSection}>
        <View style={s.optionsRow}>

          {/* ── Option 0: Card ─────────────────────────────────────────────── */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[0] }] }]}>
            <TouchableOpacity
              style={[
                s.option,
                { borderColor: selectedIdx === 0 ? '#E2B04A' : cardRarityColor },
                selectedIdx === 0 && s.optionSelectedBg,
              ]}
              onPress={() => handleTap(0)}
              activeOpacity={0.85}
            >
              <Text style={s.typeLabel}>Card</Text>
              <Text style={s.optionIcon}>{rewards.card.icon}</Text>
              <Text style={s.optionName}>{rewards.card.name}</Text>
              <Text style={s.optionDesc}>{rewards.card.desc}</Text>
              <Text style={s.optionReq}>{rewards.card.req}</Text>
              <View style={[s.rarityBadge, { backgroundColor: rarityBg(rewards.card.rarity) }]}>
                <Text style={[s.rarityText, { color: RARITY_COLOR[rewards.card.rarity] || '#888' }]}>
                  {rewards.card.rarity}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Option 1: Die ──────────────────────────────────────────────── */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[1] }] }]}>
            <TouchableOpacity
              style={[
                s.option,
                { borderColor: selectedIdx === 1 ? '#E2B04A' : dieRarityColor },
                selectedIdx === 1 && s.optionSelectedBg,
              ]}
              onPress={() => handleTap(1)}
              activeOpacity={0.85}
            >
              <Text style={s.typeLabel}>Die</Text>
              <Text style={s.optionIcon}>{rewards.die.icon}</Text>
              <Text style={s.optionName}>{rewards.die.name}</Text>
              <Text style={s.optionDesc}>{rewards.die.desc}</Text>
              <View style={[s.rarityBadge, { backgroundColor: rarityBg(rewards.die.rarity) }]}>
                <Text style={[s.rarityText, { color: dieRarityColor }]}>
                  {rewards.die.rarity}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Option 2: High Risk ────────────────────────────────────────── */}
          <Animated.View style={[s.optionWrap, { transform: [{ scale: scaleAnims[2] }] }]}>
            <TouchableOpacity
              style={[s.option, s.optionRisk, selectedIdx === 2 && s.optionSelected]}
              onPress={() => handleTap(2)}
              activeOpacity={0.85}
            >
              <Text style={[s.typeLabel, { color: '#C0392B' }]}>⚠️ Risk</Text>
              <Text style={s.optionIcon}>🎲</Text>
              <Text style={[s.optionName, { color: '#C0392B' }]}>YOLO</Text>
              <View style={s.oddsBox}>
                {rewards.isBoss ? (
                  <>
                    <Text style={s.oddLine}>🏆 Roll 6 → Legendary</Text>
                    <Text style={s.oddLine}>card or die</Text>
                    <Text style={s.oddLine}>😐 Roll 3-5 → Nothing</Text>
                    <Text style={s.oddLine}>💀 Roll 1-2 → Lose 20 HP</Text>
                  </>
                ) : rewards.isMiniBoss ? (
                  <>
                    <Text style={s.oddLine}>🏆 Roll 6 → Legendary</Text>
                    <Text style={s.oddLine}>card or die</Text>
                    <Text style={s.oddLine}>😐 Roll 3-5 → Nothing</Text>
                    <Text style={s.oddLine}>💀 Roll 1-2 → Lose 20 HP</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.oddLine}>🏆 Roll 6 → Epic</Text>
                    <Text style={s.oddLine}>card or die</Text>
                    <Text style={s.oddLine}>😐 Roll 3-5 → Nothing</Text>
                    <Text style={s.oddLine}>💀 Roll 1-2 → Lose 20 HP</Text>
                  </>
                )}
              </View>
              <View style={[s.rarityBadge, { backgroundColor: 'rgba(192,57,43,0.2)' }]}>
                <Text style={[s.rarityText, { color: '#C0392B' }]}>Gamble</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </View>

      <TouchableOpacity
        style={[s.actionBtn, selectedIdx === null && s.actionBtnOff]}
        onPress={selectedIdx !== null ? handleAction : undefined}
        disabled={selectedIdx === null}
        activeOpacity={0.8}
      >
        <Text style={s.actionBtnText}>
          {selectedIdx === 2 ? 'Roll the Dice →' : 'Take It →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function CardReward({ encounterType = 'regular', onRewardSelected, onRollSound }) {
  if (encounterType === 'boss') return <BossReward onRewardSelected={onRewardSelected} />;
  return <RegularReward encounterType={encounterType} onRewardSelected={onRewardSelected} onRollSound={onRollSound} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A14',
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },

  title: {
    color: '#E2B04A',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  // Options layout
  optionsSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'stretch',
  },

  optionWrap: {
    width: 104,
  },

  option: {
    borderWidth: 1.5,
    borderColor: 'rgba(226,176,74,0.3)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(15,52,96,0.45)',
    minHeight: 210,
  },

  optionSelected: {
    borderColor: '#E2B04A',
    borderWidth: 2,
    backgroundColor: 'rgba(226,176,74,0.1)',
  },

  optionSelectedBg: {
    backgroundColor: 'rgba(226,176,74,0.1)',
  },

  optionRisk: {
    borderColor: 'rgba(192,57,43,0.4)',
  },

  typeLabel: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  optionIcon: {
    fontSize: 28,
  },

  optionName: {
    color: '#EFEFEF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  optionDesc: {
    color: '#888',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 11,
    marginVertical: 2,
  },

  optionReq: {
    color: '#666',
    fontSize: 7,
    textAlign: 'center',
  },

  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 'auto',
  },

  rarityText: {
    fontSize: 7,
    fontWeight: 'bold',
  },

  oddsBox: {
    gap: 8,
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },

  oddLine: {
    color: '#888',
    fontSize: 7,
    textAlign: 'center',
  },

  // Action button
  actionBtn: {
    backgroundColor: '#7B2FBE',
    paddingHorizontal: 52,
    paddingVertical: 13,
    borderRadius: 10,
  },

  actionBtnOff: {
    opacity: 0.35,
  },

  actionBtnText: {
    color: '#EFEFEF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Die roller
  rollerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },

  rollerLabel: {
    color: '#E2B04A',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  rollerDie: {
    width: 110,
    height: 110,
    borderRadius: 20,
    backgroundColor: 'rgba(226,176,74,0.15)',
    borderWidth: 2,
    borderColor: '#E2B04A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rollerFace: {
    fontSize: 58,
    color: '#EFEFEF',
    fontWeight: 'bold',
  },

  // Gamble result
  resultScreen: {
    flex: 1,
    backgroundColor: '#0A0A14',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 50,
  },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  resultTitle: {
    color: '#EFEFEF',
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  resultCard: {
    backgroundColor: 'rgba(15,52,96,0.7)',
    borderWidth: 2,
    borderColor: '#E2B04A',
    borderRadius: 14,
    padding: 16,
    width: 150,
    alignItems: 'center',
    gap: 8,
  },

  resultIcon: {
    fontSize: 36,
  },

  resultName: {
    color: '#EFEFEF',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  resultDesc: {
    color: '#CCC',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },

  resultRarity: {
    fontSize: 9,
    fontWeight: 'bold',
  },

  nothingText: {
    color: '#777',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 40,
  },

  damageText: {
    color: '#C0392B',
    fontSize: 42,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  continueBtn: {
    backgroundColor: '#7B2FBE',
    paddingHorizontal: 48,
    paddingVertical: 13,
    borderRadius: 10,
  },

  continueBtnText: {
    color: '#EFEFEF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
