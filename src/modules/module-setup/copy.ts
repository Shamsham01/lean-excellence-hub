export const MODULE_SETUP_COPY = {
  heading: "Choose how to start",
  principle: "Your framework. Your standards. Your way of working.",
  path: "Setup mode → Draft → Review → Publish",
  authority: "LeanAI proposes. You review and decide.",
  draftBoundary:
    "This creates an editable draft. Nothing is published until you publish it.",
  manual: {
    mode: "Manual",
    title: "Build your own",
    description:
      "Start with an empty draft and define every category and question yourself.",
    action: "Start manually",
  },
  quickStart: {
    mode: "LEH Quick Start",
    title: "Start from a proven structure",
    description:
      "Deploy an editable LEH starting point, then adapt it to your organisation.",
    action: "Preview starting point",
  },
  leanAi: {
    mode: "LeanAI",
    title: "Build with LeanAI",
    description:
      "Describe how your organisation works. LeanAI turns that into a draft for you to review.",
    action: "Build with LeanAI",
  },
} as const;
