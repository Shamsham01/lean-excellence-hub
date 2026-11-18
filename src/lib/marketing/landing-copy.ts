/**
 * Landing page copy v3 (AMPLIFY copy-v3.md, 18 Nov 2026), word for word.
 * No demo-organisation names, prices or captions in site text.
 */

export const HERO_HEADLINE =
  "From a floor finding to an owned action, without the spreadsheet.";
/** Desktop line break after "action," (copy-v3 §1). */
export const HERO_HEADLINE_LINES = [
  "From a floor finding to an owned action,",
  "without the spreadsheet.",
] as const;

export const landingNav = [
  { href: "/#platform", label: "Product" },
  { href: "/#connect", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const landingCopy = {
  hero: {
    lede: "Maturity assessments, 5S audits, Gemba walks, suggestions, actions and problem solving in one connected system, so CI is finally measurable.",
  },
  statusQuo: {
    title: "How most sites still run CI.",
    pains: [
      "Initiatives scattered across spreadsheets, printouts and tools.",
      "Audits and assessments typed up again afterwards.",
      "No single view, so CI can't be measured.",
    ],
  },
  platform: {
    title: "One connected system for continuous improvement.",
    intro:
      "Your most common CI initiatives live in one place, easier to manage and fully visible to everyone with access.",
    modules: [
      {
        name: "Maturity assessments",
        detail: "Score every pillar against your own framework.",
      },
      {
        name: "5S audits",
        detail: "Score each area and raise actions from findings.",
      },
      {
        name: "Gemba walks",
        detail: "Record observations on the walk, not afterwards.",
      },
      {
        name: "Suggestions",
        detail: "Capture ideas from the floor and review them.",
      },
      { name: "Actions", detail: "One planner, every owner and due date." },
      {
        name: "Problem solving",
        detail: "Structured cases, from problem to root cause.",
      },
    ],
  },
  connect: {
    title: "One finding. Every next step connected.",
    intro:
      "A morning Gemba finding on Packing Line 1 becomes an action to realign the film guide, and links to the case Recurring film wander on Packing Line 1.",
    label: "Observe, Act, Solve",
  },
  stages: ["Observe", "Act", "Solve"],
  /** The record shown at each stage of Observe, Act, Solve (unchanged). */
  stageRecords: [
    "Packaging film misaligned on Packing Line 1",
    "Realign the film guide and confirm the first-off pack",
    "Recurring film wander on Packing Line 1",
  ],
  measure: {
    title: "Finally, CI you can measure.",
    intro:
      "Assessment scores, audit results, completed Gemba walks, suggestions and closed actions are recorded as the work happens, so CI shows in real numbers.",
  },
  floor: {
    title: "Audit on the floor, not afterwards.",
    intro:
      "Run audits and assessments on a phone or tablet, with photos and notes as you go, and nothing to type up later.",
  },
  leanAI: {
    title: "LeanAI drafts. A person decides.",
    intro:
      "LeanAI works from the record in front of you and drafts the next step; only a person saves, publishes or closes.",
    steps: [
      { name: "Draft", detail: "LeanAI drafts from the open record." },
      { name: "Review", detail: "Read, edit or reject it." },
      { name: "Decide", detail: "Only a person saves or publishes." },
    ],
  },
  faq: {
    title: "Questions, answered.",
    items: [
      {
        question: "What is Lean Excellence Hub?",
        answer:
          "One connected system for CI, OpEx and Lean teams: maturity assessments, 5S audits, Gemba walks, suggestions, actions and problem solving with 5 Why, A3 or Rapid RCA, all in one place.",
      },
      {
        question: "How does early access work?",
        answer:
          "Choose Get free access, tell us about your site, and we will be in touch to set it up with you. Prefer to see it first? Book a 30-minute live walkthrough. Access is set up with you, not self-serve.",
      },
      {
        question: "Are the screens on this page customer data?",
        answer:
          "No. The screens show a fictional demo organisation, not customer data.",
      },
      {
        question: "What does LeanAI do, and what does it not do?",
        answer:
          "LeanAI drafts from the record in front of you: a framework, a proposal or a cause analysis. A person reviews, edits and decides what is saved. LeanAI does not publish results, close cases or grant access.",
      },
    ],
  },
  access: {
    title: "Get free access.",
    intro:
      "Lean Excellence Hub is in early access. Tell us about your site and we will set it up with you.",
    demoTitle: "Prefer to see it first?",
    demoLine: "A 30-minute live walkthrough of the product.",
    submitting: "Sending…",
    successTitle: "Thanks. We have your details.",
    successBody:
      "We will be in touch to set up your early access. Want to see it sooner? Book a 30-minute live walkthrough.",
    /** LAUNCH form-consent-copy.md: line under the submit button. */
    privacyNote:
      "We'll use your details to set up early access and contact you about Lean Excellence Hub.",
  },
  fields: {
    fullName: { label: "Full name", placeholder: "Your full name" },
    workEmail: { label: "Work email", placeholder: "name@company.com" },
    company: { label: "Company", placeholder: "Company name" },
    role: { label: "Role or job title", placeholder: "e.g. CI Manager" },
    sites: { label: "Number of sites", placeholder: "e.g. 3" },
    employees: { label: "Number of employees", placeholder: "Choose a range" },
    ciAreas: { label: "Which CI areas interest you?" },
  },
  alt: {
    dashboard:
      "Lean Excellence Hub dashboard showing items that need attention and operational tiles for actions, problem solving, suggestions and 5S audits.",
    assessment:
      "A formal maturity assessment on a phone: a question with its rating scale, notes and a photo.",
    audit:
      "A 5S audit on a phone, raising an action with an owner and a due date.",
    planner:
      "The actions planner as a board, with open, in-progress and completed actions.",
    results: "A published maturity result with pillar scores.",
    analysis:
      "A problem-solving cause analysis with LeanAI proposals to accept, edit or reject.",
  },
} as const;
