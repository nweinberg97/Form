"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyText } from "./hooks";

/** A read-only invite link with a Copy button. */
export function CopyLink({ url, label = "Invite link" }: { url: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor={`copy-${url.slice(-10)}`}>
        {label}
      </label>
      <input
        id={`copy-${url.slice(-10)}`}
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
      />
      <Button
        variant="dark"
        icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        onClick={async () => {
          const ok = await copyText(url);
          if (ok) {
            setCopied(true);
            toast("Link copied", "success");
            window.setTimeout(() => setCopied(false), 2000);
          } else {
            toast("Couldn't copy automatically. Select the link and copy it.", "error");
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
