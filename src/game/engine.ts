import {
  BOARD_SIZE,
  BUFF_OPTIONS,
  COMMON_PIECES,
  DRAFT_WEIGHT_LIMIT,
  EMPTY_COUNTS,
  EFFECT_COPY,
  PHASE_LABELS,
  PICK_OPTIONS,
  PIECE_STATS,
} from "./constants";
import type {
  BattlePhase,
  BuffId,
  CommonPieceType,
  EffectId,
  GameState,
  HistoryEntry,
  PendingCombat,
  PendingSummon,
  PickKind,
  PieceCounts,
  PieceState,
  PieceType,
  PlayerColor,
  PlayerState,
  RoundOutcome,
  TransformId,
} from "./types";

const MAX_HISTORY = 80;

export const cloneCounts = (counts: PieceCounts): PieceCounts => ({ ...counts });

export function getDraftWeight(counts: PieceCounts): number {
  return COMMON_PIECES.reduce((sum, pieceType) => sum + counts[pieceType] * PIECE_STATS[pieceType].weight, 0);
}

export function getStockTotal(counts: PieceCounts): number {
  return COMMON_PIECES.reduce((sum, pieceType) => sum + counts[pieceType], 0);
}

function createPlayer(color: PlayerColor): PlayerState {
  return {
    id: color,
    color,
    draft: cloneCounts(EMPTY_COUNTS),
    stock: cloneCounts(EMPTY_COUNTS),
    score: 0,
    roundResults: [],
  };
}

export function createInitialGameState(): GameState {
  return {
    stage: "draft",
    round: 1,
    turn: 0,
    phase: "whiteMove",
    pieces: [],
    players: {
      white: createPlayer("white"),
      black: createPlayer("black"),
    },
    activeBuffs: [],
    activeTransforms: [],
    pendingCombats: [],
    eventLog: ["Draft teams up to weight 20. Kings are included automatically."],
    history: [],
    nextPieceId: 1,
    nextEntryOrder: 1,
  };
}

export function canStartGame(state: GameState): boolean {
  return (
    state.stage === "draft" &&
    getDraftWeight(state.players.white.draft) <= DRAFT_WEIGHT_LIMIT &&
    getDraftWeight(state.players.black.draft) <= DRAFT_WEIGHT_LIMIT &&
    getDraftWeight(state.players.white.draft) > 0 &&
    getDraftWeight(state.players.black.draft) > 0
  );
}

export function setDraftCount(
  state: GameState,
  color: PlayerColor,
  pieceType: CommonPieceType,
  requestedCount: number,
): GameState {
  if (state.stage !== "draft") {
    return state;
  }

  const count = Math.max(0, Math.floor(requestedCount));
  const nextDraft = {
    ...state.players[color].draft,
    [pieceType]: count,
  };

  if (getDraftWeight(nextDraft) > DRAFT_WEIGHT_LIMIT) {
    return {
      ...state,
      eventLog: [`${PIECE_STATS[pieceType].label} would exceed the draft weight limit.`],
    };
  }

  return updatePlayer(state, color, (player) => ({
    ...player,
    draft: nextDraft,
  }));
}

export function startGame(state: GameState): GameState {
  if (!canStartGame(state)) {
    return {
      ...state,
      eventLog: ["Both players need a valid non-empty draft with weight 20 or less."],
    };
  }

  return {
    ...state,
    stage: "roundIntro",
    round: 1,
    turn: 0,
    phase: "whiteMove",
    pieces: [],
    pendingCombats: [],
    eventLog: ["Draft locked. Round 1 is ready."],
  };
}

export function resetGame(): GameState {
  return createInitialGameState();
}

export function beginRound(state: GameState): GameState {
  if (state.stage !== "roundIntro") {
    return state;
  }

  const whiteKing = createPiece("king", "white", 0, state.nextPieceId, state.nextEntryOrder);
  const blackKing = createPiece("king", "black", BOARD_SIZE - 1, state.nextPieceId + 1, state.nextEntryOrder + 1);

  const withResetStocks: GameState = {
    ...state,
    stage: "battle",
    turn: 1,
    phase: "whiteMove",
    pieces: [whiteKing, blackKing],
    pendingCombats: [],
    roundWinner: undefined,
    pick: undefined,
    players: {
      white: {
        ...state.players.white,
        stock: cloneCounts(state.players.white.draft),
        pendingSummon: undefined,
      },
      black: {
        ...state.players.black,
        stock: cloneCounts(state.players.black.draft),
        pendingSummon: undefined,
      },
    },
    eventLog: [`Round ${state.round} begins. Draft stock has been restored.`],
    nextPieceId: state.nextPieceId + 2,
    nextEntryOrder: state.nextEntryOrder + 2,
  };

  return maybeFinishDraw(withResetStocks);
}

