import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CaptureSlot } from "./assets";
import { ThemedCapture } from "./themed-capture";

/**
 * Phone frame (art direction §5.2). Only used as the hero's front layer and
 * in the carousel below 768 px; never alone in a wider slot.
 */
export function Handset({
  slot,
  priority,
  sizes,
  className,
  style,
  children,
}: {
  slot: CaptureSlot;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <figure className={cn("v6-handset", className)} style={style}>
      <div className="v6-handset-screen">
        <ThemedCapture slot={slot} priority={priority} sizes={sizes} />
        {children}
      </div>
    </figure>
  );
}
