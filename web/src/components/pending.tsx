"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Submit button with automatic pending feedback: while its parent form's
 *  server action runs, it disables itself and shows a spinner. */
export function SubmitButton({
  children,
  className = "",
  title,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={disabled || pending}
      className={`${className} relative transition disabled:cursor-not-allowed ${
        pending ? "opacity-70" : ""
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 ${pending ? "invisible" : ""}`}>
        {children}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" />
        </span>
      )}
    </button>
  );
}
