"use client";

import { useRef } from "react";

export function useSerializedSetupSave() {
  const queue = useRef(Promise.resolve());

  return function enqueue<T>(task: () => Promise<T>) {
    const run = queue.current.then(task, task);
    queue.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
