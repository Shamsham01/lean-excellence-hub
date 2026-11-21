import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CaptureSlot } from "./assets";
import { ThemedCapture } from "./themed-capture";

/** The single coded frame every capture sits in (art direction §5.1). */
export function ProductWindow({
  slot,
  priority,
  sizes,
  className,
  style,
  children,
}: {
  slot?: CaptureSlot;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <figure className={cn("v6-window", className)} style={style}>
      <div className="v6-window-chrome" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="v6-window-body">
        {slot ? (
          <ThemedCapture slot={slot} priority={priority} sizes={sizes} />
        ) : null}
        {children}
      </div>
    </figure>
  );
}
