import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'dark' | 'secondary' | 'danger' | 'ghost'

const STYLES: Record<Variant, string> = {
  primary: 'bg-gold-gradient text-ink shadow-gold active:brightness-95 disabled:opacity-50 disabled:shadow-none',
  dark: 'bg-ink text-gold-light active:bg-charcoal disabled:opacity-50',
  secondary: 'bg-white text-ink border border-ink/15 active:bg-sand disabled:text-ink/40',
  danger: 'bg-white text-rb-red border border-rb-red/60 active:bg-rb-red/5',
  ghost: 'bg-transparent text-ink/70 active:bg-ink/5',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`min-h-12 rounded-2xl px-5 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed ${STYLES[variant]} ${className}`}
      {...props}
    />
  )
}
