import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full items-center justify-center rounded-full border-[3px] border-black text-center text-sm font-bold uppercase leading-tight tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbd3d3] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-black text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        destructive: "bg-red-500 text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        outline: "bg-white text-black shadow-[4px_4px_0_0_#000] hover:bg-pink-100 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        secondary: "bg-[#d53f8c] text-white shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        cyan: "bg-[#22d3ee] text-black shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        yellow: "bg-[#facc15] text-black shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        orange: "bg-[#fb923c] text-black shadow-[4px_4px_0_0_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
        sticker: "bg-white text-black shadow-[4px_4px_0_0_#000] -rotate-1 hover:rotate-0 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000]",
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
