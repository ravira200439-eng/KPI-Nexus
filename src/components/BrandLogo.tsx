import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showCompany?: boolean;
  compact?: boolean;
  variant?: 'dark' | 'light';
}

export function BrandLogo({
  size = 'md',
  showCompany = true,
  compact = false,
  variant = 'dark',
}: BrandLogoProps) {
  const iconDim = size === 'sm' ? 32 : size === 'lg' ? 52 : 40;
  const titleClass =
    size === 'sm'
      ? 'text-base font-bold tracking-tight'
      : size === 'lg'
        ? 'text-2xl font-bold tracking-tight'
        : 'text-lg font-bold tracking-tight';

  const isLight = variant === 'light';

  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-xs"
      >
        <defs>
          <linearGradient id="kpiNexusGold" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="55%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <path
          d="M24 3L42 12V25C42 35.2 34.1 42.7 24 45C13.9 42.7 6 35.2 6 25V12L24 3Z"
          fill="#0F172A"
          stroke="url(#kpiNexusGold)"
          strokeWidth="2.2"
        />
        <path
          d="M15 31L21 24L26 28L33 17"
          stroke="#FACC15"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 17H33V22"
          stroke="#FACC15"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="31" r="2.2" fill="#D4AF37" />
        <circle cx="21" cy="24" r="2.2" fill="#D4AF37" />
        <circle cx="26" cy="28" r="2.2" fill="#D4AF37" />
        <circle cx="33" cy="17" r="2.5" fill="#FACC15" />
      </svg>

      {!compact && (
        <div className="min-w-0">
          <div className={`${titleClass} font-display whitespace-nowrap leading-none`}>
            <span className={isLight ? 'text-slate-900' : 'text-[#FACC15]'}>KPI</span>
          </div>
          {showCompany && (
            <div
              className={`text-[11px] font-medium tracking-wide mt-1 whitespace-nowrap truncate ${
                isLight ? 'text-amber-700' : 'text-[#D4AF37]/90'
              }`}
            >
              X Guard (Private) Limited
            </div>
          )}
        </div>
      )}
    </div>
  );
}