export function commitSummon(
  state: GameState,
  color: PlayerColor,
  pieceType: CommonPieceType,
  special: boolean,
): GameState {
  if (state.stage !== "battle") {
    return state;
  }

  if (state.players[color].stock[pieceType] <= 0) {
    return {
      ...state,
      eventLog: [`${capitalize(color)} has no ${PIECE_STATS[pieceType].label}s left in stock.`],
    };
  }

  const pendingSummon: PendingSummon = {
    pieceType,
    slot: getSummonSlot(color, special),
    special,
  };

  return updatePlayer(state, color, (player) => ({
    ...player,
    pendingSummon,
  }));
}

export function clearSummon(state: GameState, color: PlayerColor): GameState {
  if (state.stage !== "battle" || !state.players[color].pendingSummon) {
    return state;
  }

  return updatePlayer(state, color, (player) => ({
    ...player,
    pendingSummon: undefined,
  }));
}

export function advancePhase(state: GameState): GameState {
  if (state.stage !== "battle") {
    return state;
  }

  const before = state;
  let after: GameState;

  switch (state.phase) {
    case "whiteMove": {
      after = resolveMovePhase(state, "white");
      after = after.stage === "battle" ? { ...after, phase: "whiteCollision" } : after;
      break;
    }
    case "whiteCollision": {
      after = resolveCollisionPhase(state);
      after = after.stage === "battle" ? maybeFinishDraw({ ...after, phase: "blackMove" }) : after;
      break;
    }
    case "blackMove": {
      after = resolveMovePhase(state, "black");
      after = after.stage === "battle" ? { ...after, phase: "blackCollision" } : after;
      break;
    }
    case "blackCollision": {
      after = resolveCollisionPhase(state);
      after = after.stage === "battle" ? maybeFinishDraw({ ...after, phase: "sickness" }) : after;
      break;
    }
    case "sickness": {
      after = resolveSicknessPhase(state);
      after = after.stage === "battle" ? maybeFinishDraw({ ...after, phase: "summon" }) : after;
      break;
    }
    case "summon": {
      after = resolveSummonPhase(state);
      after =
        after.stage === "battle"
          ? maybeFinishDraw({ ...after, turn: after.turn + 1, phase: "whiteMove" })
          : after;
      break;
    }
  }

  return appendHistory(before, after);
}

export function resolveFullTurn(state: GameState): GameState {
  if (state.stage !== "battle") {
    return state;
  }

  const initialTurn = state.turn;
  let next = state;

  do {
    next = advancePhase(next);
  } while (next.stage === "battle" && next.turn === initialTurn);

  return next;
}

export function continueAfterRound(state: GameState): GameState {
  if (state.stage !== "roundResult") {
    return state;
  }

  if (state.round >= 4) {
    return {
      ...state,
      stage: "report",
      finalWinner: getFinalWinner(state),
      eventLog: ["Run complete."],
    };
  }

  const kind: PickKind = state.round === 1 ? "buff" : state.round === 2 ? "transform2" : "transform3";

  return {
    ...state,
    stage: "pick",
    pick: {
      kind,
      choices: {},
    },
    eventLog: [`${getPickTitle(kind)} is open.`],
  };
}

