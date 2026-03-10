'use client'

/**
 * Decorative SVG elements for the pricing section: dashed borders and gradient
 * backgrounds. Keeps visual styling isolated from card layout logic.
 */

/** Shared line props for dashed strokes matching strokeDasharray 4 6. */
const dashedLineProps = {
  strokeWidth: 1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeOpacity: 0.12,
  strokeDasharray: '4 6',
  vectorEffect: 'non-scaling-stroke' as const,
  className: 'stroke-foreground-strong',
}

/**
 * Dashed border for individual pricing cards. Uses SVG lines instead of
 * CSS border-dashed for consistent 4 6 spacing.
 */
export function CardDashedBorder() {
  return (
    <>
      {/* Top */}
      <div className="absolute inset-x-0 top-0 flex w-full justify-center">
        <svg
          width="100%"
          height="1"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="inline-block h-auto w-full"
        >
          <line x1="0" y1="0.5" x2="100%" y2="0.5" {...dashedLineProps} />
        </svg>
      </div>
      {/* Right */}
      <div className="absolute inset-y-0 right-0 flex h-full items-center justify-center">
        <svg
          width="1"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="inline-block h-full max-w-full"
        >
          <line x1="0.5" y1="0" x2="0.5" y2="100%" {...dashedLineProps} />
        </svg>
      </div>
      {/* Bottom */}
      <div className="absolute inset-x-0 bottom-0 flex w-full justify-center">
        <svg
          width="100%"
          height="1"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="inline-block h-auto w-full"
        >
          <line x1="0" y1="0.5" x2="100%" y2="0.5" {...dashedLineProps} />
        </svg>
      </div>
      {/* Left */}
      <div className="absolute inset-y-0 left-0 flex h-full items-center justify-center">
        <svg
          width="1"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="inline-block h-full max-w-full"
        >
          <line x1="0.5" y1="0" x2="0.5" y2="100%" {...dashedLineProps} />
        </svg>
      </div>
    </>
  )
}

/**
 * Horizontal dashed line for container borders.
 */
function DashedLineHorizontal({ className }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="1"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className={className}
    >
      <line x1="0" y1="0.5" x2="100%" y2="0.5" {...dashedLineProps} />
    </svg>
  )
}

/**
 * Vertical dashed line for container borders.
 */
function DashedLineVertical({ className }: { className?: string }) {
  return (
    <svg
      width="1"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className={className}
    >
      <line x1="0.5" y1="0" x2="0.5" y2="100%" {...dashedLineProps} />
    </svg>
  )
}

/**
 * Frame with dashed borders around the pricing card grid. Renders top, left,
 * right, and bottom SVG lines with responsive positioning.
 */
export function DashedBorderFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Top border */}
      <div className="max-lg:top-3.5 absolute inset-x-0 top-12 flex w-full items-center justify-center">
        <DashedLineHorizontal className="inline-block h-auto w-full will-change-transform max-w-[1400px]" />
      </div>
      {/* Left border */}
      <div className="max-lg:left-3.5 absolute inset-y-0 left-12 flex h-full items-center justify-center">
        <DashedLineVertical className="inline-block h-full max-w-full will-change-transform" />
      </div>
      {/* Right border */}
      <div className="max-lg:top-0 max-lg:right-4 max-lg:bottom-auto max-lg:z-[11] absolute inset-y-0 right-12 flex h-full items-center justify-center">
        <DashedLineVertical className="inline-block h-full max-w-full will-change-transform" />
      </div>
      {/* Bottom border */}
      <div className="max-lg:bottom-3.5 absolute inset-x-0 bottom-12 flex w-full items-center justify-center">
        <DashedLineHorizontal className="inline-block h-auto w-full will-change-transform max-w-[1400px]" />
      </div>
      {children}
    </>
  )
}

/**
 * Gradient SVG background for pricing cards. Each plan uses a gradientId
 * to select a unique color palette (e.g. blue/orange/green for main plans,
 * purple for Enterprise, teal for Self-hosting).
 */
