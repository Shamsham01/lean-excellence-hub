import Image from "next/image";

type Source = {
  /** Path under /public without the extension. */
  base: string;
  width: number;
  height: number;
};

type CaptureEntry = {
  alt: string;
  variants: readonly number[];
  dark: Source;
  /** Missing when no light capture exists; the dark one is used in both themes. */
  light?: Source;
};

const v4 = (file: string, width: number, height: number): Source => ({
  base: `/marketing/captures/v4/${file}`,
  width,
  height,
});
const v5 = (file: string, width: number, height: number): Source => ({
  base: `/marketing/captures/v5/${file}`,
  width,
  height,
});

const DESKTOP = [800, 1400] as const;
const PHONE = [600] as const;

export const CAPTURES = {
  observe: {
    alt: "A completed Gemba walk on a phone: the summary, an issue observation and the answer recorded on Packing Line 1.",
    variants: PHONE,
    dark: v5("v6-gemba-finding-phone-dark", 1170, 2169),
    light: v5("v6-gemba-finding-phone-light", 1170, 2169),
  },
  act: {
    alt: "The actions planner as a board, with open, in-progress and completed actions.",
    variants: DESKTOP,
    dark: v4("v4-actions-planner-desktop-dark", 2135, 1482),
  },
  solve: {
    alt: "A problem-solving case on the eight-step rail at Root Cause Analysis, with LeanAI proposals to accept, edit or reject.",
    variants: DESKTOP,
    dark: v5("v3-pps-case-desktop-dark", 2288, 1330),
    light: v5("v3-pps-case-desktop-light", 2288, 1330),
  },
  improve: {
    alt: "The platform home with items needing attention and operational analytics tiles.",
    variants: DESKTOP,
    dark: v4("v5-dashboard-home-desktop-dark", 2282, 1336),
  },
  learn: {
    alt: "A published training course with its duration, validity, learning objectives, trainer and evidence.",
    variants: DESKTOP,
    dark: v5("v8-learn-course-dark", 2288, 1583),
    light: v5("v8-learn-course-light", 2288, 1583),
  },
  raise: {
    alt: "A 5S audit on a phone, raising an action with an owner, a due date and labels.",
    variants: PHONE,
    dark: v4("v2-five-s-raise-phone-dark", 1009, 2100),
  },
  maturity: {
    alt: "A published maturity result with the overall score, maturity levels and five pillar scores.",
    variants: DESKTOP,
    dark: v4("v7-maturity-results-desktop-dark", 2010, 1482),
  },
  gemba: {
    alt: "A completed Gemba walk with its summary, observations and answers.",
    variants: DESKTOP,
    dark: v5("m-gemba-walk-dark", 2288, 1481),
    light: v5("m-gemba-walk-light", 2288, 1481),
  },
  "five-s": {
    alt: "A 5S audit section with scored Sort questions and a linked action.",
    variants: DESKTOP,
    dark: v5("m-5s-audit-dark", 2288, 1012),
    light: v5("m-5s-audit-light", 2288, 1012),
  },
  suggestions: {
    alt: "An implemented improvement idea with what was noticed, the proposed change and the expected benefit.",
    variants: DESKTOP,
    dark: v5("m-suggestions-idea-dark", 2288, 1091),
    light: v5("m-suggestions-idea-light", 2288, 1091),
  },
  actions: {
    alt: "The actions list grouped by due date, with status, priority and assignee.",
    variants: DESKTOP,
    dark: v5("m-actions-list-dark", 2288, 1751),
    light: v5("m-actions-list-light", 2288, 1765),
  },
  "problem-solving": {
    alt: "A problem-solving cause analysis with LeanAI proposals to accept, edit or reject.",
    variants: DESKTOP,
    dark: v4("v3b-pps-analysis-desktop-dark", 2282, 1231),
  },
  "projects-benefits": {
    alt: "A project charter with its problem statement and objective.",
    variants: DESKTOP,
    dark: v5("m-projects-charter-dark", 2288, 880),
    light: v5("m-projects-charter-light", 2288, 880),
  },
  "training-skills": {
    alt: "The skills catalogue with skills grouped by category.",
    variants: DESKTOP,
    dark: v5("l-skills-catalogue-dark", 2288, 956),
    light: v5("l-skills-catalogue-light", 2288, 956),
  },
  leanai: {
    alt: "LeanAI facilitating a problem-solving case beside a provisional why chain and a fishbone board.",
    variants: DESKTOP,
    dark: v5("v3c-pps-board-desktop-dark", 2288, 1147),
    light: v5("v3c-pps-board-desktop-light", 2288, 1147),
  },
  organisation: {
    alt: "The organisation-wide training catalogue with published courses.",
    variants: DESKTOP,
    dark: v5("m-training-catalogue-dark", 2288, 783),
    light: v5("m-training-catalogue-light", 2288, 783),
  },
} as const satisfies Record<string, CaptureEntry>;

