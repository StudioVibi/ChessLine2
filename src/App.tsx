import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronsRight,
  Copy,
  Lock,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  StepForward,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { buffImages, effectTagImages, pieceImages, roundImages } from "./game/assets";
import {
  COMMON_PIECES,
  DRAFT_WEIGHT_LIMIT,
  EFFECT_COPY,
  PHASE_LABELS,
  PICK_OPTIONS,
  PIECE_STATS,
} from "./game/constants";
import {
  canStartGame,
  createInitialGameState,
  deriveBoard,
  formatBoard,
  formatScore,
  getDisplayedDamage,
  getDraftWeight,
  getPieceTransformTags,
  getRoundTitle,
} from "./game/engine";
import {
  createOnlineGame,
  createRoomId,
  makeAdvancePhasePost,
  makeCommitPickPost,
  makeClearSummonPost,
  makeCommitSummonPost,
  makeRevealPickPost,
  makeRevealSummonPost,
  makeResolveFullTurnPost,
  makeSetDraftCountPost,
} from "./game/online";
import { createInputNonce, createPickCommitment, createSummonCommitment } from "./game/secrets";
import type { OnlinePost } from "./game/online";
import type { BuffId, CommonPieceType, EffectId, GameState, PickKind, PieceCounts, PieceState, PlayerColor } from "./game/types";

const presets: Record<string, PieceCounts> = {
  Line: { pawn: 8, knight: 2, bishop: 2, rook: 0, queen: 0 },
  Power: { pawn: 0, knight: 0, bishop: 2, rook: 1, queen: 1 },
};

type LocalSummonSecret = {
  input: "summon";
  hash: string;
  color: PlayerColor;
  round: number;
  turn: number;
  pieceType: CommonPieceType;
  special: boolean;
  nonce: string;
};

type LocalPickSecret = {
  input: "pick";
  hash: string;
  color: PlayerColor;
  round: number;
  pickKind: PickKind;
  effect: EffectId;
  nonce: string;
};

function useOnlineGame(room: string): {
  state: GameState;
  synced: boolean;
  ping: number | null;
  post: (postData: OnlinePost) => void;
} {
  const gameRef = useRef<ReturnType<typeof createOnlineGame> | null>(null);
  const syncedRef = useRef(false);
  const [state, setState] = useState<GameState>(() => createInitialGameState());
  const [network, setNetwork] = useState<{ synced: boolean; ping: number | null }>({ synced: false, ping: null });

  useEffect(() => {
    let cancelled = false;
    const net = createOnlineGame(room);
    gameRef.current = net;
    syncedRef.current = false;
    setState(createInitialGameState());
    setNetwork({ synced: false, ping: null });

    const refresh = () => {
      if (cancelled) {
        return;
      }

      if (!syncedRef.current) {
        setState(createInitialGameState());
        setNetwork({ synced: false, ping: null });
        return;
      }

      setState(net.compute_render_state());
      const ping = net.ping();
      setNetwork({
        synced: syncedRef.current,
        ping: Number.isFinite(ping) ? Math.max(0, Math.round(ping)) : null,
      });
    };

    net.on_sync(() => {
      if (cancelled) {
        return;
      }

      syncedRef.current = true;
      refresh();
    });

    refresh();
    const intervalId = window.setInterval(refresh, 125);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      net.close();
      if (gameRef.current === net) {
        gameRef.current = null;
      }
    };
  }, [room]);

  return {
    state,
    synced: network.synced,
    ping: network.ping,
    post: (postData: OnlinePost) => {
      if (!syncedRef.current) {
        return;
      }

      gameRef.current?.post(postData);
    },
  };
}