export function choosePick(state: GameState, color: PlayerColor, effect: EffectId): GameState {
  if (state.stage !== "pick" || !state.pick) {
    return state;
  }

  const options = PICK_OPTIONS[state.pick.kind];

  if (!options.includes(effect)) {
    return state;
  }

  if (isEffectActive(state, effect)) {
    return {
      ...state,
      eventLog: [`${EFFECT_COPY[effect].title} is already active.`],
    };
  }

  if (Object.values(state.pick.choices).includes(effect)) {
    return {
      ...state,
      eventLog: [`${EFFECT_COPY[effect].title} was already chosen in this pick.`],
    };
  }

  const choices = {
    ...state.pick.choices,
    [color]: effect,
  };

  const withChoice: GameState = {
    ...state,
    pick: {
      ...state.pick,
      choices,
    },
    eventLog: [`${capitalize(color)} chose ${EFFECT_COPY[effect].title}.`],
  };

  if (!choices.white || !choices.black) {
    return withChoice;
  }

  const pickedEffects = [choices.white, choices.black];
  const activeBuffs = [...state.activeBuffs];
  const activeTransforms = [...state.activeTransforms];

  for (const picked of pickedEffects) {
    if (isBuff(picked) && !activeBuffs.includes(picked)) {
      activeBuffs.push(picked);
    }
    if (isTransform(picked) && !activeTransforms.includes(picked)) {
      activeTransforms.push(picked);
    }
  }

  return {
    ...withChoice,
    stage: "roundIntro",
    round: state.round + 1,
    turn: 0,
    phase: "whiteMove",
    pieces: [],
    activeBuffs,
    activeTransforms,
    pendingCombats: [],
    pick: undefined,
    roundWinner: undefined,
    eventLog: [
      `${EFFECT_COPY[choices.white].title} and ${EFFECT_COPY[choices.black].title} are now global effects.`,
      `Round ${state.round + 1} is ready.`,
    ],
  };
}

export function deriveBoard(pieces: PieceState[]): Array<PieceState | undefined> {
  const board: Array<PieceState | undefined> = Array.from({ length: BOARD_SIZE });

  for (const piece of pieces) {
    if (piece.alive && piece.position >= 0 && piece.position < BOARD_SIZE) {
      board[piece.position] = piece;
    }
  }

  return board;
}

export function formatBoard(state: GameState): string {
  return deriveBoard(state.pieces)
    .map((piece) => (piece ? `[${pieceToken(piece)}]` : "[ ]"))
    .join("");
}

export function createPiece(
  type: PieceType,
  owner: PlayerColor,
  position: number,
  id: number,
  enteredAt: number,
): PieceState {
  const stats = PIECE_STATS[type];

  return {
    id,
    type,
    owner,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    baseDamage: stats.damage,
    position,
    sickness: 0,
    moves: 0,
    enteredAt,
    alive: true,
  };
}

export function getDisplayedDamage(state: GameState, piece: PieceState): number {
  return piece.baseDamage + (hasBuff(state, "crowd") ? 1 : 0);
}

export function getPieceTransformTags(state: GameState, piece: PieceState): TransformId[] {
  const tags: TransformId[] = [];

  if (piece.type === "pawn" && hasTransform(state, "pawnDoubleVsMinor")) {
    tags.push("pawnDoubleVsMinor");
  }
  if (piece.type === "pawn" && hasTransform(state, "pawnKingSlayer")) {
    tags.push("pawnKingSlayer");
  }
  if (piece.type === "bishop" && hasTransform(state, "bishopLine")) {
    tags.push("bishopLine");
  }
  if (piece.type === "rook" && hasTransform(state, "rookArmor")) {
    tags.push("rookArmor");
  }
  if (piece.type === "queen" && hasTransform(state, "queenSpeed")) {
    tags.push("queenSpeed");
  }
  if (piece.type === "knight" && hasTransform(state, "knightTerritoryDouble")) {
    tags.push("knightTerritoryDouble");
  }
  if (piece.type === "knight" && hasTransform(state, "knightHopPawns")) {
    tags.push("knightHopPawns");
  }

  return tags;
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? `${score}` : `${Math.floor(score)},5`;
}

export function getRoundTitle(round: number): string {
  return round === 4 ? "Final Round" : `Round ${round}`;
}

function resolveMovePhase(state: GameState, color: PlayerColor): GameState {
  let pieces = state.pieces;
  const combats: PendingCombat[] = [];
  const events: string[] = [];
  const movers = pieces
    .filter((piece) => piece.alive && piece.owner === color && piece.type !== "king" && piece.sickness <= 0)
    .sort((a, b) => {
      if (b.moves !== a.moves) {
        return b.moves - a.moves;
      }

      return color === "white" ? a.position - b.position : b.position - a.position;
    });

  for (const initialPiece of movers) {
    const current = pieces.find((piece) => piece.id === initialPiece.id);

    if (!current || !current.alive || current.sickness > 0) {
      continue;
    }

    const result = planAndApplyMove(state, pieces, current);
    pieces = result.pieces;
    events.push(...result.events);

    if (result.combat) {
      combats.push(result.combat);
    }
  }

  return {
    ...state,
    pieces,
    pendingCombats: combats,
    eventLog: events.length > 0 ? events : [`${PHASE_LABELS[state.phase]} resolved with no movement.`],
  };
}

