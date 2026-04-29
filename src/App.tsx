// Top-level screen router.
//
// Three visible routes — 'start' | 'game' | 'leaderboard' — plus two
// overlay flags layered on top of 'game':
//   • showCalibration → CalibrationModal (gameplay paused)
//   • lastRun !== null → GameOverModal   (gameplay frozen via internal
//                                         gameState.gameOver)
//
// Game state is intentionally not lifted up. Each mount of <GameView />
// builds a fresh tracker / spawner / audio / GameState, so changing the
// `runId` key on Play Again forces React to unmount the dead game and
// remount a clean one — automatic reset.

import { useState } from 'react';
import { GameView, type GameRunResult } from './components/GameView';
import { CalibrationModal } from './components/CalibrationModal';
import { GameOverModal } from './components/GameOverModal';
import { StartScreen } from './screens/StartScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import type { LeaderboardEntry } from './game/leaderboard';
import './App.css';

type Screen = 'start' | 'game' | 'leaderboard';

type LeaderboardContext = {
  entries: LeaderboardEntry[];
  highlightName: string;
  highlightTime: number;
};

function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [showCalibration, setShowCalibration] = useState(false);
  const [lastRun, setLastRun] = useState<GameRunResult | null>(null);
  // Bumped on Play Again to force a fresh GameView mount (clean state).
  const [runId, setRunId] = useState(0);
  // When the player just submitted a score we hand the resulting top-N
  // list straight to the leaderboard screen so it can highlight their
  // entry without a re-read race.
  const [boardCtx, setBoardCtx] = useState<LeaderboardContext | null>(null);

  const goStart = () => {
    setScreen('start');
    setShowCalibration(false);
    setLastRun(null);
  };

  /** Start a new run from any screen — forces a fresh GameView mount and
   *  shows the calibration modal on top. */
  const startNewRun = () => {
    setRunId((r) => r + 1);
    setLastRun(null);
    setShowCalibration(true);
    setScreen('game');
  };

  const goLeaderboard = () => setScreen('leaderboard');

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
    setScreen('leaderboard');
  };

  return (
    <>
      {screen === 'start' && (
        <StartScreen
          onStart={startNewRun}
          onLeaderboard={() => {
            setBoardCtx(null);
            goLeaderboard();
          }}
        />
      )}

      {screen === 'game' && (
        <>
          <GameView
            key={runId}
            paused={showCalibration}
            onGameOver={handleGameOver}
          />
          {showCalibration && (
            <CalibrationModal
              onReady={() => setShowCalibration(false)}
              onBack={goStart}
            />
          )}
          {lastRun && !showCalibration && (
            <GameOverModal
              run={lastRun}
              onSubmit={handleSubmitScore}
              onPlayAgain={startNewRun}
              onBackHome={goStart}
            />
          )}
        </>
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen
          entries={boardCtx?.entries}
          highlightName={boardCtx?.highlightName}
          highlightTime={boardCtx?.highlightTime}
          onBack={goStart}
        />
      )}
    </>
  );
}

export default App;