export function GradientBackground({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  /**
   * Dark-mode gradients keep the existing subtle glow profile so the colors
   * bloom against dark surfaces without overpowering card content.
   */
  const darkGradients: Record<string, React.ReactNode> = {
    '1': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_sec_1)" />
        <rect width="300" height="300" fill="url(#paint1_radial_sec_1)" />
        <rect width="300" height="300" fill="url(#paint2_radial_sec_1)" />
        <rect width="300" height="300" fill="url(#paint3_radial_sec_1)" />
        <defs>
          <radialGradient
            id="paint0_radial_sec_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(117 300) rotate(-90) scale(181)"
          >
            <stop stopColor="#5767C2" stopOpacity="0.1" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_sec_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)"
          >
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_sec_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(331 243.5) rotate(-180) scale(208)"
          >
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_sec_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-94 71) scale(150)"
          >
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '2': (
      <>
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint0_radial_sec_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint1_radial_sec_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint2_radial_sec_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint3_radial_sec_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint4_radial_sec_2)"
        />
        <defs>
          <radialGradient
            id="paint0_radial_sec_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)"
          >
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_sec_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(38.6107) scale(273.226)"
          >
            <stop stopColor="#2CC256" stopOpacity="0.1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_sec_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)"
          >
            <stop stopColor="#FAC507" stopOpacity="0.1" />
            <stop offset="1" stopColor="#FAC507" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_sec_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-50 242.5) scale(147.5)"
          >
            <stop stopColor="#CD81F3" stopOpacity="0.07" />
            <stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint4_radial_sec_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)"
          >
            <stop stopColor="#FF6D2E" stopOpacity="0.07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '3': (
      <>
        <path fill="url(#a_sec_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#b_sec_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#c_sec_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#d_sec_3)" d="M0 300h300V0H0v300Z" />
        <defs>
          <radialGradient
            id="a_sec_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(0 181 -181 0 183 0)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5767C2" stopOpacity=".1" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="b_sec_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(101 220.5) scale(142.5)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF6D2E" stopOpacity=".07" />
            <stop offset="1" stopColor="#FF6D2E" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="c_sec_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(208 0 0 208 -31 56.5)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#2CC256" stopOpacity=".1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="d_sec_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(-150 0 0 -150 394 229)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#2CC256" stopOpacity=".1" />
            <stop offset="1" stopColor="#2CC256" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '4': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_sec_4)" />
        <rect width="300" height="300" fill="url(#paint1_radial_sec_4)" />
        <rect width="300" height="300" fill="url(#paint2_radial_sec_4)" />
        <rect width="300" height="300" fill="url(#paint3_radial_sec_4)" />
        <defs>
          <radialGradient
            id="paint0_radial_sec_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(154 286) rotate(-90) scale(178)"
          >
            <stop stopColor="#CD81F3" stopOpacity="0.12" />
            <stop offset="1" stopColor="#CD81F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_sec_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(212 74) rotate(-180) scale(138)"
          >
            <stop stopColor="#5767C2" stopOpacity="0.08" />
            <stop offset="1" stopColor="#5767C2" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_sec_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(327 232) rotate(-176) scale(194)"
          >
            <stop stopColor="#14B8A6" stopOpacity="0.1" />
            <stop offset="1" stopColor="#14B8A6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_sec_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-28 92) scale(146)"
          >
            <stop stopColor="#FF8A3D" stopOpacity="0.08" />
            <stop offset="1" stopColor="#FF8A3D" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    /** Enterprise - deep purple / indigo */
    '5': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_sec_5)" />
        <rect width="300" height="300" fill="url(#paint1_radial_sec_5)" />
        <rect width="300" height="300" fill="url(#paint2_radial_sec_5)" />
        <rect width="300" height="300" fill="url(#paint3_radial_sec_5)" />
        <defs>
          <radialGradient
            id="paint0_radial_sec_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(150 294) rotate(-90) scale(182)"
          >
            <stop stopColor="#6366F1" stopOpacity="0.14" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_sec_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(208 68) rotate(-180) scale(148)"
          >
            <stop stopColor="#8B5CF6" stopOpacity="0.1" />
            <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_sec_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(328 232) rotate(-180) scale(196)"
          >
            <stop stopColor="#3B82F6" stopOpacity="0.09" />
            <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_sec_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-42 86) scale(152)"
          >
            <stop stopColor="#C084FC" stopOpacity="0.09" />
            <stop offset="1" stopColor="#C084FC" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    /** Self-hosting - teal / emerald */
    '6': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_sec_6)" />
        <rect width="300" height="300" fill="url(#paint1_radial_sec_6)" />
        <rect width="300" height="300" fill="url(#paint2_radial_sec_6)" />
        <rect width="300" height="300" fill="url(#paint3_radial_sec_6)" />
        <defs>
          <radialGradient
            id="paint0_radial_sec_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(146 294) rotate(-90) scale(180)"
          >
            <stop stopColor="#14B8A6" stopOpacity="0.12" />
            <stop offset="1" stopColor="#14B8A6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_sec_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(214 72) rotate(-180) scale(142)"
          >
            <stop stopColor="#10B981" stopOpacity="0.1" />
            <stop offset="1" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_sec_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(326 226) rotate(-178) scale(192)"
          >
            <stop stopColor="#22C55E" stopOpacity="0.1" />
            <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_sec_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-34 88) scale(148)"
          >
            <stop stopColor="#38BDF8" stopOpacity="0.08" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
  }

  /**
   * Light-mode gradients use deeper hues and stronger opacity stops so the
   * decorative orb remains visible against the near-white card background.
   */
  const lightGradients: Record<string, React.ReactNode> = {
    '1': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_light_1)" />
        <rect width="300" height="300" fill="url(#paint1_radial_light_1)" />
        <rect width="300" height="300" fill="url(#paint2_radial_light_1)" />
        <rect width="300" height="300" fill="url(#paint3_radial_light_1)" />
        <defs>
          <radialGradient
            id="paint0_radial_light_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(117 300) rotate(-90) scale(181)"
          >
            <stop stopColor="#3655D6" stopOpacity="0.22" />
            <stop offset="1" stopColor="#3655D6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_light_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(199 79.5) rotate(-180) scale(142.5)"
          >
            <stop stopColor="#FF7A1A" stopOpacity="0.18" />
            <stop offset="1" stopColor="#FF7A1A" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_light_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(331 243.5) rotate(-180) scale(208)"
          >
            <stop stopColor="#1EA44F" stopOpacity="0.2" />
            <stop offset="1" stopColor="#1EA44F" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_light_1"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-94 71) scale(150)"
          >
            <stop stopColor="#34B263" stopOpacity="0.16" />
            <stop offset="1" stopColor="#34B263" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '2': (
      <>
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint0_radial_light_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint1_radial_light_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint2_radial_light_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint3_radial_light_2)"
        />
        <rect
          width="300"
          height="300"
          transform="matrix(-1 8.74228e-08 8.74228e-08 1 300 0)"
          fill="url(#paint4_radial_light_2)"
        />
        <defs>
          <radialGradient
            id="paint0_radial_light_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(300 243.5) rotate(-155.81) scale(205)"
          >
            <stop stopColor="#22A454" stopOpacity="0.2" />
            <stop offset="1" stopColor="#22A454" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_light_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(38.6107) scale(273.226)"
          >
            <stop stopColor="#30BB68" stopOpacity="0.18" />
            <stop offset="1" stopColor="#30BB68" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_light_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(103 383) rotate(-89.3415) scale(174.011)"
          >
            <stop stopColor="#D69E00" stopOpacity="0.18" />
            <stop offset="1" stopColor="#D69E00" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_light_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-50 242.5) scale(147.5)"
          >
            <stop stopColor="#9257D8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#9257D8" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint4_radial_light_2"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(425.5 62) rotate(-178.961) scale(193.032)"
          >
            <stop stopColor="#F26A21" stopOpacity="0.18" />
            <stop offset="1" stopColor="#F26A21" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '3': (
      <>
        <path fill="url(#a_light_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#b_light_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#c_light_3)" d="M0 300h300V0H0v300Z" />
        <path fill="url(#d_light_3)" d="M0 300h300V0H0v300Z" />
        <defs>
          <radialGradient
            id="a_light_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(0 181 -181 0 183 0)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3655D6" stopOpacity=".2" />
            <stop offset="1" stopColor="#3655D6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="b_light_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(101 220.5) scale(142.5)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF7A1A" stopOpacity=".18" />
            <stop offset="1" stopColor="#FF7A1A" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="c_light_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(208 0 0 208 -31 56.5)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1EA44F" stopOpacity=".22" />
            <stop offset="1" stopColor="#1EA44F" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="d_light_3"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(-150 0 0 -150 394 229)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#34B263" stopOpacity=".16" />
            <stop offset="1" stopColor="#34B263" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '4': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_light_4)" />
        <rect width="300" height="300" fill="url(#paint1_radial_light_4)" />
        <rect width="300" height="300" fill="url(#paint2_radial_light_4)" />
        <rect width="300" height="300" fill="url(#paint3_radial_light_4)" />
        <defs>
          <radialGradient
            id="paint0_radial_light_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(154 286) rotate(-90) scale(178)"
          >
            <stop stopColor="#B65AE8" stopOpacity="0.22" />
            <stop offset="1" stopColor="#B65AE8" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_light_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(212 74) rotate(-180) scale(138)"
          >
            <stop stopColor="#3655D6" stopOpacity="0.18" />
            <stop offset="1" stopColor="#3655D6" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_light_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(327 232) rotate(-176) scale(194)"
          >
            <stop stopColor="#119F90" stopOpacity="0.18" />
            <stop offset="1" stopColor="#119F90" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_light_4"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-28 92) scale(146)"
          >
            <stop stopColor="#F27A2A" stopOpacity="0.16" />
            <stop offset="1" stopColor="#F27A2A" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '5': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_light_5)" />
        <rect width="300" height="300" fill="url(#paint1_radial_light_5)" />
        <rect width="300" height="300" fill="url(#paint2_radial_light_5)" />
        <rect width="300" height="300" fill="url(#paint3_radial_light_5)" />
        <defs>
          <radialGradient
            id="paint0_radial_light_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(150 294) rotate(-90) scale(182)"
          >
            <stop stopColor="#4F46E5" stopOpacity="0.24" />
            <stop offset="1" stopColor="#4F46E5" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_light_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(208 68) rotate(-180) scale(148)"
          >
            <stop stopColor="#7C3AED" stopOpacity="0.2" />
            <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_light_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(328 232) rotate(-180) scale(196)"
          >
            <stop stopColor="#2563EB" stopOpacity="0.15" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_light_5"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-42 86) scale(152)"
          >
            <stop stopColor="#A855F7" stopOpacity="0.16" />
            <stop offset="1" stopColor="#A855F7" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
    '6': (
      <>
        <rect width="300" height="300" fill="url(#paint0_radial_light_6)" />
        <rect width="300" height="300" fill="url(#paint1_radial_light_6)" />
        <rect width="300" height="300" fill="url(#paint2_radial_light_6)" />
        <rect width="300" height="300" fill="url(#paint3_radial_light_6)" />
        <defs>
          <radialGradient
            id="paint0_radial_light_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(146 294) rotate(-90) scale(180)"
          >
            <stop stopColor="#0D9488" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0D9488" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint1_radial_light_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(214 72) rotate(-180) scale(142)"
          >
            <stop stopColor="#059669" stopOpacity="0.18" />
            <stop offset="1" stopColor="#059669" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint2_radial_light_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(326 226) rotate(-178) scale(192)"
          >
            <stop stopColor="#16A34A" stopOpacity="0.18" />
            <stop offset="1" stopColor="#16A34A" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="paint3_radial_light_6"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-34 88) scale(148)"
          >
            <stop stopColor="#0284C7" stopOpacity="0.14" />
            <stop offset="1" stopColor="#0284C7" stopOpacity="0" />
          </radialGradient>
        </defs>
      </>
    ),
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[-1]">
      <svg
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className={`inline-block h-full w-full will-change-transform dark:hidden ${className ?? ''}`}
      >
        {lightGradients[id] ?? null}
      </svg>
      <svg
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className={`hidden h-full w-full will-change-transform dark:inline-block ${className ?? ''}`}
      >
        {darkGradients[id] ?? null}
      </svg>
    </div>
  )
}
