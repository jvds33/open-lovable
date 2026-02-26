import { forwardRef } from "react";
import { cn } from "@/utils/cn";

const Input = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input">
>(({ className, ...props }, ref) => {
  return (
    <label
      className={cn(
        "py-8 px-12 rounded-8 transition-all w-full block gap-4 cursor-text",
        "relative bg-white border border-gray-300",
        "hover:border-gray-400 hover:bg-gray-50 focus-within:!bg-white focus-within:!border-black focus-within:ring-2 focus-within:ring-black/10",
        "text-body-medium",
        className,
      )}
    >
      <input
        ref={ref}
        className="outline-none w-full resize-none bg-transparent"
        {...props}
      />
    </label>
  );
});

Input.displayName = "Input";

export default Input;
