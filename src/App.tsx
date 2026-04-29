// Top-level screen router.
//
// Two visible routes — 'start' | 'game' — plus three overlay flags
// that can be layered on top of either route:
//   • showCalibration → CalibrationModal      (only on 'game'; pauses game)
//   • lastRun !== null → GameOverModal        (only on 'game'; gameState's
//                                              own gameOver freezes play)
//   • showLeaderboard → LeaderboardModal      (any route; pauses game when
//                                              shown over 'game')
//
// At most one modal is intended to be visible at a time. The render
// logic enforces a precedence: calibration > leaderboard > game-over.
//
// Game state is intentionally not lifted up. Each mount of <GameView />
// builds a fresh tracker / spawner / audio / GameState; bumping `runId`
// on Play Again forces React to unmount the dead instance and mount a
// clean one — automatic reset.

import { useState } from 'react';
import { GameView, type GameRunResult } from './components/GameView';
import { CalibrationModal } from './components/CalibrationModal';
import { GameOverModal } from './components/GameOverModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StartScreen } from './screens/StartScreen';
import type { LeaderboardEntry } from './game/leaderboard';
import './App.css';

type Screen = 'start' | 'game';

type LeaderboardContext = {
  entries: LeaderboardEntry[];
  highlightName: string;
  highlightTime: number;
};

function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [lastRun, setLastRun] = useState<GameRunResult | null>(null);
  // Bumped on Play Again to force a fresh GameView mount (clean state).
  const [runId, setRunId] = useState(0);
  // When the player just submitted a score we hand the resulting top-N
  // list straight to the leaderboard modal so it can highlight their
  // entry without a re-read race.
  const [boardCtx, setBoardCtx] = useState<LeaderboardContext | null>(null);

  const goStart = () => {
    setScreen('start');
    setShowCalibration(false);
    setShowLeaderboard(false);
    setLastRun(null);
  };

  /** Start a new run from any screen — forces a fresh GameView mount and
   *  shows the calibration modal on top. */
  const startNewRun = () => {
    setRunId((r) => r + 1);
    setLastRun(null);
    setShowLeaderboard(false);
    setShowCalibration(true);
    setScreen('game');
  };

  const openLeaderboardFromStart = () => {
    setBoardCtx(null);
    setShowLeaderboard(true);
  };

  const handleGameOver = (result: GameRunResult) => {
    setLastRun(result);
  };

  const handleSubmitScore = (
    entries: LeaderboardEntry[],
    submittedName: string
  ) => {
    if (!lastRun) return;
    setBoardCtx({
      entries,
      highlightName: submittedName,
      highlightTime: lastRun.timeSec,
    });
    setLastRun(null);
    setShowLeaderboard(true);
  };

  // Game freezes whenever any modal is up that obscures play.
  const gamePaused = showCalibration || showLeaderboard;

  // Modal precedence: calibration > leaderboard > game-over.
  const showCal = showCalibration;
  const showBoard = !showCal && showLeaderboard;
  const showGameOver = !showCal && !showBoard && lastRun !== null;

  return (
    <>
      {screen === 'start' && <StartScreen onStart={startNewRun} onLeaderboard={openLeaderboardFromStart} />}

      {screen === 'game' && (
        <GameView
          key={runId}
          paused={gamePaused}
          onGameOver={handleGameOver}
        />
      )}

      {showCal && (
        <CalibrationModal
          onReady={() => setShowCalibration(false)}
          onBack={goStart}
        />
      )}

      {showGameOver && lastRun && (
        <GameOverModal
          run={lastRun}
          onSubmit={handleSubmitScore}
          onPlayAgain={startNewRun}
          onBackHome={goStart}
        />
      )}

      {showBoard && (
        <LeaderboardModal
          entries={boardCtx?.entries}
          highlightName={boardCtx?.highlightName}
          highlightTime={boardCtx?.highlightTime}
          // boardCtx is only set after a fresh save → user just finished
          // a run, so the primary action is a re-roll. From the start
          // screen the board opens cold and the primary action is to
          // play for the first time.
          playButtonLabel={boardCtx ? 'Play Again' : 'Play Game'}
          onPlayAgain={startNewRun}
          onBackHome={goStart}
        />
      )}
    </>
  );
}

export default App;
