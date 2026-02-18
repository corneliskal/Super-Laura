/** Clipboard logomark SVG — uses currentColor so it inherits text color */
function ClipboardIcon({ size = 48 }: { size?: number }) {
  const h = size * (250 / 200)
  return (
    <svg viewBox="0 0 200 250" width={size} height={h} stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="30" y="40" width="140" height="185" rx="10" strokeWidth="7" />
      <rect x="68" y="22" width="64" height="35" rx="6" strokeWidth="6" />
      <line x1="80" y1="22" x2="80" y2="15" strokeWidth="5" />
      <line x1="120" y1="22" x2="120" y2="15" strokeWidth="5" />
      <line x1="75" y1="12" x2="125" y2="12" strokeWidth="5" />
      <line x1="55" y1="82" x2="100" y2="82" strokeWidth="5" opacity="0.4" />
      <line x1="55" y1="104" x2="145" y2="104" strokeWidth="5" opacity="0.4" />
      <line x1="55" y1="126" x2="130" y2="126" strokeWidth="5" opacity="0.4" />
      <line x1="55" y1="148" x2="145" y2="148" strokeWidth="5" opacity="0.4" />
      <polyline points="72,175 92,198 132,160" strokeWidth="8" />
    </svg>
  )
}

/** Stacked brand logo — icon + "unieforms" + tagline. For login, home, etc. */
export function BrandLogoStacked({ iconSize = 48, className = '' }: { iconSize?: number; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="text-uf-teal">
        <ClipboardIcon size={iconSize} />
      </div>
      <div className="text-center">
        <div className="text-[34px] font-bold leading-none tracking-[-0.5px] text-uf-slate">
          unieforms
        </div>
        <div className="mt-1 text-[10px] font-normal tracking-[4px] uppercase text-uf-warm-gray">
          your work companion
        </div>
      </div>
    </div>
  )
}

/** Horizontal brand logo — icon + "unieforms". For the header. */
export function BrandLogoHorizontal() {
  return (
    <div className="flex items-center gap-2">
      <ClipboardIcon size={20} />
      <span className="text-lg font-bold tracking-[-0.5px] leading-none">unieforms</span>
    </div>
  )
}
