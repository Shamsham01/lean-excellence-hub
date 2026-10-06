"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  clampProgress,
  easeInOutCubic,
  easeKnock,
  easeOutCubic,
  lerp,
  mapRange,
  sceneProgress,
} from "./math";

type ProgressListener = (progress: number) => void;

type KineticContextValue = {
  subscribe: (sceneId: string, listener: ProgressListener) => () => void;
};

const KineticContext = createContext<KineticContextValue | null>(null);
const SceneRefContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

const LEAN_SEES = [
  "Organisation",
  "Site",
  "Current workflow",
  "Relevant framework",
] as const;

const LEAN_RECOMMENDATION =
  "Link the Gemba finding to an owned action before the next walk.";

type SceneCache = {
  centers: number[];
  shiftMax: number;
  viewport: number;
  leanKey: string;
  focus: number;
  dirty: boolean;
};

function mediaQuery(query: string) {
  if (typeof window.matchMedia !== "function") {
    return {
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  }

  return window.matchMedia(query);
}

function prefersReducedMotion() {
  return mediaQuery("(prefers-reduced-motion: reduce)").matches;
}

function isNarrow() {
  return mediaQuery("(max-width: 767px)").matches;
}

function readScenes(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("[data-kinetic]")];
}

function measurePlatform(el: HTMLElement, cache: SceneCache) {
  const viewport = el.querySelector<HTMLElement>("[data-kinetic-viewport]");
  const track = el.querySelector<HTMLElement>("[data-kinetic-track]");
  const slides = [...el.querySelectorAll<HTMLElement>("[data-kinetic-slide]")];

  if (!viewport || !track || slides.length === 0 || isNarrow()) {
    cache.centers = [];
    cache.shiftMax = 0;
    cache.viewport = viewport?.clientWidth ?? 0;
    cache.dirty = false;
    return;
  }

  const previous = track.style.transform;
  track.style.transform = "none";
  const origin = track.getBoundingClientRect().left;
  cache.viewport = viewport.clientWidth;
  cache.centers = slides.map((slide) => {
    const box = slide.getBoundingClientRect();
    return box.left - origin + box.width / 2;
  });
  cache.shiftMax = Math.max(0, track.scrollWidth - viewport.clientWidth);
  track.style.transform = previous;
  cache.dirty = false;
}

function applyPlatformShift(
  el: HTMLElement,
  progress: number,
  cache: SceneCache,
) {
  if (cache.dirty) {
    measurePlatform(el, cache);
  }

  if (cache.centers.length === 0) {
    el.style.setProperty("--shift", "0");
    return;
  }

  const span = cache.centers.length - 1;
  const cursor = progress * span;
  const index = Math.min(span, Math.floor(cursor));
  const next = Math.min(span, index + 1);
  const center = lerp(
    cache.centers[index] ?? 0,
    cache.centers[next] ?? 0,
    cursor - index,
  );
  const shift = clampProgress(
    center - cache.viewport / 2,
    0,
    Math.max(cache.shiftMax, 0),
  );
  el.style.setProperty("--shift", shift.toFixed(2));

  const focus = Math.round(cursor);

  if (focus !== cache.focus) {
    cache.focus = focus;
    const slides = el.querySelectorAll<HTMLElement>("[data-kinetic-slide]");
    slides.forEach((slide, slideIndex) => {
      slide.dataset.focus = slideIndex === focus ? "true" : "false";
    });
  }
}

function applyLeanAi(el: HTMLElement, progress: number, cache: SceneCache) {
  const context = el.querySelector<HTMLElement>("[data-leanai-context]");
  const recommend = el.querySelector<HTMLElement>("[data-leanai-recommend]");
  const reject = el.querySelector<HTMLElement>("[data-leanai-reject]");
  const authority = el.querySelector<HTMLElement>("[data-leanai-authority]");

  if (!context || !recommend || !reject || !authority) {
    return;
  }

  const count = Math.round(mapRange(progress, 0.08, 0.4) * LEAN_SEES.length);
  const seen = LEAN_SEES.slice(0, count).join("\n");
  const characters = Math.round(
    mapRange(progress, 0.44, 0.64) * LEAN_RECOMMENDATION.length,
  );
  const typed = LEAN_RECOMMENDATION.slice(0, characters);
  const showReject =
    mapRange(progress, 0.66, 0.72) > 0 && mapRange(progress, 0.8, 0.88) < 1;
  const struck = mapRange(progress, 0.74, 0.8) > 0.45;
  const decision =
    progress >= 0.84 ? "A person reviews.\nA person decides." : "";
  const key = `${seen}|${typed}|${showReject}|${struck}|${decision}`;

  if (key === cache.leanKey) {
    return;
  }

  cache.leanKey = key;
  context.textContent = seen;
  recommend.textContent = typed;
  reject.textContent = showReject ? "Decide for you" : "";
  reject.classList.toggle("is-struck", showReject && struck);
  authority.textContent = decision;
  recommend.dataset.typing =
    characters < LEAN_RECOMMENDATION.length && progress < 0.66
      ? "true"
      : "false";
}

