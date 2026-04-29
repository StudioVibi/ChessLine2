import type { BuffId, PlayerColor, TransformId, PieceType } from "./types";

const asset = (fileName: string) => new URL(`../../assets/${fileName}`, import.meta.url).href;

export const pieceImages: Record<PlayerColor, Record<PieceType, string>> = {
  white: {
    pawn: asset("W_Pawn.png"),
    knight: asset("W_Knight.png"),
    bishop: asset("W_Bishop.png"),
    rook: asset("W_Rook.png"),
    queen: asset("W_Queen.png"),
    king: asset("W_King.png"),
  },
  black: {
    pawn: asset("B_Pawn.png"),
    knight: asset("B_Knight.png"),
    bishop: asset("B_Bishop.png"),
    rook: asset("B_Rook.png"),
    queen: asset("B_Queen.png"),
    king: asset("B_King.png"),
  },
};

export const buffImages: Record<BuffId, { active: string; inactive: string }> = {
  growth: {
    active: asset("buff_regen.png"),
    inactive: asset("buff_regen_gray.png"),
  },
  crowd: {
    active: asset("buff_dmg.png"),
    inactive: asset("buff_dmg_gray.png"),
  },
  trample: {
    active: asset("buff_ramp.png"),
    inactive: asset("buff_ramp_gray.png"),
  },
};

export const tagImages: Record<"double" | "durable" | "speed" | "pierce" | "void" | "kingSlayer", string> = {
  double: asset("tag_2x.png"),
  durable: asset("tag_dur.png"),
  speed: asset("tag_spd.png"),
  pierce: asset("tag_pen.png"),
  void: asset("tag_void.png"),
  kingSlayer: asset("tag_ik.png"),
};

export const effectTagImages: Partial<Record<TransformId, string>> = {
  pawnDoubleVsMinor: tagImages.double,
  bishopLine: tagImages.pierce,
  rookArmor: tagImages.durable,
  queenSpeed: tagImages.speed,
  knightTerritoryDouble: tagImages.double,
  knightHopPawns: tagImages.void,
  pawnKingSlayer: tagImages.kingSlayer,
};

export const roundImages: Partial<Record<number, string>> = {
  1: asset("text_round1.png"),
  2: asset("text_round2.png"),
  4: asset("text_final_round.png"),
};
