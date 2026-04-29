import { describe, expect, it } from "vitest";
import { EMPTY_COUNTS } from "./constants";
import { createInitialGameState, createPiece } from "./engine";
import { applyOnlinePost, makeAdvancePhasePost, makeSetDraftCountPost } from "./online";
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
});
