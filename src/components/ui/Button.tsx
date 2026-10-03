import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-xl transition-all ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-mystic-950 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100';

const variantStyles: Record<ButtonVariant, string> = {
  // Primary: champagne-gold gradient with NEAR-BLACK text (text-mystic-950).
  // Never text-white on gold — fails WCAG. Includes the scale press feel.
  primary:
    'accent-gradient text-mystic-950 font-bold shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98]',
  secondary:
    'bg-white/5 border border-slate-700/30 text-slate-100 font-semibold hover:bg-white/10 hover:border-iris-500/30',
  ghost: 'text-slate-300 hover:text-slate-50 hover:bg-white/5 font-medium',
};

/**
 * Shared design-system button.
 *
 * `primary` = accent-gradient + text-mystic-950 + scale press. Auth
 * screens keep the animated `oracle-btn` beam by combining classes:
 * `<Button variant="primary" className="oracle-btn w-full py-3">`.
 */
export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...rest}
    />
  );
}