function planAndApplyMove(
  state: GameState,
  pieces: PieceState[],
  piece: PieceState,
): { pieces: PieceState[]; combat?: PendingCombat; events: string[] } {
  const direction = getDirection(piece.owner);
  const board = deriveBoard(pieces);
  const adjacentPosition = piece.position + direction;
  const events: string[] = [];

  if (!isInsideBoard(adjacentPosition)) {
    events.push(`${pieceName(piece)} is blocked by the board edge.`);
    return { pieces, events };
  }

  const adjacent = board[adjacentPosition];

  if (
    piece.type === "knight" &&
    hasTransform(state, "knightHopPawns") &&
    adjacent?.type === "pawn"
  ) {
    return planKnightHop(state, pieces, piece, adjacentPosition, direction);
  }

  const maxSteps = piece.type === "queen" && hasTransform(state, "queenSpeed") ? 5 : 1;
  let lastEmpty = piece.position;
  let blocker: PieceState | undefined;

  for (let step = 1; step <= maxSteps; step += 1) {
    const targetPosition = piece.position + direction * step;

    if (!isInsideBoard(targetPosition)) {
      break;
    }

    const occupant = board[targetPosition];

    if (!occupant) {
      lastEmpty = targetPosition;
      continue;
    }

    blocker = occupant;
    break;
  }

  if (!blocker) {
    if (lastEmpty === piece.position) {
      events.push(`${pieceName(piece)} has no legal movement.`);
      return { pieces, events };
    }

    const moved = movePiece(state, pieces, piece, lastEmpty, events);
    return { pieces: moved, events };
  }

  const movedBeforeBlocker = lastEmpty !== piece.position ? movePiece(state, pieces, piece, lastEmpty, events) : pieces;
  const movedPiece = movedBeforeBlocker.find((candidate) => candidate.id === piece.id) ?? piece;

  if (blocker.owner === piece.owner) {
    events.push(`${pieceName(movedPiece)} stops before allied ${PIECE_STATS[blocker.type].label}.`);
    return { pieces: movedBeforeBlocker, events };
  }

  events.push(`${pieceName(movedPiece)} clashes with ${pieceName(blocker)}.`);
  return {
    pieces: movedBeforeBlocker,
    combat: {
      attackerId: piece.id,
      defenderId: blocker.id,
      direction,
    },
    events,
  };
}

function planKnightHop(
  state: GameState,
  pieces: PieceState[],
  piece: PieceState,
  adjacentPosition: number,
  direction: 1 | -1,
): { pieces: PieceState[]; combat?: PendingCombat; events: string[] } {
  const landingPosition = adjacentPosition + direction;
  const events: string[] = [];

  if (!isInsideBoard(landingPosition)) {
    events.push(`${pieceName(piece)} cannot hop beyond the board.`);
    return { pieces, events };
  }

  const board = deriveBoard(pieces);
  const landing = board[landingPosition];

  if (!landing) {
    const moved = movePiece(state, pieces, piece, landingPosition, events, "hops over a Pawn to");
    return { pieces: moved, events };
  }

  if (landing.owner === piece.owner) {
    events.push(`${pieceName(piece)} hops the Pawn but is blocked by allied ${PIECE_STATS[landing.type].label}.`);
    return { pieces, events };
  }

  events.push(`${pieceName(piece)} hops a Pawn and clashes with ${pieceName(landing)}.`);
  return {
    pieces,
    combat: {
      attackerId: piece.id,
      defenderId: landing.id,
      direction,
    },
    events,
  };
}

