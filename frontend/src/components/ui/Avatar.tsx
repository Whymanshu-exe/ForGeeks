import type { HTMLAttributes } from "react";

type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  initials: string;
  tone?: string;
};

export function Avatar({ initials, tone = "mint", className = "", ...props }: AvatarProps) {
  return (
    <span className={`avatar avatar-${tone} ${className}`} aria-label={initials} {...props}>
      {initials}
    </span>
  );
}
