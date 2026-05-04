import { describe, expect, it } from "vitest";
import { EMPTY_COUNTS } from "./constants";
import { createInitialGameState, createPiece } from "./engine";
import { applyOnlinePost, makeAdvancePhasePost, makeCommitSummonPost, makeRevealSummonPost, makeSetDraftCountPost } from "./online";
import { createSummonCommitment } from "./secrets";
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

describe("online post adapter", () => {
  it("maps packed draft posts to engine draft updates", () => {
    let state = createInitialGameState();

    state = applyOnlinePost(makeSetDraftCountPost("white", "pawn", 8), state);
    state = applyOnlinePost(makeSetDraftCountPost("black", "queen", 1), state);

    expect(state.players.white.draft.pawn).toBe(8);
    expect(state.players.black.draft.queen).toBe(1);
  });

  it("guards duplicate phase-advance posts for the same battle moment", () => {
    const pawn = createPiece("pawn", "white", 1, 1, 1);
    let state = battleState([createPiece("king", "white", 0, 2, 2), createPiece("king", "black", 9, 3, 3), pawn]);
    const post = makeAdvancePhasePost(state);

    state = applyOnlinePost(post, state);
    expect(state.phase).toBe("whiteCollision");

    state = applyOnlinePost(post, state);
    expect(state.phase).toBe("whiteCollision");
  });

  it("maps sealed summon commit and reveal posts without exposing the input early", () => {
    const nonce = "sealed-online";
    const hash = createSummonCommitment({
      color: "white",
      round: 1,
      turn: 1,
      pieceType: "pawn",
      special: false,
      nonce,
    });
    let state = battleState([createPiece("king", "white", 0, 1, 1), createPiece("king", "black", 9, 2, 2)], {
      phase: "summon",
      players: {
        white: { ...createInitialGameState().players.white, stock: { ...EMPTY_COUNTS, pawn: 1 } },
        black: { ...createInitialGameState().players.black, stock: { ...EMPTY_COUNTS } },
      },
    });

    state = applyOnlinePost(makeCommitSummonPost("white", hash), state);
    expect(state.players.white.pendingSummon).toEqual({ hash });

    state = applyOnlinePost(makeRevealSummonPost("white", "pawn", false, nonce), state);
    expect(state.players.white.pendingSummon?.reveal?.pieceType).toBe("pawn");
    expect(state.players.white.pendingSummon?.reveal?.slot).toBe(1);
  });
});
