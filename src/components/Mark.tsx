import { cx } from "@/lib/cx";

export function Mark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cx("mark", className)}
    >
      <rect width="32" height="32" rx="8" fill="#0B0B0C" />
      <rect x="7" y="7" width="18" height="5" rx="1.2" fill="#ECEAE6" />
      <rect x="9" y="13.5" width="18" height="5" rx="1.2" fill="#C9C3B8" />
      <rect x="5" y="20" width="18" height="5" rx="1.2" fill="#8A9096" />
      <rect x="22.5" y="21.2" width="3.2" height="2.6" rx="0.6" fill="#C46A3A" />
    </svg>
  );
}