export type CaptureSlot = keyof typeof CAPTURES;

function srcSet(source: Source, variants: readonly number[], ext: string) {
  return [
    ...variants
      .filter((w) => w < source.width)
      .map((w) => `${source.base}-${w}w.${ext} ${w}w`),
    `${source.base}.${ext} ${source.width}w`,
  ].join(", ");
}

function Shot({
  source,
  variants,
  alt,
  sizes,
  eager,
  className,
}: {
  source: Source;
  variants: readonly number[];
  alt: string;
  sizes: string;
  eager: boolean;
  className?: string;
}) {
  return (
    <picture className={className}>
      <source
        srcSet={srcSet(source, variants, "avif")}
        type="image/avif"
        sizes={sizes}
      />
      <source
        srcSet={srcSet(source, variants, "webp")}
        type="image/webp"
        sizes={sizes}
      />
      <Image
        src={`${source.base}.webp`}
        alt={alt}
        width={source.width}
        height={source.height}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        unoptimized
        style={{ aspectRatio: `${source.width} / ${source.height}` }}
      />
    </picture>
  );
}

/**
 * A product capture shown whole at its natural aspect ratio. When a light
 * capture exists, the light one shows in light mode and the dark one in dark
 * mode (and inside always-dark bands); CSS keys off the `.dark` class that
 * next-themes sets before first paint, so there is no flash. Hidden pictures
 * are lazy and never fetched.
 */
export function Capture({
  slot,
  sizes,
  eager = false,
  dark = false,
  className,
}: {
  slot: CaptureSlot;
  sizes?: string;
  eager?: boolean;
  /** Always-dark band: render only the dark capture. */
  dark?: boolean;
  className?: string;
}) {
  const entry: CaptureEntry = CAPTURES[slot];
  const phone = entry.dark.width < entry.dark.height;
  const resolvedSizes =
    sizes ??
    (phone
      ? "(max-width: 430px) 70vw, 300px"
      : "(max-width: 1023px) 92vw, 780px");
  const classes = [
    "editorial-capture",
    phone ? "editorial-capture-phone" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={classes} data-capture={slot}>
      {entry.light && !dark ? (
        <>
          <Shot
            source={entry.light}
            variants={entry.variants}
            alt={entry.alt}
            sizes={resolvedSizes}
            eager={false}
            className="editorial-capture-light"
          />
          <Shot
            source={entry.dark}
            variants={entry.variants}
            alt={entry.alt}
            sizes={resolvedSizes}
            eager={false}
            className="editorial-capture-dark"
          />
        </>
      ) : (
        <Shot
          source={entry.dark}
          variants={entry.variants}
          alt={entry.alt}
          sizes={resolvedSizes}
          eager={eager}
        />
      )}
    </figure>
  );
}

/** Whether a slot is a phone capture (portrait). */
export function isPhoneCapture(slot: CaptureSlot) {
  const { width, height } = CAPTURES[slot].dark;
  return width < height;
}
