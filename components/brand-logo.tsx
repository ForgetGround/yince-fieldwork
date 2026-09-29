/** Original YINGCE mark: Y branches become an executable action path. */
export function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="yince-logo"
    >
      <rect width="48" height="48" rx="13" fill="#2563EB" />
      <path
        d="M12 13L24 25L36 13M24 25V36"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 26V35H17M36 26V35H31"
        stroke="#A5C8FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="24"
        cy="25"
        r="3"
        fill="#2563EB"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}
