import { useMemo, useState } from "react";
import {
  Check,
  ChevronsRight,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  StepForward,
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
  advancePhase,
  beginRound,
  canStartGame,
  choosePick,
  clearSummon,
  commitSummon,
  continueAfterRound,
  createInitialGameState,
  deriveBoard,
  formatBoard,
  formatScore,
  getDisplayedDamage,
  getDraftWeight,
  getPieceTransformTags,
  getRoundTitle,
  resolveFullTurn,
  resetGame,
  setDraftCount,
  startGame,
} from "./game/engine";
import type { BuffId, CommonPieceType, EffectId, GameState, PieceCounts, PieceState, PlayerColor } from "./game/types";

const presets: Record<string, PieceCounts> = {
  Line: { pawn: 8, knight: 2, bishop: 2, rook: 0, queen: 0 },
  Power: { pawn: 0, knight: 0, bishop: 2, rook: 1, queen: 1 },
};

export function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGameState());

  const run = (update: (state: GameState) => GameState) => {
    setGame((current) => update(current));
  };

  const applyPreset = (color: PlayerColor, preset: PieceCounts) => {
    setGame((current) =>
      COMMON_PIECES.reduce((next, pieceType) => setDraftCount(next, color, pieceType, preset[pieceType]), current),
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Chess Line 2</h1>
          <p>Deterministic local SPEC mode</p>
        </div>
        <button className="ghost-button" onClick={() => setGame(resetGame())}>
          <RotateCcw size={18} />
          Reset
        </button>
      </header>

      {game.stage === "draft" && (
        <DraftScreen
          game={game}
          onDraftChange={(color, pieceType, count) => run((state) => setDraftCount(state, color, pieceType, count))}
          onPreset={applyPreset}
          onStart={() => run(startGame)}
        />
      )}

      {game.stage === "roundIntro" && <RoundIntro game={game} onBegin={() => run(beginRound)} />}

      {game.stage === "battle" && (
        <BattleScreen
          game={game}
          onCommit={(color, pieceType, special) => run((state) => commitSummon(state, color, pieceType, special))}
          onClear={(color) => run((state) => clearSummon(state, color))}
          onStep={() => run(advancePhase)}
          onTurn={() => run(resolveFullTurn)}
        />
      )}

      {game.stage === "roundResult" && <RoundResult game={game} onContinue={() => run(continueAfterRound)} />}

      {game.stage === "pick" && <PickScreen game={game} onPick={(color, effect) => run((state) => choosePick(state, color, effect))} />}

      {game.stage === "report" && <ReportScreen game={game} onRestart={() => setGame(resetGame())} />}

      <EventLog events={game.eventLog} />
    </main>
  );
}

