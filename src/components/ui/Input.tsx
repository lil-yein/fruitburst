// Reusable text Input — white fill, pink border, Cafe24PROUP. Forwards
// the ref so callers can focus it programmatically.

import { forwardRef } from 'react';
import './Input.css';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref
) {
  return (
    <input ref={ref} className={`fb-input ${className}`} {...props} />
  );
});
