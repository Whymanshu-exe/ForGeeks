import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "button focus-visible:ring-2 focus-visible:ring-[#16a36a]/30",
  {
    variants: {
      variant: {
        primary: "button-primary",
        secondary: "button-secondary",
        ghost: "button-ghost",
      },
      size: {
        default: "",
        sm: "button-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