function applyScene(el: HTMLElement, progress: number, cache: SceneCache) {
  const kind = el.dataset.kinetic;
  el.style.setProperty("--p", progress.toFixed(4));

  switch (kind) {
    case "hero":
      el.style.setProperty(
        "--lock",
        easeOutCubic(mapRange(progress, 0, 0.46)).toFixed(4),
      );
      break;
    case "fragments":
      el.style.setProperty(
        "--scatter",
        easeOutCubic(mapRange(progress, 0.06, 0.5)).toFixed(4),
      );
      el.style.setProperty(
        "--resolve",
        easeInOutCubic(mapRange(progress, 0.54, 0.84)).toFixed(4),
      );
      break;
    case "loop":
      [0.04, 0.2, 0.36, 0.52, 0.68].forEach((start, index) => {
        el.style.setProperty(
          `--s${index}`,
          easeKnock(mapRange(progress, start, start + 0.16)).toFixed(4),
        );
      });
      el.style.setProperty(
        "--forward",
        easeInOutCubic(mapRange(progress, 0.08, 0.78)).toFixed(4),
      );
      el.style.setProperty(
        "--loopback",
        easeInOutCubic(mapRange(progress, 0.8, 0.98)).toFixed(4),
      );
      break;
    case "platform":
      applyPlatformShift(el, progress, cache);
      break;
    case "leanai":
      el.style.setProperty("--v1", mapRange(progress, 0.1, 0.22).toFixed(4));
      el.style.setProperty("--v2", mapRange(progress, 0.22, 0.36).toFixed(4));
      el.style.setProperty("--v3", mapRange(progress, 0.4, 0.58).toFixed(4));
      el.style.setProperty("--v4", mapRange(progress, 0.82, 0.96).toFixed(4));
      applyLeanAi(el, progress, cache);
      break;
    case "close": {
      const field = easeInOutCubic(mapRange(progress, 0.22, 0.46));
      const release = easeInOutCubic(mapRange(progress, 0.74, 0.92));
      el.style.setProperty(
        "--assemble",
        easeOutCubic(mapRange(progress, 0.04, 0.36)).toFixed(4),
      );
      el.style.setProperty("--field", field.toFixed(4));
      el.style.setProperty("--release", release.toFixed(4));
      el.style.setProperty("--wash", (field * (1 - release)).toFixed(4));
      el.style.setProperty(
        "--statement",
        easeOutCubic(mapRange(progress, 0.48, 0.7)).toFixed(4),
      );
      break;
    }
    default:
      break;
  }
}

function syncRail(
  root: HTMLElement,
  rects: Map<string, DOMRect>,
  viewport: number,
) {
  const links = [...root.querySelectorAll<HTMLElement>("[data-scene-link]")];
  const marker = Math.min(viewport * 0.42, 320);
  let currentId = links[0]?.dataset.sceneLink ?? "";

  for (const link of links) {
    const id = link.dataset.sceneLink ?? "";
    const rect = rects.get(id);

    if (!rect) {
      continue;
    }

    if (rect.top <= marker && rect.bottom > marker) {
      currentId = id;
    }
  }

  for (const link of links) {
    const id = link.dataset.sceneLink ?? "";
    const rect = rects.get(id);
    const active = id === currentId;
    const nextCurrent = active ? "true" : "false";

    if (link.dataset.current !== nextCurrent) {
      link.dataset.current = nextCurrent;
      link.setAttribute("aria-current", active ? "true" : "false");
    }

    if (!rect) {
      continue;
    }

    const progress = sceneProgress(rect.top, rect.height, viewport);
    const fill = rect.bottom <= marker ? 1 : active ? progress : 0;
    link.style.setProperty("--fill", fill.toFixed(4));
  }

  const current = root.querySelector<HTMLElement>(`#${currentId}`);
  root.dataset.railTone = current?.dataset.tone ?? "paper";
}

