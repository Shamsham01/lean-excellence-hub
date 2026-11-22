/** Copy for the early-access page and its form. */
export const earlyAccessCopy = {
  access: {
    kicker: "Early access",
    title: "Get free access.",
    intro:
      "Lean Excellence Hub is in early access. Tell us about your site and we will set it up with you.",
    demoTitle: "Prefer to see it first?",
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
