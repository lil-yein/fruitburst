// Start screen: logo + camera-permission primer + Start/Leaderboard
// buttons. Background mirrors the in-game pink grid playfield so the
// visual transition into a run feels continuous.

import { Button } from '../components/ui/Button';
import './StartScreen.css';

export type StartScreenProps = {
  onStart: () => void;
  onLeaderboard: () => void;
};

export function StartScreen({ onStart, onLeaderboard }: StartScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <img
          src="/assets/ui/logo.svg"
          alt="FruitBurst"
          className="start-logo"
        />

        <p className="start-headline">
          Quick heads up, we'll need your camera!
        </p>

        <p className="start-privacy">
          Your webcam stays on your computer.
          <br />
          Nothing leaves, nothing is saved.
        </p>

        <div className="start-buttons">
          <Button variant="primary" onClick={onStart}>
            Start Game
          </Button>
          <Button variant="secondary" onClick={onLeaderboard}>
            Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
}
