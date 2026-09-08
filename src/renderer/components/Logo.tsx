import appIcon from '../assets/icon.png'

interface LogoProps {
  collapsed: boolean
  size?: number
}

export default function Logo({ collapsed, size = 32 }: LogoProps) {
  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center rounded-xl overflow-hidden shadow-xs shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={appIcon}
          alt="Edupilot DZ"
          className="w-full h-full object-contain rounded-xl"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-xl overflow-hidden shadow-xs shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={appIcon}
          alt="Edupilot DZ"
          className="w-full h-full object-contain rounded-xl"
        />
      </div>
      <div className="min-w-0">
        <p className="text-white font-bold text-sm leading-tight">Edupilot</p>
        <p className="text-blue-400 font-semibold text-[10px] leading-tight tracking-wide">DZ</p>
      </div>
    </div>
  )
}