function alignModuleHash(root: HTMLElement) {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));

  if (!id || isNarrow() || prefersReducedMotion()) {
    return;
  }

  const scene = root.querySelector<HTMLElement>("#platform");
  const slides = [...root.querySelectorAll<HTMLElement>("[data-module-id]")];
  const index = slides.findIndex((slide) => slide.dataset.moduleId === id);

  if (!scene || index < 0 || slides.length < 2) {
    return;
  }

  const top = window.scrollY + scene.getBoundingClientRect().top;
  const scrollable = scene.offsetHeight - window.innerHeight;
  const target = top + scrollable * (index / (slides.length - 1));
  window.scrollTo({ top: target, behavior: "auto" });
}

export function useSceneProgress(sceneId: string) {
  const kinetic = useContext(KineticContext);
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    if (!kinetic) {
      return;
    }

    return kinetic.subscribe(sceneId, (next) => {
      setProgress((current) =>
        Math.abs(current - next) < 0.012 ? current : next,
      );
    });
  }, [kinetic, sceneId]);

  return progress;
}

export function KineticScene({
  id,
  kinetic,
  tone,
  length,
  lengthSm,
  children,
}: {
  id: string;
  kinetic: string;
  tone: "paper" | "ink";
  length: number;
  lengthSm: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  return (
    <SceneRefContext.Provider value={ref}>
      <section
        ref={ref}
        id={id}
        className="kinetic-scene"
        data-kinetic={kinetic}
        data-tone={tone}
        style={{
          ["--len" as string]: String(length),
          ["--len-sm" as string]: String(lengthSm),
        }}
        aria-labelledby={`${id}-title`}
      >
        {children}
      </section>
    </SceneRefContext.Provider>
  );
}

export function KineticRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listeners = useRef(new Map<string, Set<ProgressListener>>());

  const context = useMemo<KineticContextValue>(
    () => ({
      subscribe(sceneId, listener) {
        const set = listeners.current.get(sceneId) ?? new Set();
        set.add(listener);
        listeners.current.set(sceneId, set);
        return () => {
          set.delete(listener);
        };
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const motion = mediaQuery("(prefers-reduced-motion: reduce)");
    const narrow = mediaQuery("(max-width: 767px)");
    const caches = new Map<HTMLElement, SceneCache>();
    let frame = 0;
    let idle = 0;

    const ensureCache = (el: HTMLElement) => {
      const existing = caches.get(el);

      if (existing) {
        return existing;
      }

      const cache: SceneCache = {
        centers: [],
        shiftMax: 0,
        viewport: 0,
        leanKey: "",
        focus: -1,
        dirty: true,
      };
      caches.set(el, cache);
      return cache;
    };

    const publish = (el: HTMLElement, progress: number) => {
      const set = listeners.current.get(el.id);

      if (!set) {
        return;
      }

      for (const listener of set) {
        listener(progress);
      }
    };

    const update = () => {
      const reduced = motion.matches;
      root.dataset.reduced = reduced ? "true" : "false";
      root.dataset.motion = reduced ? "off" : "on";
      const viewport = window.innerHeight;
      const scenes = readScenes(root);
      const rects = new Map<string, DOMRect>();

      for (const el of scenes) {
        rects.set(el.id, el.getBoundingClientRect());
      }

      for (const el of scenes) {
        const rect = rects.get(el.id);

        if (!rect) {
          continue;
        }

        const progress = sceneProgress(rect.top, rect.height, viewport);

        if (!reduced) {
          applyScene(el, progress, ensureCache(el));
        }

        publish(el, progress);
      }

      syncRail(root, rects, viewport);
    };

    const tick = () => {
      update();
      idle += 1;

      if (idle < 4) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      idle = 0;

      if (!frame) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const markDirty = () => {
      for (const cache of caches.values()) {
        cache.dirty = true;
      }

      start();
    };

    const onMotion = () => {
      if (motion.matches) {
        root.dataset.motion = "off";
        root.dataset.reduced = "true";
      }

      markDirty();
    };

    update();
    alignModuleHash(root);

    const onHash = () => {
      alignModuleHash(root);
      start();
    };

    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("resize", markDirty, { passive: true });
    window.addEventListener("hashchange", onHash);
    motion.addEventListener("change", onMotion);
    narrow.addEventListener("change", markDirty);

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            markDirty();
          })
        : null;
    const platform = root.querySelector("#platform");

    if (platform && resizeObserver) {
      resizeObserver.observe(platform);
    }

    const fonts = document.fonts;

    if (fonts?.ready) {
      void fonts.ready.then(() => {
        markDirty();
      });
    }

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", start);
      window.removeEventListener("resize", markDirty);
      window.removeEventListener("hashchange", onHash);
      motion.removeEventListener("change", onMotion);
      narrow.removeEventListener("change", markDirty);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <KineticContext.Provider value={context}>
      <div ref={rootRef} className="kinetic-story" data-motion="off">
        {children}
      </div>
    </KineticContext.Provider>
  );
}
