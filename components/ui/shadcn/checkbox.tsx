import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/utils/cn";

export default function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <button
      className="size-20 p-3 relative"
      type="button"
      onClick={() => onChange?.(!checked)}
    >
      <div
        className={cn(
          "w-full h-full rounded-3 relative transition-all border",
          checked
            ? "bg-black border-black hover:bg-gray-900"
            : "bg-gray-100 border-gray-300 hover:bg-gray-200 hover:border-gray-400",
        )}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute cs-10"
              exit={{ opacity: 0, scale: 0.9, y: 4 }}
              fill="none"
              height="10"
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              viewBox="0 0 10 10"
              width="10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 5.98438L4.39062 8.375L8.375 2"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.25"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}