function DraftScreen({
  game,
  onDraftChange,
  onPreset,
  onStart,
}: {
  game: GameState;
  onDraftChange: (color: PlayerColor, pieceType: CommonPieceType, count: number) => void;
  onPreset: (color: PlayerColor, preset: PieceCounts) => void;
  onStart: () => void;
}) {
  return (
    <section className="screen-stack">
      <div className="draft-grid">
        <DraftPanel color="white" game={game} onDraftChange={onDraftChange} onPreset={onPreset} />
        <DraftPanel color="black" game={game} onDraftChange={onDraftChange} onPreset={onPreset} />
      </div>
      <div className="start-row">
        <button className="primary-button" disabled={!canStartGame(game)} onClick={onStart}>
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
  onDraftChange,
  onPreset,
}: {
  color: PlayerColor;
  game: GameState;
  onDraftChange: (color: PlayerColor, pieceType: CommonPieceType, count: number) => void;
  onPreset: (color: PlayerColor, preset: PieceCounts) => void;
}) {
  const draft = game.players[color].draft;
  const weight = getDraftWeight(draft);

  return (
    <section className={`panel player-panel ${color}`}>
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
          <button key={name} className="small-button" onClick={() => onPreset(color, preset)}>
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
                  disabled={count <= 0}
                  onClick={() => onDraftChange(color, pieceType, count - 1)}
                >
                  <Minus size={16} />
                </button>
                <span>{count}</span>
                <button
                  className="icon-button"
                  title={`Add ${stats.label}`}
                  disabled={!canAdd}
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

function RoundIntro({ game, onBegin }: { game: GameState; onBegin: () => void }) {
  return (
    <section className="intro-screen">
      <ScoreBar game={game} />
      <div className="round-mark">
        {roundImages[game.round] ? <img src={roundImages[game.round]} alt={getRoundTitle(game.round)} /> : <h2>{getRoundTitle(game.round)}</h2>}
      </div>
      <button className="primary-button" onClick={onBegin}>
        <Play size={18} />
        Begin {getRoundTitle(game.round)}
      </button>
    </section>
  );
}

function BattleScreen({
  game,
  onCommit,
  onClear,
  onStep,
  onTurn,
}: {
  game: GameState;
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
        <button className="primary-button" onClick={onStep}>
          <StepForward size={18} />
          Next Phase
        </button>
        <button className="secondary-button" onClick={onTurn}>
          <ChevronsRight size={18} />
          Resolve Turn
        </button>
      </div>
      <div className="summon-grid">
        <SummonPanel color="white" game={game} onCommit={onCommit} onClear={onClear} />
        <SummonPanel color="black" game={game} onCommit={onCommit} onClear={onClear} />
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
      {piece.sickness > 0 && <span className="sickness">S</span>}
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
  onCommit,
  onClear,
}: {
  color: PlayerColor;
  game: GameState;
  onCommit: (color: PlayerColor, pieceType: CommonPieceType, special: boolean) => void;
  onClear: (color: PlayerColor) => void;
}) {
  const player = game.players[color];

  return (
    <section className={`panel summon-panel ${color}`}>
      <div className="panel-heading">
        <h2>{capitalize(color)} Stock</h2>
        {player.pendingSummon ? (
          <button className="small-button" onClick={() => onClear(color)}>
            <X size={15} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="pending-line">
        {player.pendingSummon ? (
          <>
            <Sparkles size={15} />
            {PIECE_STATS[player.pendingSummon.pieceType].label} to slot {player.pendingSummon.slot}
          </>
        ) : (
          "No summon committed"
        )}
      </div>
      <div className="stock-list">
        {COMMON_PIECES.map((pieceType) => {
          const stock = player.stock[pieceType];
          const disabled = stock <= 0;
          return (
            <div className="stock-row" key={pieceType}>
              <img src={pieceImages[color][pieceType]} alt="" />
              <strong>{PIECE_STATS[pieceType].label}</strong>
              <span>x{stock}</span>
              <button disabled={disabled} className="small-button" onClick={() => onCommit(color, pieceType, false)}>
                <Plus size={15} />
                Normal
              </button>
              <button disabled={disabled} className="small-button" onClick={() => onCommit(color, pieceType, true)}>
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

function PickScreen({ game, onPick }: { game: GameState; onPick: (color: PlayerColor, effect: EffectId) => void }) {
  const pick = game.pick;

  if (!pick) {
    return null;
  }

  const options = PICK_OPTIONS[pick.kind];
  const pickedEffects = Object.values(pick.choices);

  return (
    <section className="pick-screen">
      <ScoreBar game={game} />
      <h2>{pick.kind === "buff" ? "Pick 1: Buff" : pick.kind === "transform2" ? "Pick 2: Transform" : "Pick 3: Transform"}</h2>
      <div className={`pick-grid count-${options.length}`}>
        {options.map((effect) => {
          const chosenBy = getChosenBy(pick.choices, effect);
          const disabledForWhite = Boolean(pick.choices.white || chosenBy);
          const disabledForBlack = Boolean(pick.choices.black || chosenBy);

          return (
            <article className={chosenBy ? "pick-card chosen" : "pick-card"} key={effect}>
              <EffectArt effect={effect} />
              <h3>{EFFECT_COPY[effect].title}</h3>
              <p>{EFFECT_COPY[effect].detail}</p>
              {chosenBy && <span className="chosen-pill">{capitalize(chosenBy)} picked</span>}
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

function RoundResult({ game, onContinue }: { game: GameState; onContinue: () => void }) {
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
      <button className="primary-button" onClick={onContinue}>
        <Play size={18} />
        {game.round >= 4 ? "Final Report" : "Continue"}
      </button>
    </section>
  );
}

function ReportScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
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
      <button className="primary-button" onClick={onRestart}>
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
