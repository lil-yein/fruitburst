// Reusable Button — primary (pink fill, light-pink border, dark drop
// shadow) and secondary (white fill, pink drop shadow). Both variants
// share the same hover lift and press inset.

import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
};

export function Button({
  variant = 'primary',
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`fb-button fb-button--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
