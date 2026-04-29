// Reusable Button — primary (pink fill, light-pink border, dark drop
// shadow) and secondary (white fill, pink drop shadow). Both variants
// share the same hover lift and press inset.
//
// Every successful click plays the shared UI click SFX. Set
// `silent` to skip it (useful for buttons that mute themselves
// while a different sound plays).

import { playUiClick } from '../../game/audio';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  /** Skip the default UI click sound on press. */
  silent?: boolean;
};

export function Button({
  variant = 'primary',
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
  silent = false,
}: ButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (!silent) playUiClick();
    onClick?.();
  };

  return (
    <button
      type={type}
      className={`fb-button fb-button--${variant} ${className}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
