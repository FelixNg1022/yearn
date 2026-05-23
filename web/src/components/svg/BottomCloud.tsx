/**
 * BottomCloud — inlines src/assets/svg/bottomcloud.svg
 * Baked-in 60px Gaussian blur filter preserved.
 */
export function BottomCloud({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1933 719"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <g filter="url(#bottom-filter0)">
        <path
          d="M177 120C511.933 120 804.181 263.709 959.466 476.989C1013.98 465.245 1071.12 459 1130 459C1507.21 459 1813 715.317 1813 1031.5C1813 1347.68 1507.21 1604 1130 1604C940.139 1604 768.373 1539.06 644.585 1434.24C508.273 1499.45 348.214 1537 177 1537C-320.609 1537 -724 1219.79 -724 828.5C-724 437.206 -320.609 120 177 120Z"
          fill="white"
        />
      </g>
      <defs>
        <filter
          id="bottom-filter0"
          x="-844" y="0" width="2777" height="1724"
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