function movePiece(
  state: GameState,
  pieces: PieceState[],
  piece: PieceState,
  position: number,
  events: string[],
  verb = "moves to",
): PieceState[] {
  const distance = Math.abs(position - piece.position);
  const healedHp = hasBuff(state, "growth") && piece.hp < piece.maxHp ? Math.min(piece.maxHp, piece.hp + 1) : piece.hp;
  const healed = healedHp > piece.hp;
  const updated: PieceState = {
    ...piece,
    position,
    hp: healedHp,
    moves: piece.moves + distance,
  };

  events.push(`${pieceName(piece)} ${verb} slot ${position}${healed ? " and heals 1" : ""}.`);

  return pieces.map((candidate) => (candidate.id === piece.id ? updated : candidate));
}

function resolveCollisionPhase(state: GameState): GameState {
  if (state.pendingCombats.length === 0) {
    return {
      ...state,
      pendingCombats: [],
      eventLog: [`${PHASE_LABELS[state.phase]} resolved with no clashes.`],
    };
  }

  const snapshot = new Map(state.pieces.map((piece) => [piece.id, piece]));
  const damageById = new Map<number, number>();
  const events: string[] = [];

  for (const combat of state.pendingCombats) {
    const attacker = snapshot.get(combat.attackerId);
    const defender = snapshot.get(combat.defenderId);

    if (!attacker?.alive || !defender?.alive) {
      continue;
    }

    const primaryTargets = getPrimaryTargets(state, snapshot, attacker, defender, combat.direction);

    for (const target of primaryTargets) {
      const rawDamage = calculateOutgoingDamage(state, attacker, target);
      const finalDamage = reduceIncomingDamage(state, target, rawDamage);
      addDamage(damageById, target.id, finalDamage);
      events.push(`${pieceName(attacker)} deals ${finalDamage} to ${pieceName(target)}.`);
    }

    const defenderRawDamage = calculateOutgoingDamage(state, defender, attacker);
    const defenderDamage = reduceIncomingDamage(state, attacker, defenderRawDamage);
    addDamage(damageById, attacker.id, defenderDamage);
    events.push(`${pieceName(defender)} deals ${defenderDamage} back to ${pieceName(attacker)}.`);

    applyTrample(state, snapshot, damageById, events, attacker, defender, combat.direction, primaryTargets);
  }

  const damagedPieces = state.pieces.map((piece) => {
    const damage = damageById.get(piece.id) ?? 0;
    const hp = piece.hp - damage;

    return damage > 0
      ? {
          ...piece,
          hp,
          alive: hp > 0,
        }
      : piece;
  });

  const pieces = damagedPieces.filter((piece) => piece.type === "king" || piece.alive);
  const withDamage: GameState = {
    ...state,
    pieces,
    pendingCombats: [],
    eventLog: events,
  };

  const whiteKing = pieces.find((piece) => piece.type === "king" && piece.owner === "white");
  const blackKing = pieces.find((piece) => piece.type === "king" && piece.owner === "black");
  const whiteDead = !whiteKing || whiteKing.hp <= 0;
  const blackDead = !blackKing || blackKing.hp <= 0;

  if (whiteDead || blackDead) {
    if (whiteDead && blackDead) {
      return finishRound(withDamage, "draw", [...events, "Both Kings fell. The round is a draw."]);
    }

    return finishRound(withDamage, whiteDead ? "black" : "white", [
      ...events,
      `${capitalize(whiteDead ? "black" : "white")} wins the round by killing the King.`,
    ]);
  }

  return withDamage;
}

function resolveSicknessPhase(state: GameState): GameState {
  const pieces = state.pieces.map((piece) => {
    if (!piece.alive || piece.type === "king" || piece.sickness <= 0) {
      return piece;
    }

    return {
      ...piece,
      sickness: piece.sickness - 1,
    };
  });

  const reduced = state.pieces.filter((piece) => piece.alive && piece.type !== "king" && piece.sickness > 0).length;

  return {
    ...state,
    pieces,
    eventLog: [reduced > 0 ? `${reduced} summoned unit(s) recover from sickness.` : "No sickness counters to reduce."],
  };
}

