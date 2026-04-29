import type { BattlePhase, BuffId, CommonPieceType, PieceCounts, PieceStats, PickKind, TransformId } from "./types";

export const BOARD_SIZE = 10;
export const DRAFT_WEIGHT_LIMIT = 20;

export const EMPTY_COUNTS: PieceCounts = {
  pawn: 0,
  knight: 0,
  bishop: 0,
  rook: 0,
  queen: 0,
};

export const COMMON_PIECES: CommonPieceType[] = ["pawn", "knight", "bishop", "rook", "queen"];

export const PIECE_STATS: Record<CommonPieceType | "king", PieceStats> = {
  pawn: {
    label: "Pawn",
    short: "P",
    maxHp: 1,
    damage: 1,
    weight: 1,
  },
  knight: {
    label: "Knight",
    short: "K",
    maxHp: 3,
    damage: 3,
    weight: 3,
  },
  bishop: {
    label: "Bishop",
    short: "B",
    maxHp: 3,
    damage: 3,
    weight: 3,
  },
  rook: {
    label: "Tower",
    short: "T",
    maxHp: 5,
    damage: 5,
    weight: 5,
  },
  queen: {
    label: "Queen",
    short: "Q",
    maxHp: 9,
    damage: 9,
    weight: 9,
  },
  king: {
    label: "King",
    short: "K",
    maxHp: 4,
    damage: 4,
    weight: 0,
  },
};

export const PHASE_LABELS: Record<BattlePhase, string> = {
  whiteMove: "White Move",
  whiteCollision: "White Collision",
  blackMove: "Black Move",
  blackCollision: "Black Collision",
  sickness: "Sickness Reduction",
  summon: "Summon Resolution",
};

export const BUFF_OPTIONS: BuffId[] = ["crowd", "growth", "trample"];

export const TRANSFORM_2_OPTIONS: TransformId[] = ["pawnDoubleVsMinor", "bishopLine", "rookArmor"];

export const TRANSFORM_3_OPTIONS: TransformId[] = [
  "queenSpeed",
  "knightTerritoryDouble",
  "knightHopPawns",
  "pawnKingSlayer",
];

export const PICK_OPTIONS: Record<PickKind, Array<BuffId | TransformId>> = {
  buff: BUFF_OPTIONS,
  transform2: TRANSFORM_2_OPTIONS,
  transform3: TRANSFORM_3_OPTIONS,
};

export const EFFECT_COPY: Record<BuffId | TransformId, { title: string; detail: string }> = {
  crowd: {
    title: "Multidao",
    detail: "Every piece gains +1 damage before multipliers.",
  },
  growth: {
    title: "Crescimento",
    detail: "A wounded piece heals 1 HP when it moves.",
  },
  trample: {
    title: "Atropelamento",
    detail: "Overkill damage can hit one additional target in sequence.",
  },
  pawnDoubleVsMinor: {
    title: "Pawn 2x",
    detail: "Pawns deal 2x damage against Knights and Bishops.",
  },
  bishopLine: {
    title: "Bishop Line",
    detail: "Bishops damage a contiguous sequence of equal units.",
  },
  rookArmor: {
    title: "Tower Durability",
    detail: "Towers reduce incoming damage by 1, minimum 0.",
  },
  queenSpeed: {
    title: "Queen Speed",
    detail: "Queens advance up to 5 slots, stopping for allies or combat.",
  },
  knightTerritoryDouble: {
    title: "Knight 2x Territory",
    detail: "Knights deal 2x damage to pieces in enemy territory.",
  },
  knightHopPawns: {
    title: "Knight Void Step",
    detail: "Knights ignore collision with Pawns and try to move one slot beyond.",
  },
  pawnKingSlayer: {
    title: "Pawn King Slayer",
    detail: "Pawns deal 4x damage against Kings.",
  },
};
