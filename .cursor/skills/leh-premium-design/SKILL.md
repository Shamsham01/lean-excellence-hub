---
name: leh-premium-design
description: Applies Lean Excellence Hub visual, UX and interaction standards to marketing pages, authenticated platform UI, dashboards, module workspaces, forms, mobile experiences, LeanAI interfaces and reusable frontend components. Use whenever designing, styling, reviewing or modifying LEH user interfaces, frontend UX or visual presentation.
---

# Lean Excellence Hub Premium Design

## Product identity

Lean Excellence Hub is a B2B SaaS platform for Continuous Improvement and Operational Excellence.

LEH should feel:

- premium
- calm
- precise
- modern
- operational
- trustworthy
- intelligent
- enterprise-ready
- visually coherent

It must not look like:

- a generic admin template
- a hobby project
- an AI-generated SaaS starter
- a crypto / consumer AI product
- a collection of unrelated Lean tools

The core product proposition is:

> One connected system for Continuous Improvement.

The recurring LEH product narrative is:

Evidence
→ Action
→ Problem Solving
→ Improvement
→ Value
→ Learning

Design should reinforce this connected operating-system concept wherever useful.

## Core UX principles

For every page or workspace make these immediately understandable:

1. Where am I?
2. What is the purpose of this page?
3. What requires attention?
4. What is the primary action?
5. What should happen next?

Hierarchy comes before decoration.

Premium does not mean empty.

LEH is an operational system, so information density should remain appropriate for real work.

Use whitespace to establish hierarchy, not to create large unused areas.

## Avoid generic AI design

Do not default to:

- endless equal-sized cards
- repeated icon + title + paragraph boxes
- every section inside a rounded container
- excessive rounded-xl styling
- oversized empty whitespace
- decorative blue/purple gradients
- glassmorphism everywhere
- glowing neon borders
- floating decorative blobs
- meaningless charts
- fake dashboards
- fake statistics
- fake ROI
- fake customers
- fake testimonials
- fake awards
- stock factory imagery
- arbitrary pills and badges
- decorative animation

If a module is being presented, prefer visual language based on what that module actually does.

## Prefer LEH-native UI

Use real Operational Excellence concepts such as:

- owners
- due dates
- actions
- findings
- status
- escalation
- maturity levels
- audit adherence
- problem-solving stages
- project milestones
- validation state
- capability matrices
- training gaps
- suggestion workflow
- operational evidence

A UI should feel specific to Lean Excellence Hub.

If the same UI could belong to almost any generic SaaS product, reconsider the design.

See REFERENCE.md for detailed module-specific patterns.

## Visual language

Prefer:

- strong typography
- deliberate hierarchy
- restrained colour
- subtle depth
- precise borders
- consistent spacing
- asymmetrical composition where useful
- meaningful data/state visualisation
- purposeful micro-interactions

Use existing LEH design tokens and components where appropriate.

Do not introduce random palettes or competing visual systems.

Cards/surfaces should represent meaningful conceptual groupings.

Do not wrap everything in a card.

## Motion

Motion must help comprehension.

Good uses:

- hierarchy reveal
- workflow progression
- state change
- success feedback
- navigation feedback
- connected-process storytelling

Avoid:

- continuous floating
- looping glow
- bouncing decorations
- unnecessary parallax
- animating every sentence/card

Prefer:

- opacity
- transform

Typical guidance:

- UI feedback: approximately 120–220ms
- reveal transitions: approximately 350–650ms
- stagger: approximately 40–90ms

Always respect:

prefers-reduced-motion

Content must remain usable if JavaScript or animation fails.

## Marketing UX

Public marketing pages must quickly explain:

WHAT:
Lean Excellence Hub is a connected Operational Excellence / Continuous Improvement platform.

WHO:
Organisations serious about systematic Continuous Improvement.

PROBLEM:
Improvement activity is often fragmented across spreadsheets, forms, email, presentations, meetings and disconnected tools.

DIFFERENTIATOR:
LEH connects the improvement lifecycle.

Do not feature-dump before establishing the customer's problem and desired outcome.

Current strategic marketing language worth preserving:

> Operational excellence. Connected.

Do not invent:

- social proof
- savings figures
- ROI
- logos
- customer counts
- testimonials

## Authenticated product UX

The authenticated platform should prioritise:

- speed
- clarity
- context
- appropriate information density
- obvious primary actions
- minimal unnecessary clicks
- consistent workflow behaviour
- mobile usability

Marketing may be expressive.

Operational workspaces should generally be more compact.

Do not copy a marketing landing-page aesthetic directly into dense application workflows.

## LeanAI

LeanAI should feel integrated into LEH rather than a detached generic chatbot.

Where permitted, visually communicate active context such as:

Organisation
→ Site
→ Module
→ Current object/workflow

Suggestions and assistance should relate to the user's current work.

Human governance remains authoritative.

## Mobile

Mobile is a first-class LEH experience.

At approximately 390px width:

- avoid horizontal overflow
- keep touch targets usable
- maintain a clear primary action
- simplify desktop layouts deliberately
- do not merely stack everything
- keep operational workflows efficient
- prevent excessively tall cards

## Accessibility

Always preserve or improve:

- semantic HTML
- heading hierarchy
- keyboard navigation
- visible focus
- labels
- contrast
- screen-reader context
- reduced-motion behaviour

Never trade accessibility for aesthetics.

## Performance

Premium means fast.

Prefer:

- CSS
- native browser APIs
- server rendering where suitable
- existing icon/component libraries
- lightweight React

Do not add a dependency just for simple visual effects.

Before adding an animation/design dependency, justify why CSS or native APIs cannot reasonably provide the same result.

## Design workflow

For significant UI work:

1. Inspect the current implementation.
2. Inspect LEH design tokens and shared components.
3. Understand the actual workflow/business behaviour.
4. Use Mobbin/reference research where helpful.
5. Use modern-web-guidance for CSS, browser APIs, accessibility and performance decisions.
6. Establish hierarchy and mobile behaviour before coding.
7. Implement with reusable primitives where justified.
8. Review actual desktop and mobile rendering.
9. Refine based on visual QA rather than CI alone.

Do not copy Mobbin/reference designs verbatim.

Extract design principles and create an original LEH solution.

## Visual QA

For substantial visual work, review at minimum:

Desktop:
approximately 1440–1536px wide

Mobile:
approximately 390 × 844

Review:

- spacing
- hierarchy
- density
- alignment
- repetition
- readability
- overflow
- interaction
- motion
- mobile adaptation

Before declaring UI work complete ask:

> Does this look and behave like software an enterprise would confidently pay a five-figure annual subscription for?

If not, refine it.

## Engineering guardrails

Visual work must not casually alter:

- RBAC
- tenant isolation
- authentication
- Supabase schema
- billing
- business logic
- security boundaries

unless explicitly required by the task.

Preserve behaviour while improving presentation.

## Additional guidance

Read [REFERENCE.md](REFERENCE.md) when:

- designing module-specific UI;
- creating marketing mini-product visuals;
- designing LeanAI;
- designing maturity, Gemba, 5S, Suggestions, Problem Solving, Actions, Projects, Benefits, Training or Skills UI;
- deciding how to represent connected Operational Excellence workflows.
