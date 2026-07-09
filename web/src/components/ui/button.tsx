import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-fg hover:bg-[color-mix(in_oklab,var(--color-accent)_88%,black)]",
        secondary:
          "bg-surface text-ink border border-border hover:border-border-strong hover:bg-surface-2",
        ghost: "text-muted hover:text-ink hover:bg-surface-2",
        link: "text-accent underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[8px]",
        md: "h-11 px-4 text-sm rounded-[12px]",
        lg: "h-12 px-5 text-base rounded-[14px]",
        icon: "size-11 rounded-[12px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
