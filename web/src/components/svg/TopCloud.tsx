/**
 * TopCloud — inlines src/assets/svg/topcloud.svg
 * Baked-in 60px Gaussian blur filter preserved.
 */
export function TopCloud({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1881 796"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <g filter="url(#top-filter0)">
        <path
          d="M803 -816C998.148 -816 1174.18 -747.396 1298.64 -637.393C1435.34 -703.118 1596.04 -741 1768 -741C2265.61 -741 2669 -423.794 2669 -32.5C2669 358.794 2265.61 676 1768 676C1428.28 676 1132.47 528.152 978.957 309.818C922.818 322.329 863.838 329 803 329C425.79 329 120 72.683 120 -243.5C120 -559.683 425.79 -816 803 -816Z"
          fill="white"
        />
      </g>
      <defs>
        <filter
          id="top-filter0"
          x="0" y="-936" width="2789" height="1732"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="15" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}
