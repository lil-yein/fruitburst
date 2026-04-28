// Reusable Alert — dark plum pill with white text. Currently used for
// the "Show your hand!" tracking warning during gameplay; could host
// other transient game messages later.

import './Alert.css';

export type AlertProps = {
  children: React.ReactNode;
  className?: string;
};

export function Alert({ children, className = '' }: AlertProps) {
  return <div className={`fb-alert ${className}`}>{children}</div>;
}
