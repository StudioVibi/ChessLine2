import { describe, expect, it } from "vitest";
import { EMPTY_COUNTS } from "./constants";
import {
  advancePhase,
  beginRound,
  choosePick,
  clearSummon,
  commitSummon,
  continueAfterRound,
  createInitialGameState,
  createPiece,
  formatBoard,
  setDraftCount,
  startGame,
} from "./engine";
import type { GameState, PieceState } from "./types";

function battleState(pieces: PieceState[], patch: Partial<GameState> = {}): GameState {
  const base = createInitialGameState();

  return {
    ...base,
    stage: "battle",
    round: 1,
    turn: 1,
    phase: "whiteMove",
    pieces,
    players: {
      white: { ...base.players.white, stock: { ...EMPTY_COUNTS } },
      black: { ...base.players.black, stock: { ...EMPTY_COUNTS } },
    },
    nextPieceId: 100,
    nextEntryOrder: 100,
    ...patch,
  };
}

describe("Chess Line 2 engine", () => {
  it("resolves simultaneous collision damage without moving into the defender slot", () => {
    const rook = createPiece("rook", "white", 3, 1, 1);
    const knight = createPiece("knight", "black", 4, 2, 2);
    let state = battleState([createPiece("king", "white", 0, 3, 3), createPiece("king", "black", 9, 4, 4), rook, knight]);

    state = advancePhase(state);
    expect(state.pendingCombats).toHaveLength(1);

    state = advancePhase(state);
    expect(state.stage).toBe("battle");
    expect(formatBoard(state)).toContain("[TW2]");
    expect(formatBoard(state)).not.toContain("[KB");
  });

  it("applies additive damage before pawn king multiplier", () => {
    const pawn = createPiece("pawn", "white", 8, 1, 1);
    const whiteKing = createPiece("king", "white", 0, 2, 2);
    const blackKing = createPiece("king", "black", 9, 3, 3);
    let state = battleState([whiteKing, blackKing, pawn], {
      activeBuffs: ["crowd"],
      activeTransforms: ["pawnKingSlayer"],
    });

    state = advancePhase(state);
    state = advancePhase(state);

    expect(state.stage).toBe("roundResult");
    expect(state.roundWinner).toBe("white");
    expect(state.players.white.score).toBe(1);
  });

  it("does not consume stock when a committed summon slot is occupied at resolution", () => {
    const whiteKing = createPiece("king", "white", 0, 1, 1);
    const blackKing = createPiece("king", "black", 9, 2, 2);
    const blocker = createPiece("pawn", "black", 1, 3, 3);
    let state = battleState([whiteKing, blackKing, blocker], {
      phase: "summon",
      players: {
        white: {
          ...createInitialGameState().players.white,
          stock: { ...EMPTY_COUNTS, pawn: 1 },
          pendingSummon: { pieceType: "pawn", slot: 1, special: false },
        },
        black: { ...createInitialGameState().players.black, stock: { ...EMPTY_COUNTS } },
      },
    });

    state = advancePhase(state);

    expect(state.players.white.stock.pawn).toBe(1);
    expect(state.players.white.pendingSummon).toBeUndefined();
    expect(state.pieces.filter((piece) => piece.owner === "white" && piece.type === "pawn")).toHaveLength(0);
  });

  it("restores draft stock when a new round begins", () => {
    let state = createInitialGameState();
    state = setDraftCount(state, "white", "pawn", 1);
    state = setDraftCount(state, "black", "pawn", 1);
    state = startGame(state);
    state = beginRound(state);
    state = commitSummon(state, "white", "pawn", false);
    state = clearSummon(state, "black");
    state = { ...state, phase: "summon" };
    state = advancePhase(state);
    expect(state.players.white.stock.pawn).toBe(0);

    state = {
      ...state,
      stage: "roundResult",
      roundWinner: "white",
      round: 1,
    };
    state = continueAfterRound(state);
    state = choosePick(state, "white", "crowd");
    state = choosePick(state, "black", "growth");
    state = beginRound(state);

    expect(state.stage).toBe("battle");
    expect(state.players.white.stock.pawn).toBe(1);
    expect(state.players.black.stock.pawn).toBe(1);
  });

  it("locks a pick option after the first player chooses it", () => {
    let state = createInitialGameState();
    state = { ...state, stage: "roundResult", round: 1 };
    state = continueAfterRound(state);
    state = choosePick(state, "white", "crowd");
    state = choosePick(state, "black", "crowd");

    expect(state.stage).toBe("pick");
    expect(state.pick?.choices.white).toBe("crowd");
    expect(state.pick?.choices.black).toBeUndefined();
  });

  it("tramples overkill into at most one additional target", () => {
    const queen = createPiece("queen", "white", 3, 1, 1);
    const firstTower = createPiece("rook", "black", 4, 2, 2);
    const secondTower = createPiece("rook", "black", 5, 3, 3);
    const thirdTower = createPiece("rook", "black", 6, 4, 4);
    let state = battleState(
      [createPiece("king", "white", 0, 5, 5), createPiece("king", "black", 9, 6, 6), queen, firstTower, secondTower, thirdTower],
      { activeBuffs: ["trample"] },
    );

    state = advancePhase(state);
    state = advancePhase(state);

    expect(state.pieces.find((piece) => piece.id === 2)).toBeUndefined();
    expect(state.pieces.find((piece) => piece.id === 3)?.hp).toBe(1);
    expect(state.pieces.find((piece) => piece.id === 4)?.hp).toBe(5);
  });

  it("lets bishops hit a same-type sequence until interrupted", () => {
    const bishop = createPiece("bishop", "white", 3, 1, 1);
    const pawnA = createPiece("pawn", "black", 4, 2, 2);
    const pawnB = createPiece("pawn", "black", 5, 3, 3);
    const knight = createPiece("knight", "black", 6, 4, 4);
    let state = battleState(
      [createPiece("king", "white", 0, 5, 5), createPiece("king", "black", 9, 6, 6), bishop, pawnA, pawnB, knight],
      { activeTransforms: ["bishopLine"] },
    );

    state = advancePhase(state);
    state = advancePhase(state);

    expect(state.pieces.find((piece) => piece.id === 2)).toBeUndefined();
    expect(state.pieces.find((piece) => piece.id === 3)).toBeUndefined();
    expect(state.pieces.find((piece) => piece.id === 4)?.hp).toBe(3);
    expect(state.pieces.find((piece) => piece.id === 1)?.hp).toBe(2);
  });

  it("moves queens up to five slots and stops before combat", () => {
    const queen = createPiece("queen", "white", 1, 1, 1);
    const knight = createPiece("knight", "black", 6, 2, 2);
    let state = battleState(
      [createPiece("king", "white", 0, 3, 3), createPiece("king", "black", 9, 4, 4), queen, knight],
      { activeTransforms: ["queenSpeed"] },
    );

    state = advancePhase(state);
    expect(state.pieces.find((piece) => piece.id === 1)?.position).toBe(5);

    state = advancePhase(state);
    expect(state.pieces.find((piece) => piece.id === 1)?.hp).toBe(6);
    expect(state.pieces.find((piece) => piece.id === 2)).toBeUndefined();
  });
});