function resolveSummonPhase(state: GameState): GameState {
  let pieces = state.pieces;
  let nextPieceId = state.nextPieceId;
  let nextEntryOrder = state.nextEntryOrder;
  let players = state.players;
  const events: string[] = [];

  for (const color of ["white", "black"] as PlayerColor[]) {
    const pending = players[color].pendingSummon;

    if (!pending) {
      events.push(`${capitalize(color)} has no committed summon.`);
      continue;
    }

    const occupied = deriveBoard(pieces)[pending.slot];

    if (occupied) {
      events.push(
        `${capitalize(color)} ${PIECE_STATS[pending.pieceType].label} summon fails because slot ${pending.slot} is occupied.`,
      );
      players = {
        ...players,
        [color]: {
          ...players[color],
          pendingSummon: undefined,
        },
      };
      continue;
    }

    const piece = {
      ...createPiece(pending.pieceType, color, pending.slot, nextPieceId, nextEntryOrder),
      sickness: 1,
    };

    pieces = [...pieces, piece];
    nextPieceId += 1;
    nextEntryOrder += 1;
    players = {
      ...players,
      [color]: {
        ...players[color],
        stock: {
          ...players[color].stock,
          [pending.pieceType]: players[color].stock[pending.pieceType] - 1,
        },
        pendingSummon: undefined,
      },
    };
    events.push(`${capitalize(color)} summons ${PIECE_STATS[pending.pieceType].label} on slot ${pending.slot}.`);
  }

  return {
    ...state,
    pieces,
    players,
    nextPieceId,
    nextEntryOrder,
    eventLog: events,
  };
}

function getPrimaryTargets(
  state: GameState,
  snapshot: Map<number, PieceState>,
  attacker: PieceState,
  defender: PieceState,
  direction: 1 | -1,
): PieceState[] {
  if (attacker.type !== "bishop" || !hasTransform(state, "bishopLine")) {
    return [defender];
  }

  const targets: PieceState[] = [defender];
  let position = defender.position + direction;

  while (isInsideBoard(position)) {
    const next = Array.from(snapshot.values()).find((piece) => piece.alive && piece.position === position);

    if (!next || next.owner !== defender.owner || next.type !== defender.type) {
      break;
    }

    targets.push(next);
    position += direction;
  }

  return targets;
}

function applyTrample(
  state: GameState,
  snapshot: Map<number, PieceState>,
  damageById: Map<number, number>,
  events: string[],
  attacker: PieceState,
  defender: PieceState,
  direction: 1 | -1,
  primaryTargets: PieceState[],
): void {
  if (!hasBuff(state, "trample")) {
    return;
  }

  const rawDamage = calculateOutgoingDamage(state, attacker, defender);
  const finalDamage = reduceIncomingDamage(state, defender, rawDamage);
  const overflow = finalDamage - defender.hp;

  if (overflow <= 0) {
    return;
  }

  const blockedIds = new Set(primaryTargets.map((target) => target.id));
  const targetPosition = defender.position + direction;
  const extraTarget = Array.from(snapshot.values()).find(
    (piece) => piece.alive && piece.position === targetPosition && piece.owner !== attacker.owner && !blockedIds.has(piece.id),
  );

  if (!extraTarget) {
    return;
  }

  const trampleDamage = reduceIncomingDamage(state, extraTarget, overflow);
  addDamage(damageById, extraTarget.id, trampleDamage);
  events.push(`${pieceName(attacker)} tramples ${trampleDamage} overflow into ${pieceName(extraTarget)}.`);
}

function calculateOutgoingDamage(state: GameState, attacker: PieceState, defender: PieceState): number {
  let damage = attacker.baseDamage + (hasBuff(state, "crowd") ? 1 : 0);

  if (attacker.type === "pawn" && hasTransform(state, "pawnDoubleVsMinor")) {
    if (defender.type === "knight" || defender.type === "bishop") {
      damage *= 2;
    }
  }

  if (attacker.type === "pawn" && defender.type === "king" && hasTransform(state, "pawnKingSlayer")) {
    damage *= 4;
  }

  if (attacker.type === "knight" && hasTransform(state, "knightTerritoryDouble")) {
    if (isEnemyTerritory(attacker.owner, defender.position)) {
      damage *= 2;
    }
  }

  return damage;
}

function reduceIncomingDamage(state: GameState, target: PieceState, damage: number): number {
  if (target.type === "rook" && hasTransform(state, "rookArmor")) {
    return Math.max(0, damage - 1);
  }

  return Math.max(0, damage);
}

