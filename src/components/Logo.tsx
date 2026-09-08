interface LogoProps {
  collapsed?: boolean
  size?: number
}

export default function Logo({ collapsed = false, size = 32 }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Shield outline */}
        <path
          d="M16 2L4 7v9c0 6.6 5.1 12.8 12 14.3C22.9 28.8 28 22.6 28 16V7L16 2z"
          fill="#2563EB"
          stroke="#1D4ED8"
          strokeWidth="0.5"
        />
        {/* Book pages (left) */}
        <path d="M16 8C14 8 10 9 10 13v10c2-1 4-1.5 6-1.5V8z" fill="white" opacity="0.25" />
        {/* Book pages (right) */}
        <path d="M16 8c2 0 6 1 6 5v10c-2-1-4-1.5-6-1.5V8z" fill="white" opacity="0.18" />
        {/* Spine */}
        <rect x="15.25" y="8" width="1.5" height="13" fill="white" opacity="0.5" rx="0.75" />
        {/* Checkmark */}
        <path d="M10.5 16.5l3.5 3.5 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* QR squares top-right */}
        <rect x="22" y="5" width="2.5" height="2.5" rx="0.5" fill="#14B8A6" />
        <rect x="25" y="5" width="1.5" height="1.5" rx="0.3" fill="#14B8A6" opacity="0.7" />
        <rect x="22" y="8" width="1.5" height="1.5" rx="0.3" fill="#14B8A6" opacity="0.7" />
      </svg>
      {!collapsed && (
        <span className="font-bold text-[#0F172A] tracking-tight leading-none" style={{ fontSize: 16 }}>
          Edupilot <span className="text-[#2563EB]">DZ</span>
        </span>
      )}
    </div>
  )
}
