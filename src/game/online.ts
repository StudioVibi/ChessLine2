import { VibiNet } from "vibinet";
import {
  advancePhase,
  beginRound,
  choosePick,
  clearSummon,
  commitSummon,
  continueAfterRound,
  createInitialGameState,
  resetGame,
  resolveFullTurn,
  setDraftCount,
  startGame,
} from "./engine";
import type { BattlePhase, CommonPieceType, EffectId, GameState, PlayerColor } from "./types";

export const ONLINE_TICK_RATE = 12;
export const ONLINE_TOLERANCE_MS = 300;
export const VIBINET_SERVER_URL = "wss://net.vibistudiotest.site";

const COLORS: PlayerColor[] = ["white", "black"];
const PIECES: CommonPieceType[] = ["pawn", "knight", "bishop", "rook", "queen"];
const EFFECTS: EffectId[] = [
  "crowd",
  "growth",
  "trample",
  "pawnDoubleVsMinor",
  "bishopLine",
  "rookArmor",
  "queenSpeed",
  "knightTerritoryDouble",
  "knightHopPawns",
  "pawnKingSlayer",
];
const PHASES: BattlePhase[] = ["whiteMove", "whiteCollision", "blackMove", "blackCollision", "sickness", "summon"];

type ColorCode = 0 | 1;
type PieceCode = 0 | 1 | 2 | 3 | 4;
type EffectCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type PhaseCode = 0 | 1 | 2 | 3 | 4 | 5;
type Bit = 0 | 1;

export type OnlinePost =
  | { $: "reset" }
  | { $: "setDraftCount"; color: ColorCode; piece: PieceCode; count: number }
  | { $: "startGame" }
  | { $: "beginRound"; round: number }
  | { $: "commitSummon"; color: ColorCode; piece: PieceCode; special: Bit }
  | { $: "clearSummon"; color: ColorCode }
  | { $: "advancePhase"; round: number; turn: number; phase: PhaseCode }
  | { $: "resolveFullTurn"; round: number; turn: number; phase: PhaseCode }
  | { $: "continueAfterRound"; round: number }
  | { $: "choosePick"; color: ColorCode; effect: EffectCode };

const emptyStruct: VibiNet.Packed = { $: "Struct", fields: {} };
const colorPacker: VibiNet.Packed = { $: "UInt", size: 1 };
const piecePacker: VibiNet.Packed = { $: "UInt", size: 3 };
const effectPacker: VibiNet.Packed = { $: "UInt", size: 4 };
const phasePacker: VibiNet.Packed = { $: "UInt", size: 3 };
const roundPacker: VibiNet.Packed = { $: "UInt", size: 3 };
const turnPacker: VibiNet.Packed = { $: "UInt", size: 16 };

export const onlinePostPacker: VibiNet.Packed = {
  $: "Union",
  variants: {
    reset: emptyStruct,
    setDraftCount: {
      $: "Struct",
      fields: {
        color: colorPacker,
        piece: piecePacker,
        count: { $: "UInt", size: 5 },
      },
    },
    startGame: emptyStruct,
    beginRound: {
      $: "Struct",
      fields: {
        round: roundPacker,
      },
    },
    commitSummon: {
      $: "Struct",
      fields: {
        color: colorPacker,
        piece: piecePacker,
        special: { $: "UInt", size: 1 },
      },
    },
    clearSummon: {
      $: "Struct",
      fields: {
        color: colorPacker,
      },
    },
    advancePhase: {
      $: "Struct",
      fields: {
        round: roundPacker,
        turn: turnPacker,
        phase: phasePacker,
      },
    },
    resolveFullTurn: {
      $: "Struct",
      fields: {
        round: roundPacker,
        turn: turnPacker,
        phase: phasePacker,
      },
    },
    continueAfterRound: {
      $: "Struct",
      fields: {
        round: roundPacker,
      },
    },
    choosePick: {
      $: "Struct",
      fields: {
        color: colorPacker,
        effect: effectPacker,
      },
    },
  },
};

export function onlineTick(state: GameState): GameState {
  return state;
}

