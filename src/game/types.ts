export type PlayerColor = "white" | "black";

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export type CommonPieceType = Exclude<PieceType, "king">;

export type PieceCounts = Record<CommonPieceType, number>;

export type BattlePhase = "whiteMove" | "whiteCollision" | "blackMove" | "blackCollision" | "summon";

export type GameStage = "draft" | "roundIntro" | "battle" | "roundResult" | "pick" | "report";

export type BuffId = "crowd" | "growth" | "trample";

export type TransformId =
  | "pawnDoubleVsMinor"
  | "bishopLine"
  | "rookArmor"
  | "queenSpeed"
  | "knightTerritoryDouble"
  | "knightHopPawns"
  | "pawnKingSlayer";

export type EffectId = BuffId | TransformId;

export type PickKind = "buff" | "transform2" | "transform3";

export type RoundOutcome = PlayerColor | "draw";

export interface PieceStats {
  label: string;
  short: string;
  maxHp: number;
  damage: number;
  weight: number;
}

export interface PieceState {
  id: number;
  type: PieceType;
  owner: PlayerColor;
  hp: number;
  maxHp: number;
  baseDamage: number;
  position: number;
  moves: number;
  enteredAt: number;
  alive: boolean;
}

export interface PendingSummon {
  pieceType: CommonPieceType;
  slot: 1 | 2 | 7 | 8;
  special: boolean;
}

export interface SealedSummon {
  hash: string;
  reveal?: PendingSummon;
}

export interface PlayerState {
  id: PlayerColor;
  color: PlayerColor;
  draft: PieceCounts;
  stock: PieceCounts;
  pendingSummon?: SealedSummon;
  score: number;
  roundResults: RoundOutcome[];
}

export interface PendingCombat {
  attackerId: number;
  defenderId: number;
  direction: 1 | -1;
}

export interface PickState {
  kind: PickKind;
  commitments: Partial<Record<PlayerColor, string>>;
  reveals: Partial<Record<PlayerColor, EffectId>>;
}

export interface HistoryEntry {
  turn: number;
  round: number;
  phase: BattlePhase;
  before: string;
  events: string[];
  after: string;
  effects: EffectId[];
  score: {
    white: number;
    black: number;
  };
}

export interface GameState {
  stage: GameStage;
  round: number;
  turn: number;
  phase: BattlePhase;
  pieces: PieceState[];
  players: Record<PlayerColor, PlayerState>;
  activeBuffs: BuffId[];
  activeTransforms: TransformId[];
  pendingCombats: PendingCombat[];
  pick?: PickState;
  roundWinner?: RoundOutcome;
  finalWinner?: RoundOutcome;
  eventLog: string[];
  history: HistoryEntry[];
  nextPieceId: number;
  nextEntryOrder: number;
}
