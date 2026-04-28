// Top-level screen router.
//
// Five visible states: 'start' | 'game' | 'game-over' | 'leaderboard',
// plus a `showCalibration` overlay flag layered on top of 'game'. The
// CalibrationModal renders over a paused GameView so the player sees
// the empty playfield + their webcam preview while reading the
// instructions; clicking "Let's get started!" lifts the pause and
// gameplay begins.
//
// Game state is intentionally not lifted: each mount of <GameView />
// creates a fresh tracker / spawner / audio system / GameState, so
// going game-over → game (Play Again) unmounts and remounts a clean
// instance — reset for free.

import { useState } from 'react';
import { GameView, type GameRunResult } from './components/GameView';
import { CalibrationModal } from './components/CalibrationModal';
import { StartScreen } from './screens/StartScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import type { LeaderboardEntry } from './game/leaderboard';
import './App.css';

type Screen = 'start' | 'game' | 'game-over' | 'leaderboard';

type LeaderboardContext = {
  entries: LeaderboardEntry[];
  highlightName: string;
  highlightTime: number;
};

function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [showCalibration, setShowCalibration] = useState(false);
  const [lastRun, setLastRun] = useState<GameRunResult | null>(null);
  // When the player just submitted a score we hand the resulting top-N
  // list straight to the leaderboard screen so it can highlight their
  // entry without a re-read race.
  const [boardCtx, setBoardCtx] = useState<LeaderboardContext | null>(null);

  const goStart = () => {
    setScreen('start');
    setShowCalibration(false);
  };
  const goGame = () => {
    setScreen('game');
    setShowCalibration(true);
  };
  const goLeaderboard = () => setScreen('leaderboard');

  const handleGameOver = (result: GameRunResult) => {
    setLastRun(result);
    setScreen('game-over');
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
    setScreen('leaderboard');
  };

  return (
    <>
      {screen === 'start' && (
        <StartScreen
          onStart={goGame}
          onLeaderboard={() => {
            setBoardCtx(null);
            goLeaderboard();
          }}
        />
      )}

      {screen === 'game' && (
        <>
          <GameView paused={showCalibration} onGameOver={handleGameOver} />
          {showCalibration && (
            <CalibrationModal
              onReady={() => setShowCalibration(false)}
              onBack={goStart}
            />
          )}
        </>
      )}

      {screen === 'game-over' && lastRun && (
        <GameOverScreen
          run={lastRun}
          onSubmit={handleSubmitScore}
          onPlayAgain={goGame}
          onSkipToLeaderboard={() => {
            setBoardCtx(null);
            goLeaderboard();
          }}
        />
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