export function applyOnlinePost(post: OnlinePost, state: GameState): GameState {
  switch (post.$) {
    case "reset":
      return resetGame();

    case "setDraftCount": {
      const color = decode(COLORS, post.color);
      const piece = decode(PIECES, post.piece);

      return color && piece ? setDraftCount(state, color, piece, post.count) : state;
    }

    case "startGame":
      return startGame(state);

    case "beginRound":
      return state.round === post.round ? beginRound(state) : state;

    case "commitSummon": {
      const color = decode(COLORS, post.color);
      const piece = decode(PIECES, post.piece);

      return color && piece ? commitSummon(state, color, piece, post.special === 1) : state;
    }

    case "clearSummon": {
      const color = decode(COLORS, post.color);

      return color ? clearSummon(state, color) : state;
    }

    case "advancePhase":
      return matchesBattleMoment(state, post.round, post.turn, post.phase) ? advancePhase(state) : state;

    case "resolveFullTurn":
      return matchesBattleMoment(state, post.round, post.turn, post.phase) ? resolveFullTurn(state) : state;

    case "continueAfterRound":
      return state.round === post.round ? continueAfterRound(state) : state;

    case "choosePick": {
      const color = decode(COLORS, post.color);
      const effect = decode(EFFECTS, post.effect);

      return color && effect ? choosePick(state, color, effect) : state;
    }
  }
}

export function makeSetDraftCountPost(color: PlayerColor, pieceType: CommonPieceType, count: number): OnlinePost {
  return {
    $: "setDraftCount",
    color: encodeColor(color),
    piece: encodePiece(pieceType),
    count: Math.max(0, Math.min(31, Math.floor(count))),
  };
}

export function makeCommitSummonPost(color: PlayerColor, pieceType: CommonPieceType, special: boolean): OnlinePost {
  return {
    $: "commitSummon",
    color: encodeColor(color),
    piece: encodePiece(pieceType),
    special: special ? 1 : 0,
  };
}

export function makeClearSummonPost(color: PlayerColor): OnlinePost {
  return { $: "clearSummon", color: encodeColor(color) };
}

export function makeAdvancePhasePost(state: GameState): OnlinePost {
  return {
    $: "advancePhase",
    round: state.round,
    turn: state.turn,
    phase: encodePhase(state.phase),
  };
}

export function makeResolveFullTurnPost(state: GameState): OnlinePost {
  return {
    $: "resolveFullTurn",
    round: state.round,
    turn: state.turn,
    phase: encodePhase(state.phase),
  };
}

export function makeChoosePickPost(color: PlayerColor, effect: EffectId): OnlinePost {
  return { $: "choosePick", color: encodeColor(color), effect: encodeEffect(effect) };
}

function matchesBattleMoment(state: GameState, round: number, turn: number, phase: PhaseCode): boolean {
  return state.stage === "battle" && state.round === round && state.turn === turn && encodePhase(state.phase) === phase;
}

function encodeColor(color: PlayerColor): ColorCode {
  return codeFor(COLORS, color) as ColorCode;
}

function encodePiece(piece: CommonPieceType): PieceCode {
  return codeFor(PIECES, piece) as PieceCode;
}

function encodeEffect(effect: EffectId): EffectCode {
  return codeFor(EFFECTS, effect) as EffectCode;
}

function encodePhase(phase: BattlePhase): PhaseCode {
  return codeFor(PHASES, phase) as PhaseCode;
}

function codeFor<T>(items: T[], item: T): number {
  const code = items.indexOf(item);

  if (code < 0) {
    throw new Error(`Unknown online post value: ${String(item)}`);
  }

  return code;
}

function decode<T>(items: T[], code: number): T | undefined {
  return Number.isInteger(code) ? items[code] : undefined;
}

export function createOnlineGame(room: string): VibiNet<GameState, OnlinePost> {
  return new VibiNet.game<GameState, OnlinePost>({
    server: VIBINET_SERVER_URL,
    room,
    initial: createInitialGameState(),
    on_tick: onlineTick,
    on_post: applyOnlinePost,
    packer: onlinePostPacker,
    tick_rate: ONLINE_TICK_RATE,
    tolerance: ONLINE_TOLERANCE_MS,
    smooth: (_remoteState, localState) => localState,
  });
}

export function createRoomId(): string {
  return `cl2-${VibiNet.gen_name()}`;
}
