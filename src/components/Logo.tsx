import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <div className={cn("w-5 h-5 rounded-md overflow-hidden bg-black flex items-center justify-center border border-white/10", className)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full p-1 text-white fill-current">
        <path d="M50 20c-15 0-28 10-35 25 7 15 20 25 35 25s28-10 35-25c-7-15-20-25-35-25zm0 40c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z" />
        <path d="M50 35c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 15c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" />
        <path d="M50 42c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z" />
      </svg>
    </div>
  );
}

export default function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={cn(
      "rounded-lg overflow-hidden flex items-center justify-center bg-black shadow-lg border border-white/10",
      sizeClasses[size],
      className
    )}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full p-1.5 text-white fill-current">
        {/* Outer Eye Shape */}
        <path d="M50 20c-20 0-38 12-45 30 7 18 25 30 45 30s38-12 45-30c-7-18-25-30-45-30zm0 50c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z" />
        {/* Spiral/Iris */}
        <path d="M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z" />
        {/* Pupil */}
        <circle cx="50" cy="50" r="4" />
        {/* Stylized Accents */}
        <path d="M50 15c0-5 5-10 10-10s5 5 5 5-5 5-10 5z" opacity="0.5" />
        <path d="M50 85c0 5-5 10-10 10s-5-5-5-5 5-5 10-5z" opacity="0.5" />
      </svg>
    </div>
  );
}
