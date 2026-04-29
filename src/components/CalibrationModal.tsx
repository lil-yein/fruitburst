// Calibration / instruction modal — overlays the (paused) game screen.
//
// Layout per Figma node 28:1217:
//   • 1064 × 474 card, 8px pink border, 16px radius, centered.
//   • Background is 22 alternating pink/lighter-pink stripes. The
//     bottom 130px swap to a solid #FFEBEF "button area" capped by a
//     lace divider.
//   • Three graphic panels at the top (graphic1 / graphic2 / graphic3
//     PNGs include their labels and arrows baked in).
//   • Three instructional captions below the graphics in Domino Mono
//     Bold A 16/20.
//   • Two buttons centered in the button area: primary "Let's get
//     started!" and secondary "Back".
// A 20% #121011 overlay sits behind the card.

import { Button } from './ui/Button';
import './CalibrationModal.css';

export type CalibrationModalProps = {
  onReady: () => void;
  onBack: () => void;
};

export function CalibrationModal({ onReady, onBack }: CalibrationModalProps) {
  return (
    <div className="calibration-overlay">
      <div className="calibration-modal">
        <div className="calibration-stripes">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className={`calibration-stripe ${
                i % 2 === 0 ? 'odd' : 'even'
              }`}
            />
          ))}
        </div>

        <div className="calibration-content">
          <div className="calibration-graphics">
            <img
              src="/assets/ui/graphic1.png"
              alt=""
              className="calibration-graphic"
            />
            <img
              src="/assets/ui/graphic2.png"
              alt=""
              className="calibration-graphic"
            />
            <img
              src="/assets/ui/graphic3.png"
              alt=""
              className="calibration-graphic"
            />
          </div>

          <div className="calibration-descriptions">
            <p className="calibration-desc">
              Sit about 30 cm from your screen so we can see your hand.
            </p>
            <p className="calibration-desc">
              Point with your index finger to aim. Flick UP to burst a fruit!
            </p>
            <div className="calibration-desc">
              <p>🍎 fruits = good! burst them!</p>
              <p>💣 bombs = bad! let them pass!</p>
            </div>
          </div>
        </div>

        <div className="calibration-button-area">
          <div className="calibration-lace" />
          <div className="calibration-buttons">
            <Button variant="primary" onClick={onReady}>
              Let's get started!
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
