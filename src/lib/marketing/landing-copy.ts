import { DEMO_BOOKING_CTA, REQUEST_FREE_ACCESS_CTA } from "./demo-booking";

// Fallback A: From a floor finding to an owned action.
// Fallback B: Make continuous improvement visible, accountable and measurable.
export const HERO_HEADLINE =
  "From a floor finding to an owned action, without the spreadsheet.";

export const landingNav = [
  { href: "/#connect", label: "The thread" },
  { href: "/#why", label: "Floor and desk" },
  { href: "/#platform", label: "Platform" },
  { href: "/#leanai", label: "LeanAI" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const landingCopy = {
  hero: {
    lede: "It takes audits, Gemba walks and maturity assessments off the spreadsheet, so a finding on the line can become an action and a case in the same system.",
    helper:
      "A 30-minute live walkthrough, or free early access for your team or site.",
  },
  connect: {
    kicker: "The thread",
    title: "One finding. Every next step connected.",
    intro:
      "A morning Gemba finding on Packing Line 1 becomes an action to realign the film guide, and links to the case Recurring film wander on Packing Line 1.",
  },
  why: {
    kicker: "Floor and desk",
    title: "Accountability you can see on the line and on the dashboard.",
    intro:
      "Assess on a phone or tablet, with photos and notes as you go. Site leaders see the same work on the Harbourfield Foods Group dashboard when they are back at a desk.",
  },
  fiveS: {
    kicker: "5S on the floor",
    title: "A finding on the floor should already have an owner.",
    intro:
      "In a 5S audit of the Bodmin Bakery Packing 5S Standard, Raise action opens a form for an owner and a due date, without leaving the question you are scoring.",
  },
  platform: {
    kicker: "The platform",
    title: "Actions, cases and standards, in one system.",
    intro:
      "Actions from walks, audits and assessments land in one planner, as a list or a board. Problem solving uses 5 Why, A3 or Rapid RCA. Suggestions, projects and skills sit alongside.",
  },
  leanAI: {
    kicker: "LeanAI",
    title: "LeanAI drafts. A person decides.",
    intro:
      "LeanAI works from the record in front of you. It can draft a framework or a proposal. A person reviews it, and only a person publishes, closes work or grants access.",
    steps: [
      "Open the framework, walk or case in front of you.",
      "Ask LeanAI to draft a proposal or a framework.",
      "Read the draft against the open record.",
      "Edit anything you would not stand behind.",
      "Accept only what you are willing to use.",
      "You publish, close, assign or grant access.",
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "What to know before you book.",
    items: [
      {
        question: "What is Lean Excellence Hub?",
        answer:
          "A system for CI, OpEx and Lean teams to run digital Gemba walks, 5S audits and maturity assessments, raise actions, and work through problems with 5 Why, A3 or Rapid RCA. Suggestions, projects and skills sit in the same system.",
      },
      {
        question:
          "How do " +
          DEMO_BOOKING_CTA +
          " and " +
          REQUEST_FREE_ACCESS_CTA +
          " differ?",
        answer:
          DEMO_BOOKING_CTA +
          " picks a time for a 30-minute walkthrough. " +
          REQUEST_FREE_ACCESS_CTA +
          " opens a short form: tell us about your site and we set up early access with you. There is no self-serve trial.",
        access: true,
      },
      {
        question: "Are the screens and scores on this page from customers?",
        answer:
          "No. The previews use example data from a fictional demo organisation, Harbourfield Foods Group, at Bodmin Bakery. They show the live product, not customer work, scores or savings. Any figure you see, including a 2.7 out of 5 official result, is demo data.",
      },
      {
        question: "What does LeanAI do, and what does it not do?",
        answer:
          "LeanAI can draft a framework or a proposal from the record in front of you. A person reviews, edits and decides what is saved. LeanAI does not publish results, close cases, grant access or buy capacity.",
      },
      {
        question: "Can we start from our existing framework or standard?",
        answer:
          "Yes. Talk it through with LeanAI, which drafts a framework you refine, or build it yourself. A complete draft of a starter standard can also be deployed in one step. A person reviews it and publishes. There is no spreadsheet import.",
      },
    ],
  },
  close: {
    kicker: "Your system",
    title: "Your framework. Your standards. Your way of working.",
    intro:
      DEMO_BOOKING_CTA +
      " to see the product. If you want free access for your team or site while Lean Excellence Hub is in early access, request it on the early-access page.",
    helper:
      "Free access is arranged with you during early access; it is not a self-serve trial.",
    structure: [
      "Harbourfield Foods Group",
      "Bodmin Bakery",
      "Packing",
      "Packing Line 1",
    ],
  },
  statement: {
    title: "From the floor to the dashboard.",
    detail:
      "A finding, an action and a case stay in one thread. LeanAI can draft; a person decides.",
  },
  credit: "Example data · Harbourfield demo site",
  stages: ["Observe", "Act", "Solve"],
  action: {
    label: "Actions",
    ownerLabel: "Owner",
    sourceLabel: "Gemba observation",
    owner: "Harbourfield Manager",
    assigned: "Assigned",
    verified: "Verified",
  },
  audit: { title: "Bodmin Bakery Packing 5S Standard", status: "In progress" },
  maturity: {
    title: "Bodmin Bakery · official result",
    score: "2.7/5",
    action: "ACT-2026-0019 · Restore missing tools on Line 2 shadow board",
  },
  captions: {
    phone: "Formal assessment · Flow & Capacity",
    audit: "Raise action · Bodmin Bakery Packing 5S Standard",
    case: "Recurring film wander on Packing Line 1",
    analysis: "Cause analysis",
    action: "Realign the film guide and confirm the first-off pack",
    dashboard: "Harbourfield Foods Group · platform home",
    results: "Pillar scores · published formal assessment",
    finding: "Packaging film misaligned on Packing Line 1",
  },
  phoneAlt:
    "A phone in dark mode, showing an in-progress formal maturity assessment: a Flow & Capacity question with its five-level rating scale and a comment. Example data from a fictional demo site.",
  alt: {
    audit:
      "A 5S audit on a phone, raising an action with an owner, a due date and labels.",
    case: "A problem-solving case on the eight-step rail at Root Cause Analysis, with LeanAI proposals to accept, edit or reject.",
    analysis:
      "A problem-solving cause analysis with LeanAI proposals to accept, edit or reject.",
    action:
      "The actions planner as a board, with open, in-progress and completed actions.",
    dashboard:
      "The platform home with items needing attention and operational analytics tiles.",
    finding:
      "A completed Gemba walk with its summary, an issue observation and the answer recorded on Packing Line 1.",
    results:
      "A published maturity result with the overall score, maturity levels and five pillar scores.",
  },
  access: {
    kicker: "Early access",
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
} as const;
