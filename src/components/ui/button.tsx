import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 py-2 text-sm font-semibold tracking-[-0.02em] text-[color:var(--text-main)] transition-[background-color,border-color,color,transform,opacity] duration-200 outline-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "hover:bg-[color:var(--surface-elevated)] hover:border-[color:var(--text-dim)] active:scale-[0.985]",
        icon: "h-12 w-12 rounded-[16px] p-0 hover:bg-[color:var(--surface-elevated)]",
        ghost:
          "border-transparent bg-transparent shadow-none hover:border-[color:var(--line-soft)] hover:bg-[color:rgba(255,255,255,0.04)]"
      },
      size: {
        default: "h-12 min-w-72",
        compact: "h-11 min-w-56",
        icon: "h-12 w-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);


export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function containsLucide(children: React.ReactNode): boolean {
  let found = false;

  function walk(node: React.ReactNode) {
    React.Children.forEach(node, (child) => {
      if (found) return;
      if (!React.isValidElement(child)) return;

      // If rendered element is an actual svg element
      if (typeof child.type === "string" && child.type === "svg") {
        found = true;
        return;
      }

      // If the child has a className containing "lucide" (common for lucide icons)
      const childProps = child.props as { className?: unknown; children?: React.ReactNode };
      if (typeof childProps.className === "string" && childProps.className.includes("lucide")) {
        found = true;
        return;
      }

      // Recurse into children
      if (childProps.children) {
        walk(childProps.children);
      }
    });
  }

  walk(children);
  return found;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, children, ...props }, ref) => {
    const hasLucide = containsLucide(children);

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), hasLucide ? "has-lucide" : "")}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
