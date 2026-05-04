import type { CommonPieceType, EffectId, PickKind, PlayerColor } from "./types";

export function createInputNonce(): string {
  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSummonCommitment({
  color,
  round,
  turn,
  pieceType,
  special,
  nonce,
}: {
  color: PlayerColor;
  round: number;
  turn: number;
  pieceType: CommonPieceType;
  special: boolean;
  nonce: string;
}): string {
  return hashSecret(["summon", color, round, turn, pieceType, special ? "special" : "normal", nonce]);
}

export function createPickCommitment({
  color,
  round,
  kind,
  effect,
  nonce,
}: {
  color: PlayerColor;
  round: number;
  kind: PickKind;
  effect: EffectId;
  nonce: string;
}): string {
  return hashSecret(["pick", color, round, kind, effect, nonce]);
}

function hashSecret(parts: Array<string | number>): string {
  const payload = parts.map(String).join("|");
  let hash = 0xcbf29ce484222325n;

  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
}
