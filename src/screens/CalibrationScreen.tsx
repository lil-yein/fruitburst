// Calibration / instruction screen — placeholder. The real screen will
// show the live mirrored webcam preview and gate the Ready button on
// tracking confirmation; this version just walks through the rules and
// dumps the user into the game when they're set.

import './screen.css';

export type CalibrationScreenProps = {
  onReady: () => void;
  onBack: () => void;
};

export function CalibrationScreen({
  onReady,
  onBack,
}: CalibrationScreenProps) {
  return (
    <div className="screen">
      <h1>How to play!</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p>
          <strong>Step back!</strong>
          <br />
          Sit about 30 cm from your screen so we can see your hand.
        </p>
        <p>
          <strong>Aim & flick!</strong>
          <br />
          Point with your finger, flick up to shoot fruits.
        </p>
        <p style={{ opacity: 0.8 }}>
          🍎 burst the fruits &nbsp; 💣 avoid bombs &nbsp; 💔 don't let any fall
        </p>
      </div>

      <div className="screen-buttons">
        <button className="screen-button" onClick={onReady}>
          Let's get started!
        </button>
        <button className="screen-button ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
