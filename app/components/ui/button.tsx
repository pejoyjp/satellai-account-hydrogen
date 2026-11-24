import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Link } from "react-router";
import { cn } from "~/utils/cn";

export const buttonVariants = cva(
  "relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-button border-0 text-center no-underline transition-colors duration-700 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:not-aria-busy:bg-disabled-background disabled:not-aria-busy:hover:bg-disabled-background disabled:not-aria-busy:bg-none disabled:not-aria-busy:text-disabled-text disabled:before:hidden motion-reduce:transition-none before:pointer-events-none before:absolute before:inset-0 before:origin-right before:scale-x-0 before:transition-transform before:duration-700 before:ease-out motion-reduce:before:transition-none",
  {
    variants: {
      variant: {
        primary:
          "bg-button-primary bg-(image:--gradient-button-primary) text-button-primary-text before:bg-button-primary hover:before:scale-x-100",
        preorder:
          "bg-brand-orange bg-(image:--gradient-button-preorder) text-button-primary-text before:bg-brand-orange hover:before:scale-x-100",
        secondary:
          "bg-button-secondary text-button-secondary-text hover:bg-button-secondary/85",
        light: "bg-surface text-accent hover:bg-surface-secondary",
        ghost: "bg-transparent text-on-surface hover:bg-surface-secondary",
        outline:
          "border border-button-outline-border bg-transparent text-button-outline-text hover:bg-hover",
      },
      size: {
        sm: "typo-button-sm h-button-sm px-button-padding-sm py-0",
        default: "typo-button-md h-button-md px-button-padding-md py-0",
        md: "typo-button-md h-button-md px-button-padding-md py-0",
        lg: "typo-button-lg h-button-lg px-button-padding-lg py-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);
export type ButtonStyleProps = VariantProps<typeof buttonVariants>;
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleProps;

export function Button({
  variant,
  size,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
} & ButtonStyleProps) {
  const style = cn(buttonVariants({ variant, size }), className);
  const content = (
    <span className="relative z-10 inline-flex items-center justify-center gap-2">
      {children}
    </span>
  );
  return href.startsWith("/") && !href.startsWith("//") ? (
    <Link to={href} className={style} {...props}>
      {content}
    </Link>
  ) : (
    <a href={href} className={style} {...props}>
      {content}
    </a>
  );
}
