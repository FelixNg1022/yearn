type BackWindowProps = { instanceId: string; className?: string };

/**
 * BackWindow — arch shape with gradient fill.
 * Inlines src/assets/svg/back-window.svg with namespaced IDs via instanceId.
 */
export function BackWindow({ instanceId: id, className }: BackWindowProps) {
  return (
    <svg
      viewBox="0 0 820 1544"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M68.3333 1544L9.93939 1523.09L0 133.845L396.333 0L820 133.845V1517.71L755.394 1544H68.3333Z"
        fill={`url(#${id}-paint0)`}
      />
      <defs>
        <linearGradient
          id={`${id}-paint0`}
          x1="410" y1="0" x2="410" y2="1544"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFB700" />
          <stop offset="1" stopColor="#FECE00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
