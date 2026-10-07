"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/field";

/** Password field with a show/hide toggle. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        {visible ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
      </button>
    </div>
  );
}