export function App() {
  const [room] = useState(() => ensureRoomInUrl());
  const [localColor, setLocalColor] = useState<PlayerColor>(() => getStoredColor());
  const revealPostsRef = useRef<Set<string>>(new Set());
  const online = useOnlineGame(room);
  const game = online.state;
  const onlineReady = online.synced;

  const post = (postData: OnlinePost) => {
    online.post(postData);
  };

  const applyPreset = (color: PlayerColor, preset: PieceCounts) => {
    for (const pieceType of COMMON_PIECES) {
      post(makeSetDraftCountPost(color, pieceType, 0));
    }
    for (const pieceType of COMMON_PIECES) {
      post(makeSetDraftCountPost(color, pieceType, preset[pieceType]));
    }
  };

  const chooseColor = (color: PlayerColor) => {
    setLocalColor(color);
    window.localStorage.setItem("chess-line-2-color", color);
  };

  const copyRoomLink = () => {
    void navigator.clipboard?.writeText(getRoomUrl(room));
  };

  const commitHiddenSummon = (color: PlayerColor, pieceType: CommonPieceType, special: boolean) => {
    const nonce = createInputNonce();
    const hash = createSummonCommitment({
      color,
      round: game.round,
      turn: game.turn,
      pieceType,
      special,
      nonce,
    });

    saveLocalSecret(room, hash, {
      input: "summon",
      hash,
      color,
      round: game.round,
      turn: game.turn,
      pieceType,
      special,
      nonce,
    });
    post(makeCommitSummonPost(color, hash));
  };

  const commitHiddenPick = (color: PlayerColor, effect: EffectId) => {
    if (!game.pick) {
      return;
    }

    const nonce = createInputNonce();
    const hash = createPickCommitment({
      color,
      round: game.round,
      kind: game.pick.kind,
      effect,
      nonce,
    });

    saveLocalSecret(room, hash, {
      input: "pick",
      hash,
      color,
      round: game.round,
      pickKind: game.pick.kind,
      effect,
      nonce,
    });
    post(makeCommitPickPost(color, hash));
  };

  useEffect(() => {
    revealPostsRef.current.clear();
  }, [room]);

  useEffect(() => {
    if (!onlineReady) {
      return;
    }

    if (game.stage === "battle" && game.phase === "summon") {
      const pending = game.players[localColor].pendingSummon;
      if (pending && !pending.reveal) {
        const secret = readLocalSecret<LocalSummonSecret>(room, pending.hash);
        const revealKey = `summon:${pending.hash}`;

        if (
          secret?.input === "summon" &&
          secret.color === localColor &&
          secret.round === game.round &&
          secret.turn === game.turn &&
          !revealPostsRef.current.has(revealKey)
        ) {
          revealPostsRef.current.add(revealKey);
          post(makeRevealSummonPost(localColor, secret.pieceType, secret.special, secret.nonce));
        }
      }
    }

    if (game.stage === "pick" && game.pick) {
      const commitment = game.pick.commitments[localColor];
      const bothCommitted = Boolean(game.pick.commitments.white && game.pick.commitments.black);

      if (commitment && bothCommitted && !game.pick.reveals[localColor]) {
        const secret = readLocalSecret<LocalPickSecret>(room, commitment);
        const revealKey = `pick:${commitment}`;

        if (
          secret?.input === "pick" &&
          secret.color === localColor &&
          secret.round === game.round &&
          secret.pickKind === game.pick.kind &&
          !revealPostsRef.current.has(revealKey)
        ) {
          revealPostsRef.current.add(revealKey);
          post(makeRevealPickPost(localColor, secret.effect, secret.nonce));
        }
      }
    }
  }, [game, localColor, onlineReady, room]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Chess Line 2</h1>
          <p>Online deterministic room</p>
        </div>
        <div className="online-controls">
          <div className={onlineReady ? "network-pill synced" : "network-pill"} title={onlineReady ? "Synced" : "Syncing"}>
            {onlineReady ? <Wifi size={17} /> : <WifiOff size={17} />}
            <span>{onlineReady ? `${formatPing(online.ping)} ms` : "Syncing"}</span>
          </div>
          <div className="room-pill">
            <span>Room</span>
            <strong>{room}</strong>
            <button className="icon-button" title="Copy room link" onClick={copyRoomLink}>
              <Copy size={16} />
            </button>
          </div>
          <div className="side-switch" role="group" aria-label="Player side">
            <button className={localColor === "white" ? "selected" : ""} onClick={() => chooseColor("white")}>
              White
            </button>
            <button className={localColor === "black" ? "selected" : ""} onClick={() => chooseColor("black")}>
              Black
            </button>
          </div>
          <button className="ghost-button" disabled={!onlineReady} onClick={() => post({ $: "reset" })}>
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </header>

      {game.stage === "draft" && (
        <DraftScreen
          game={game}
          localColor={localColor}
          onlineReady={onlineReady}
          onDraftChange={(color, pieceType, count) => post(makeSetDraftCountPost(color, pieceType, count))}
          onPreset={applyPreset}
          onStart={() => post({ $: "startGame" })}
        />
      )}

      {game.stage === "roundIntro" && (
        <RoundIntro game={game} onlineReady={onlineReady} onBegin={() => post({ $: "beginRound", round: game.round })} />
      )}

      {game.stage === "battle" && (
        <BattleScreen
          game={game}
          room={room}
          localColor={localColor}
          onlineReady={onlineReady}
          onCommit={commitHiddenSummon}
          onClear={(color) => post(makeClearSummonPost(color))}
          onStep={() => post(makeAdvancePhasePost(game))}
          onTurn={() => post(makeResolveFullTurnPost(game))}
        />
      )}

      {game.stage === "roundResult" && (
        <RoundResult
          game={game}
          onlineReady={onlineReady}
          onContinue={() => post({ $: "continueAfterRound", round: game.round })}
        />
      )}

      {game.stage === "pick" && (
        <PickScreen
          game={game}
          room={room}
          localColor={localColor}
          onlineReady={onlineReady}
          onPick={commitHiddenPick}
        />
      )}

      {game.stage === "report" && <ReportScreen game={game} onlineReady={onlineReady} onRestart={() => post({ $: "reset" })} />}

      <EventLog events={game.eventLog} />
    </main>
  );
}

