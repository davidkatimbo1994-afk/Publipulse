import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
const CLASS: Record<Variant, string> = {
  primary: 'pp-primary-btn',
  secondary: 'pp-btn-secondary',
  ghost: 'pp-btn-ghost'
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Stretch to the full width of the container (phone-friendly primary actions). */
  block?: boolean;
}

export function Button({ variant = 'primary', block = false, className = '', type = 'button', ...rest }: ButtonProps) {
  const cls = [CLASS[variant], block ? 'pp-block' : '', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
