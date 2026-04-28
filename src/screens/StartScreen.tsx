// Start screen — placeholder. Title + Start Game + Leaderboard + the
// webcam permission primer. Will be re-skinned with the real Figma
// design in a follow-up CP; for now this is functional so the router
// flow can be tested end-to-end.

import { Button } from '../components/ui/Button';
import './screen.css';

export type StartScreenProps = {
  onStart: () => void;
  onLeaderboard: () => void;
};

export function StartScreen({ onStart, onLeaderboard }: StartScreenProps) {
  return (
    <div className="screen">
      <h1>FruitBurst</h1>

      <div className="screen-buttons">
        <Button variant="primary" onClick={onStart}>
          Start Game
        </Button>
        <Button variant="secondary" onClick={onLeaderboard}>
          Leaderboard
        </Button>
      </div>

      <p className="screen-permission-note">
        <strong>Quick heads up — we'll need your camera!</strong>
        <br />
        FruitBurst uses your webcam to track your hand so you can aim and flick.
        Everything happens right in your browser — nothing is recorded,
        uploaded, or shared.
      </p>
    </div>
  );
}