function DraftScreen({
  game,
  localColor,
  onlineReady,
  onDraftChange,
  onPreset,
  onStart,
}: {
  game: GameState;
  localColor: PlayerColor;
  onlineReady: boolean;
  onDraftChange: (color: PlayerColor, pieceType: CommonPieceType, count: number) => void;
  onPreset: (color: PlayerColor, preset: PieceCounts) => void;
  onStart: () => void;
}) {
  return (
    <section className="screen-stack">
      <div className="draft-grid">
        <DraftPanel
          color="white"
          game={game}
          disabled={!onlineReady || localColor !== "white"}
          onDraftChange={onDraftChange}
          onPreset={onPreset}
        />
        <DraftPanel
          color="black"
          game={game}
          disabled={!onlineReady || localColor !== "black"}
          onDraftChange={onDraftChange}
          onPreset={onPreset}
        />
      </div>
      <div className="start-row">
        <button className="primary-button" disabled={!onlineReady || !canStartGame(game)} onClick={onStart}>
          <Play size={18} />
          Start Run
        </button>
      </div>
    </section>
  );
}

function DraftPanel({
  color,
  game,
  disabled,
  onDraftChange,
  onPreset,
}: {
  color: PlayerColor;
  game: GameState;
  disabled: boolean;
  onDraftChange: (color: PlayerColor, pieceType: CommonPieceType, count: number) => void;
  onPreset: (color: PlayerColor, preset: PieceCounts) => void;
}) {
  const draft = game.players[color].draft;
  const weight = getDraftWeight(draft);

  return (
    <section className={`panel player-panel ${color} ${disabled ? "readonly" : ""}`}>
      <div className="panel-heading">
        <h2>{capitalize(color)} Draft</h2>
        <span className={weight > DRAFT_WEIGHT_LIMIT ? "weight danger" : "weight"}>
          {weight}/{DRAFT_WEIGHT_LIMIT}
        </span>
      </div>
      <div className="king-note">
        <img src={pieceImages[color].king} alt="" />
        <span>King included</span>
      </div>
      <div className="preset-row">
        {Object.entries(presets).map(([name, preset]) => (
          <button key={name} className="small-button" disabled={disabled} onClick={() => onPreset(color, preset)}>
            <Check size={15} />
            {name}
          </button>
        ))}
      </div>
      <div className="draft-list">
        {COMMON_PIECES.map((pieceType) => {
          const stats = PIECE_STATS[pieceType];
          const count = draft[pieceType];
          const canAdd = weight + stats.weight <= DRAFT_WEIGHT_LIMIT;

          return (
            <div className="draft-row" key={pieceType}>
              <img src={pieceImages[color][pieceType]} alt="" />
              <div className="draft-piece-copy">
                <strong>{stats.label}</strong>
                <span>
                  {stats.damage} ATK / {stats.maxHp} HP / {stats.weight} W
                </span>
              </div>
              <div className="stepper">
                <button
                  className="icon-button"
                  title={`Remove ${stats.label}`}
                  disabled={disabled || count <= 0}
                  onClick={() => onDraftChange(color, pieceType, count - 1)}
                >
                  <Minus size={16} />
                </button>
                <span>{count}</span>
                <button
                  className="icon-button"
                  title={`Add ${stats.label}`}
                  disabled={disabled || !canAdd}
                  onClick={() => onDraftChange(color, pieceType, count + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundIntro({ game, onlineReady, onBegin }: { game: GameState; onlineReady: boolean; onBegin: () => void }) {
  return (
    <section className="intro-screen">
      <ScoreBar game={game} />
      <div className="round-mark">
        {roundImages[game.round] ? <img src={roundImages[game.round]} alt={getRoundTitle(game.round)} /> : <h2>{getRoundTitle(game.round)}</h2>}
      </div>
      <button className="primary-button" disabled={!onlineReady} onClick={onBegin}>
        <Play size={18} />
        Begin {getRoundTitle(game.round)}
      </button>
    </section>
  );
}

function BattleScreen({
  game,
  room,
  localColor,
  onlineReady,
  onCommit,
  onClear,
  onStep,
  onTurn,
}: {
  game: GameState;
  room: string;
  localColor: PlayerColor;
  onlineReady: boolean;
  onCommit: (color: PlayerColor, pieceType: CommonPieceType, special: boolean) => void;
  onClear: (color: PlayerColor) => void;
  onStep: () => void;
  onTurn: () => void;
}) {
  return (
    <section className="battle-stack">
      <ScoreBar game={game} />
      <BuffBar game={game} />
      <Board game={game} />
      <div className="battle-controls">
        <button className="primary-button" disabled={!onlineReady} onClick={onStep}>
          <StepForward size={18} />
          Next Phase
        </button>
        <button className="secondary-button" disabled={!onlineReady} onClick={onTurn}>
          <ChevronsRight size={18} />
          Resolve Turn
        </button>
      </div>
      <div className="summon-grid">
        <SummonPanel
          color="white"
          game={game}
          room={room}
          localColor={localColor}
          disabled={!onlineReady || localColor !== "white"}
          onCommit={onCommit}
          onClear={onClear}
        />
        <SummonPanel
          color="black"
          game={game}
          room={room}
          localColor={localColor}
          disabled={!onlineReady || localColor !== "black"}
          onCommit={onCommit}
          onClear={onClear}
        />
      </div>
      <SpecPanel game={game} />
    </section>
  );
}

function ScoreBar({ game }: { game: GameState }) {
  return (
    <div className="scorebar">
      <div className="score-side white">
        <span>White</span>
        <strong>{formatScore(game.players.white.score)}</strong>
      </div>
      <div className="phase-chip">
        <strong>{getRoundTitle(game.round)}</strong>
        <span>
          Turn {game.turn || 1} / {PHASE_LABELS[game.phase]}
        </span>
      </div>
      <div className="score-side black">
        <span>Black</span>
        <strong>{formatScore(game.players.black.score)}</strong>
      </div>
    </div>
  );
}

function BuffBar({ game }: { game: GameState }) {
  const buffs: BuffId[] = ["growth", "crowd", "trample"];

  return (
    <div className="buffbar">
      {buffs.map((buff) => {
        const active = game.activeBuffs.includes(buff);
        return (
          <div className={active ? "buff active" : "buff"} key={buff} title={EFFECT_COPY[buff].title}>
            <img src={active ? buffImages[buff].active : buffImages[buff].inactive} alt="" />
            <span>{EFFECT_COPY[buff].title}</span>
          </div>
        );
      })}
    </div>
  );
}

function Board({ game }: { game: GameState }) {
  const board = useMemo(() => deriveBoard(game.pieces), [game.pieces]);

  return (
    <div className="board-shell">
      <div className="board">
        {board.map((piece, index) => (
          <div
            className={`slot ${index <= 3 ? "white-territory" : ""} ${index >= 6 ? "black-territory" : ""}`}
            key={index}
          >
            <span className="slot-index">{index}</span>
            {piece && <PieceView piece={piece} game={game} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PieceView({ piece, game }: { piece: PieceState; game: GameState }) {
  const tags = getPieceTransformTags(game, piece);

  return (
    <div className={`piece ${piece.owner}`}>
      <img className="piece-image" src={pieceImages[piece.owner][piece.type]} alt={`${piece.owner} ${piece.type}`} />
      {tags.length > 0 && (
        <div className="piece-tags">
          {tags.map((tag) => (
            <img src={effectTagImages[tag]} alt="" key={tag} />
          ))}
        </div>
      )}
      <div className="piece-stats">
        <span>{piece.hp} HP</span>
        <span>{getDisplayedDamage(game, piece)} ATK</span>
      </div>
    </div>
  );
}

function SummonPanel({
  color,
  game,
  room,
  localColor,
  disabled,
  onCommit,
  onClear,
}: {
  color: PlayerColor;
  game: GameState;
  room: string;
  localColor: PlayerColor;
  disabled: boolean;
  onCommit: (color: PlayerColor, pieceType: CommonPieceType, special: boolean) => void;
  onClear: (color: PlayerColor) => void;
}) {
  const player = game.players[color];
  const isLocal = color === localColor;
  const localSecret = player.pendingSummon ? readLocalSecret<LocalSummonSecret>(room, player.pendingSummon.hash) : undefined;
  const revealed = player.pendingSummon?.reveal;
  const localPending =
    isLocal && localSecret?.input === "summon"
      ? `${PIECE_STATS[localSecret.pieceType].label} to ${localSecret.special ? "special" : "normal"} slot`
      : undefined;

  return (
    <section className={`panel summon-panel ${color} ${disabled ? "readonly" : ""}`}>
      <div className="panel-heading">
        <h2>{capitalize(color)} Stock</h2>
        {player.pendingSummon ? (
          <button className="small-button" disabled={disabled} onClick={() => onClear(color)}>
            <X size={15} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="pending-line">
        {player.pendingSummon ? (
          <>
            <Lock size={15} />
            {localPending ??
              (revealed && isLocal
                ? `${PIECE_STATS[revealed.pieceType].label} to slot ${revealed.slot}`
                : "Sealed summon committed")}
          </>
        ) : (
          "No summon committed"
        )}
      </div>
      <div className="stock-list">
        {COMMON_PIECES.map((pieceType) => {
          const stock = player.stock[pieceType];
          const pieceDisabled = disabled || stock <= 0;
          return (
            <div className="stock-row" key={pieceType}>
              <img src={pieceImages[color][pieceType]} alt="" />
              <strong>{PIECE_STATS[pieceType].label}</strong>
              <span>x{stock}</span>
              <button disabled={pieceDisabled} className="small-button" onClick={() => onCommit(color, pieceType, false)}>
                <Plus size={15} />
                Normal
              </button>
              <button disabled={pieceDisabled} className="small-button" onClick={() => onCommit(color, pieceType, true)}>
                <Sparkles size={15} />
                Special
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PickScreen({
  game,
  room,
  localColor,
  onlineReady,
  onPick,
}: {
  game: GameState;
  room: string;
  localColor: PlayerColor;
  onlineReady: boolean;
  onPick: (color: PlayerColor, effect: EffectId) => void;
}) {
  const pick = game.pick;

  if (!pick) {
    return null;
  }

  const options = PICK_OPTIONS[pick.kind];
  const localCommitment = pick.commitments[localColor];
  const localSecret = localCommitment ? readLocalSecret<LocalPickSecret>(room, localCommitment) : undefined;
  const whiteCommitted = Boolean(pick.commitments.white || pick.reveals.white);
  const blackCommitted = Boolean(pick.commitments.black || pick.reveals.black);

  return (
    <section className="pick-screen">
      <ScoreBar game={game} />
      <h2>{pick.kind === "buff" ? "Pick 1: Buff" : pick.kind === "transform2" ? "Pick 2: Transform" : "Pick 3: Transform"}</h2>
      <div className="sealed-status-row">
        <span className={whiteCommitted ? "sealed-status committed" : "sealed-status"}>White {whiteCommitted ? "sealed" : "waiting"}</span>
        <span className={blackCommitted ? "sealed-status committed" : "sealed-status"}>Black {blackCommitted ? "sealed" : "waiting"}</span>
      </div>
      <div className={`pick-grid count-${options.length}`}>
        {options.map((effect) => {
          const revealedBy = getChosenBy(pick.reveals, effect);
          const locallySealed = localSecret?.input === "pick" && localSecret.effect === effect && !pick.reveals[localColor];
          const disabledForWhite =
            !onlineReady ||
            localColor !== "white" ||
            Boolean(pick.commitments.white || pick.reveals.white || revealedBy);
          const disabledForBlack =
            !onlineReady ||
            localColor !== "black" ||
            Boolean(pick.commitments.black || pick.reveals.black || revealedBy);

          return (
            <article className={revealedBy || locallySealed ? "pick-card chosen" : "pick-card"} key={effect}>
              <EffectArt effect={effect} />
              <h3>{EFFECT_COPY[effect].title}</h3>
              <p>{EFFECT_COPY[effect].detail}</p>
              {locallySealed && <span className="chosen-pill">Your sealed pick</span>}
              {revealedBy && <span className="chosen-pill">{capitalize(revealedBy)} revealed</span>}
              <div className="pick-actions">
                <button disabled={disabledForWhite} onClick={() => onPick("white", effect)}>
                  <Check size={15} />
                  White
                </button>
                <button disabled={disabledForBlack} onClick={() => onPick("black", effect)}>
                  <Check size={15} />
                  Black
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EffectArt({ effect }: { effect: EffectId }) {
  if (effect in buffImages) {
    const buff = effect as BuffId;
    return <img className="effect-art buff-art" src={buffImages[buff].active} alt="" />;
  }

  return <img className="effect-art tag-art" src={effectTagImages[effect as keyof typeof effectTagImages]} alt="" />;
}

function RoundResult({
  game,
  onlineReady,
  onContinue,
}: {
  game: GameState;
  onlineReady: boolean;
  onContinue: () => void;
}) {
  const resultText =
    game.roundWinner === "draw" ? "Round Draw" : `${capitalize(game.roundWinner ?? "white")} Wins ${getRoundTitle(game.round)}`;

  return (
    <section className="result-screen">
      <ScoreBar game={game} />
      <h2>{resultText}</h2>
      <div className="result-events">
        {game.eventLog.map((event, index) => (
          <p key={`${event}-${index}`}>{event}</p>
        ))}
      </div>
      <button className="primary-button" disabled={!onlineReady} onClick={onContinue}>
        <Play size={18} />
        {game.round >= 4 ? "Final Report" : "Continue"}
      </button>
    </section>
  );
}

function ReportScreen({
  game,
  onlineReady,
  onRestart,
}: {
  game: GameState;
  onlineReady: boolean;
  onRestart: () => void;
}) {
  const winner = game.finalWinner;
  const title = winner === "draw" ? "Final Result: Draw" : `Final Result: ${capitalize(winner ?? "white")} Wins`;
  const winnerDraft = winner === "white" || winner === "black" ? game.players[winner].draft : undefined;

  return (
    <section className="report-screen">
      <h2>{title}</h2>
      <p className="final-score">
        White {formatScore(game.players.white.score)} / Black {formatScore(game.players.black.score)}
      </p>
      {winnerDraft && (
        <div className="winner-draft">
          <h3>{capitalize(winner as PlayerColor)} Draft</h3>
          <div className="draft-summary">
            {COMMON_PIECES.filter((pieceType) => winnerDraft[pieceType] > 0).map((pieceType) => (
              <span key={pieceType}>
                {PIECE_STATS[pieceType].label} x{winnerDraft[pieceType]}
              </span>
            ))}
          </div>
        </div>
      )}
      <button className="primary-button" disabled={!onlineReady} onClick={onRestart}>
        <RotateCcw size={18} />
        New Run
      </button>
    </section>
  );
}

function SpecPanel({ game }: { game: GameState }) {
  return (
    <details className="spec-panel">
      <summary>SPEC State</summary>
      <div className="spec-content">
        <div>
          <strong>Board</strong>
          <code>{formatBoard(game)}</code>
        </div>
        <div>
          <strong>Effects</strong>
          <code>{[...game.activeBuffs, ...game.activeTransforms].join(", ") || "none"}</code>
        </div>
        <div className="history-list">
          {game.history.slice(0, 6).map((entry, index) => (
            <div className="history-entry" key={`${entry.round}-${entry.turn}-${entry.phase}-${index}`}>
              <span>
                R{entry.round} T{entry.turn} {PHASE_LABELS[entry.phase]}
              </span>
              <code>{entry.before}</code>
              <code>{entry.after}</code>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function EventLog({ events }: { events: string[] }) {
  return (
    <aside className="event-log">
      {events.slice(0, 5).map((event, index) => (
        <p key={`${event}-${index}`}>{event}</p>
      ))}
    </aside>
  );
}

function ensureRoomInUrl(): string {
  const url = new URL(window.location.href);
  const current = url.searchParams.get("room");
  const room = sanitizeRoom(current) ?? createRoomId();

  if (room !== current) {
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url);
  }

  return room;
}

function getRoomUrl(room: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  return url.toString();
}

function saveLocalSecret<T extends { hash: string }>(room: string, hash: string, secret: T): void {
  window.localStorage.setItem(getSecretStorageKey(room, hash), JSON.stringify(secret));
}

function readLocalSecret<T>(room: string, hash: string): T | undefined {
  const raw = window.localStorage.getItem(getSecretStorageKey(room, hash));

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function getSecretStorageKey(room: string, hash: string): string {
  return `chess-line-2-secret:${room}:${hash}`;
}

function sanitizeRoom(value: string | null): string | undefined {
  const room = value?.trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48);
  return room || undefined;
}

function getStoredColor(): PlayerColor {
  return window.localStorage.getItem("chess-line-2-color") === "black" ? "black" : "white";
}

function formatPing(ping: number | null): string {
  return ping === null ? "--" : `${ping}`;
}

function getChosenBy(choices: Partial<Record<PlayerColor, EffectId>>, effect: EffectId): PlayerColor | undefined {
  if (choices.white === effect) {
    return "white";
  }
  if (choices.black === effect) {
    return "black";
  }

  return undefined;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
