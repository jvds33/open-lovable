import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/utils/cn";

import "./button.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "playground" | "destructive";
  size?: "default" | "large";
  disabled?: boolean;
  loadingLabel?: string;
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      variant = "primary",
      size = "default",
      disabled,
      isLoading = false,
      loadingLabel = "Loading…",
      ...attrs
    },
    ref,
  ) => {
    const isNonInteractive = Boolean(disabled || isLoading);

    // Focus ring - Vercel style
    const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black";

    return (
      <button
        {...attrs}
        ref={ref}
        type={attrs.type ?? "button"}
        aria-disabled={isNonInteractive || undefined}
        aria-busy={isLoading || undefined}
        aria-live={isLoading ? "polite" : undefined}
        data-state={
          isLoading ? "loading" : isNonInteractive ? "disabled" : "idle"
        }
        className={cn(
          attrs.className,
          "flex items-center justify-center button relative [&>*]:relative",
          "text-label-medium lg-max:[&_svg]:size-24",
          `button-${variant} group/button`,
          focusRing,

          // Shared non-interactive styles
          "disabled:cursor-not-allowed",
          isNonInteractive && "cursor-not-allowed",

          // Size
          size === "default" && "rounded-8 px-10 py-6 gap-4",
          size === "large" && "rounded-10 px-12 py-8 gap-6",

          // Vercel-style variants
          variant === "primary" && [
            "bg-black text-white border border-black",
            !isNonInteractive && "hover:bg-gray-900 active:scale-[0.98]",
            "disabled:opacity-60",
          ],

          variant === "secondary" && [
            "bg-white text-black border border-gray-200",
            !isNonInteractive && "hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]",
            "disabled:opacity-60 disabled:text-gray-400",
          ],

          variant === "tertiary" && [
            "bg-transparent text-black",
            !isNonInteractive && "hover:bg-gray-100 active:bg-gray-200",
            "disabled:text-gray-400",
          ],

          variant === "destructive" && [
            "bg-red-600 text-white border border-red-600",
            !isNonInteractive && "hover:bg-red-700 active:scale-[0.98]",
            "disabled:opacity-60",
          ],

          variant === "playground" && [
            "border border-gray-200 bg-transparent text-black",
            !isNonInteractive && "hover:bg-gray-50",
            "disabled:opacity-60 disabled:text-gray-400",
          ],
        )}
        disabled={isNonInteractive}
      >
        {/* loading state (spinner) */}
        {isLoading && (
          <div
            className={cn(
              "w-16 h-16 border-2 rounded-full animate-spin",
              variant === "primary" || variant === "destructive"
                ? "border-white/30 border-t-white"
                : "border-black/30 border-t-black",
            )}
            aria-hidden
          />
        )}

        {/* Screen reader-only loading label */}
        {isLoading && <span className="sr-only">{loadingLabel}</span>}

        {attrs.children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
