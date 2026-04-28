// Top-level screen router.
//
// App owns the active screen and the most-recent run. Navigation between
// screens is plain React state — no router library needed for five
// destinations and a strictly linear flow.
//
// Game state is intentionally NOT lifted up: each mount of <GameView />
// creates a fresh tracker / spawner / audio system / GameState. Going
// from game-over → calibration → game therefore unmounts the previous
// game instance and remounts a clean one, which gives us "Play Again"
// reset for free.

import { useState } from 'react';
import { GameView, type GameRunResult } from './components/GameView';
import { StartScreen } from './screens/StartScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import type { LeaderboardEntry } from './game/leaderboard';
import './App.css';

type Screen =
  | 'start'
  | 'calibration'
  | 'game'
  | 'game-over'
  | 'leaderboard';

type LeaderboardContext = {
  entries: LeaderboardEntry[];
  highlightName: string;
  highlightTime: number;
};

function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [lastRun, setLastRun] = useState<GameRunResult | null>(null);
  // When the player just submitted a score we hand the resulting top-N
  // list straight to the leaderboard screen so it can highlight their
  // entry without a re-read race.
  const [boardCtx, setBoardCtx] = useState<LeaderboardContext | null>(null);

  const goStart = () => setScreen('start');
  const goCalibration = () => setScreen('calibration');
  const goGame = () => setScreen('game');
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
        <StartScreen onStart={goCalibration} onLeaderboard={() => {
          setBoardCtx(null);
          goLeaderboard();
        }} />
      )}
      {screen === 'calibration' && (
        <CalibrationScreen onReady={goGame} onBack={goStart} />
      )}
      {screen === 'game' && <GameView onGameOver={handleGameOver} />}
      {screen === 'game-over' && lastRun && (
        <GameOverScreen
          run={lastRun}
          onSubmit={handleSubmitScore}
          onPlayAgain={goCalibration}
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
