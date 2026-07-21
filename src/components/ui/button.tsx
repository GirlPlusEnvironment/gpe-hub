import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full items-center justify-center rounded-full border-[3px] border-black text-center text-sm font-bold uppercase leading-tight tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbd3d3] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-black text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000]",
        destructive: "bg-red-500 text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000]",
        outline: "bg-white text-black shadow-[4px_4px_0_0_#000] hover:bg-pink-100 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000]",
        secondary: "bg-[#d53f8c] text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000]",
        ghost: "border-transparent bg-transparent text-black shadow-none hover:border-black hover:bg-white",
        link: "border-transparent bg-transparent px-0 py-0 text-black underline underline-offset-4 shadow-none hover:text-[#d53f8c]",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 px-4 py-2 text-xs",
        lg: "h-14 px-8 py-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