function maybeFinishDraw(state: GameState): GameState {
  if (state.stage !== "battle") {
    return state;
  }

  const hasLivingCommonPiece = state.pieces.some((piece) => piece.alive && piece.type !== "king");
  const stockRemaining = getStockTotal(state.players.white.stock) + getStockTotal(state.players.black.stock);
  const hasPendingSummon = Boolean(state.players.white.pendingSummon || state.players.black.pendingSummon);

  if (!hasLivingCommonPiece && stockRemaining === 0 && !hasPendingSummon) {
    return finishRound(state, "draw", ["No common pieces remain and all round stock has been used. The round is a draw."]);
  }

  return state;
}

function finishRound(state: GameState, outcome: RoundOutcome, events: string[]): GameState {
  const whiteScore = outcome === "white" ? 1 : outcome === "draw" ? 0.5 : 0;
  const blackScore = outcome === "black" ? 1 : outcome === "draw" ? 0.5 : 0;

  return {
    ...state,
    stage: "roundResult",
    roundWinner: outcome,
    pendingCombats: [],
    players: {
      white: {
        ...state.players.white,
        score: state.players.white.score + whiteScore,
        pendingSummon: undefined,
        roundResults: [...state.players.white.roundResults, outcome],
      },
      black: {
        ...state.players.black,
        score: state.players.black.score + blackScore,
        pendingSummon: undefined,
        roundResults: [...state.players.black.roundResults, outcome],
      },
    },
    eventLog: events,
  };
}

function appendHistory(before: GameState, after: GameState): GameState {
  const entry: HistoryEntry = {
    turn: before.turn,
    round: before.round,
    phase: before.phase,
    before: formatBoard(before),
    events: after.eventLog,
    after: formatBoard(after),
    effects: [...after.activeBuffs, ...after.activeTransforms],
    score: {
      white: after.players.white.score,
      black: after.players.black.score,
    },
  };

  return {
    ...after,
    history: [entry, ...after.history].slice(0, MAX_HISTORY),
  };
}

function updatePlayer(state: GameState, color: PlayerColor, update: (player: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [color]: update(state.players[color]),
    },
  };
}

function getSummonSlot(color: PlayerColor, special: boolean): 1 | 2 | 7 | 8 {
  if (color === "white") {
    return special ? 2 : 1;
  }

  return special ? 7 : 8;
}

function getDirection(color: PlayerColor): 1 | -1 {
  return color === "white" ? 1 : -1;
}

function isInsideBoard(position: number): boolean {
  return position >= 0 && position < BOARD_SIZE;
}

function hasBuff(state: GameState, buff: BuffId): boolean {
  return state.activeBuffs.includes(buff);
}

function hasTransform(state: GameState, transform: TransformId): boolean {
  return state.activeTransforms.includes(transform);
}

function isBuff(effect: EffectId): effect is BuffId {
  return BUFF_OPTIONS.includes(effect as BuffId);
}

function isTransform(effect: EffectId): effect is TransformId {
  return !isBuff(effect);
}

function isEffectActive(state: GameState, effect: EffectId): boolean {
  return isBuff(effect) ? state.activeBuffs.includes(effect) : state.activeTransforms.includes(effect);
}

function isEnemyTerritory(owner: PlayerColor, position: number): boolean {
  return owner === "white" ? position >= 6 && position <= 9 : position >= 0 && position <= 3;
}

function addDamage(damageById: Map<number, number>, id: number, damage: number): void {
  damageById.set(id, (damageById.get(id) ?? 0) + damage);
}

function pieceToken(piece: PieceState): string {
  const color = piece.owner === "white" ? "W" : "B";
  const hp = Math.max(0, piece.hp);

  if (piece.type === "king") {
    return `${color}K${hp}`;
  }

  return `${PIECE_STATS[piece.type].short}${color}${hp}`;
}

function pieceName(piece: PieceState): string {
  return `${capitalize(piece.owner)} ${PIECE_STATS[piece.type].label}`;
}

function getFinalWinner(state: GameState): RoundOutcome {
  if (state.players.white.score === state.players.black.score) {
    return "draw";
  }

  return state.players.white.score > state.players.black.score ? "white" : "black";
}

function getPickTitle(kind: PickKind): string {
  if (kind === "buff") {
    return "Pick 1: Buff";
  }

  return kind === "transform2" ? "Pick 2: Transform" : "Pick 3: Transform";
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
