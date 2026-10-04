import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Factory,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { MarketingHeader } from "./header";
import {
  BookDemoControl,
  MarketingContainer,
  MarketingKicker,
  MarketingSection,
  MarketingSurface,
  SectionIntro,
} from "./primitives";
import { MarketingSystemVisual } from "./system-visual";

const FRAGMENTS = [
  "Audits",
  "Gemba findings",
  "Actions",
  "Suggestions",
  "Projects",
  "Training",
  "Maturity assessments",
  "Benefits",
] as const;

const JOURNEY = [
  {
    title: "Observe",
    body: "Gemba, 5S, assessments and frontline ideas capture evidence where work happens.",
  },
  {
    title: "Act",
    body: "Ownership, due dates, escalation and a single action system keep work moving.",
  },
  {
    title: "Solve",
    body: "Structured problem solving and Kaizen move beyond containment to verified root cause.",
  },
  {
    title: "Improve",
    body: "Projects implement countermeasures and connect activity to validated benefits.",
  },
  {
    title: "Learn",
    body: "Capability, maturity and LeanAI context help the organisation get better next time.",
  },
] as const;

const PLATFORM = [
  {
    title: "Maturity",
    body: "Build, assess and improve your Operational Excellence system. Start from the LEH Operational Excellence Standard, then make it yours.",
    icon: BarChart3,
    featured: true,
  },
  {
    title: "Gemba",
    body: "Turn workplace observation into owned improvement, with walks, findings and follow-through in one place.",
    icon: Eye,
    featured: false,
  },
  {
    title: "5S",
    body: "Schedule audits, manage findings and sustain workplace standards instead of storing scores in a spreadsheet.",
    icon: ClipboardCheck,
    featured: false,
  },
  {
    title: "Suggestions",
    body: "Turn frontline ideas into visible, governed improvement — from submission through review to action.",
    icon: Lightbulb,
    featured: false,
  },
  {
    title: "Problem Solving",
    body: "Move beyond containment into verified root cause and sustained countermeasures, with the case history attached.",
    icon: Wrench,
    featured: false,
  },
  {
    title: "Actions",
    body: "One accountable action system across the platform, with owners, due dates and visibility.",
    icon: ListChecks,
    featured: false,
  },
  {
    title: "Projects & Benefits",
    body: "Connect improvement activity to validated business results, including forecast and realisation.",
    icon: CheckCircle2,
    featured: false,
  },
  {
    title: "Training & Skills",
    body: "Plan and build Lean / CI capability, and see where skills exist and where they still need development.",
    icon: BookOpen,
    featured: false,
  },
] as const;

const LEANAI_POINTS = [
  "Assist setup and explain the current organisation or module context.",
  "Support structured problem solving without replacing the method.",
  "Help people navigate Lean Excellence Hub and interpret Operational Excellence information.",
  "Surface relevant improvement context from the work already in the system.",
] as const;

const VALUE = [
  {
    title: "One source of truth",
    body: "Stop rebuilding CI reporting across disconnected spreadsheets, forms and slide decks.",
    icon: ShieldCheck,
  },
  {
    title: "Accountability",
    body: "Every improvement action can have ownership, a due date and visibility across the system.",
    icon: ListChecks,
  },
  {
    title: "Participation",
    body: "Connect frontline ideas to governed improvement so contribution is visible, not lost in a box.",
    icon: Lightbulb,
  },
  {
    title: "Evidence",
    body: "Keep maturity assessment alongside the improvement activity the organisation is already running, instead of managing it in a separate paper process.",
    icon: Eye,
  },
  {
    title: "Capability",
    body: "See where Lean capability exists, where it needs development, and how training connects to the system.",
    icon: BookOpen,
  },
  {
    title: "Value",
    body: "Connect CI activity to verified business benefits, with validation rather than untested claims.",
    icon: CheckCircle2,
  },
] as const;

const AUDIENCES = [
  {
    title: "Operational Excellence leaders",
    body: "Run the system, not a collection of tools. See maturity, activity and results together.",
    icon: Building2,
  },
  {
    title: "CI managers",
    body: "Govern ideas, actions, problem solving and projects without chasing status across inboxes.",
    icon: Wrench,
  },
  {
    title: "Site leadership",
    body: "Keep local operational discipline visible — Gemba, 5S, actions and benefits at the site that owns them.",
    icon: Factory,
  },
  {
    title: "Department and area leaders",
    body: "Own the findings and actions in your area, with a clear line from observation to close-out.",
    icon: Users,
  },
  {
    title: "Frontline teams",
    body: "Raise ideas, take part in Gemba and 5S, and see that improvement work does not disappear.",
    icon: Lightbulb,
  },
] as const;

function FeatureIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function CtaPair({
  primaryLabel,
  primaryHref = "#platform",
}: {
  primaryLabel: string;
  primaryHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Button asChild>
        <a href={primaryHref}>{primaryLabel}</a>
      </Button>
      <Button asChild variant="outline">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}

function IconTile({
  title,
  body,
  icon,
  featured = false,
  className,
  children,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
  featured?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <MarketingSurface featured={featured} className={className}>
      <FeatureIcon icon={icon} />
      <h3 className="marketing-subheading mt-4">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      {children}
    </MarketingSurface>
  );
}

export function MarketingHome() {
  return (
    <div className="marketing min-h-dvh">
      <a className="marketing-skip" href="#main">
        Skip to main content
      </a>
      <MarketingHeader />
      <main id="main">
        <Hero />
        <Problem />
        <Journey />
        <Platform />
        <LeanAi />
        <Maturity />
        <Value />
        <Audience />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <MarketingSection className="marketing-hero pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16">
      <div className="marketing-hero-grid" aria-hidden="true" />
      <MarketingContainer
        wide
        className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:gap-16"
      >
        <div>
          <MarketingKicker>
            The operating system for Continuous Improvement
          </MarketingKicker>
          <h1 className="marketing-display mt-5">
            Operational excellence. Connected.
          </h1>
          <p className="marketing-lede mt-6">
            Run your entire Continuous Improvement system in one place. Connect
            maturity, Gemba, 5S, ideas, problem solving, projects, capability
            and measurable benefits — from frontline evidence to sustained
            results.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            <CtaPair primaryLabel="Explore the platform" />
            <BookDemoControl />
          </div>
        </div>
        <MarketingSystemVisual />
      </MarketingContainer>
    </MarketingSection>
  );
}

function Problem() {
  return (
    <MarketingSection
      id="why"
      className="border-t border-border bg-surface pt-16 sm:pt-20"
    >
      <MarketingContainer>
        <SectionIntro
          kicker="The problem"
          title="Continuous Improvement shouldn't live in disconnected spreadsheets."
        >
          <p>
            Operational Excellence teams commonly manage audits, Gemba findings,
            actions, suggestions, improvement projects, training, maturity
            assessments and benefits across disconnected tools. Lean Excellence
            Hub brings them into one connected improvement system.
          </p>
        </SectionIntro>
        <ul className="marketing-fragment mt-10">
          {FRAGMENTS.map((item) => (
            <li
              key={item}
              className="rounded-md border border-border bg-card px-3 py-3 text-sm font-medium text-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground">
          The differentiator is not another Lean toolkit. It is one system in
          which observation, action, problem solving, capability and benefits
          stay connected.
        </p>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Journey() {
  return (
    <MarketingSection>
      <MarketingContainer>
        <SectionIntro
          kicker="From evidence to impact"
          title="A connected loop, not a pile of modules."
        >
          <p>
            Frontline evidence becomes owned work, structured solving, delivered
            improvement and organisational learning — with maturity as the
            connecting layer.
          </p>
        </SectionIntro>
        <ol className="marketing-journey mt-10">
          {JOURNEY.map((step, index) => (
            <li key={step.title} className="marketing-surface relative p-5">
              <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="marketing-subheading mt-3">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Platform() {
  return (
    <MarketingSection
      id="platform"
      className="border-y border-border bg-surface"
    >
      <MarketingContainer>
        <SectionIntro
          kicker="The platform"
          title="One connected improvement system."
        >
          <p>
            Each area is useful on its own. Together they are how Operational
            Excellence actually runs: evidence in, actions owned, problems
            solved, benefits validated, capability built.
          </p>
        </SectionIntro>
        <div className="marketing-bento mt-10">
          {PLATFORM.map((item) =>
            item.featured ? (
              <IconTile key={item.title} {...item}>
                <ul className="mt-5 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                  <li>Workplace organisation / 5S</li>
                  <li>Structured Gemba</li>
                  <li>Action follow-through</li>
                  <li>Problem-solving discipline</li>
                  <li>Capability planning</li>
                  <li>Validated benefits</li>
                </ul>
              </IconTile>
            ) : (
              <IconTile key={item.title} {...item} />
            ),
          )}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}

function LeanAi() {
  return (
    <MarketingSection id="leanai">
      <MarketingContainer className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <SectionIntro
          kicker="LeanAI"
          title="An AI assistant that understands your improvement system."
        >
          <p>
            LeanAI works alongside your improvement system — with context from
            the work you&apos;re actually doing. It is there to help people
            operate LEH well. It does not make authoritative operational
            decisions.
          </p>
        </SectionIntro>
        <MarketingSurface className="p-0">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold">LeanAI</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              You&apos;re in Maturity, and this organisation does not yet have a
              published framework.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              LeanAI can explain the current setup, help you start from the LEH
              Operational Excellence Standard, or walk through the next governed
              step. A person still chooses, reviews and publishes.
            </p>
            <ul className="space-y-2.5">
              {LEANAI_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-sm leading-6 text-foreground"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </MarketingSurface>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Maturity() {
  return (
    <MarketingSection className="border-y border-border bg-surface">
      <MarketingContainer className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <SectionIntro
          kicker="The connecting layer"
          title="Maturity without a proprietary doctrine."
        >
          <p>
            Organisations can start from a practical LEH standard, customise it,
            and own their methodology. LEH supplies the engine, not the
            doctrine.
          </p>
        </SectionIntro>
        <MarketingSurface featured>
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-accent-foreground uppercase">
            LEH Operational Excellence Standard
          </p>
          <h3 className="marketing-subheading mt-3">
            A usable starting point you can make your own.
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The built-in standard is a recommended Operational Excellence
            starting point — workplace organisation, Gemba, action
            follow-through, participation, problem-solving discipline,
            capability and benefits. It is not a mandatory Lean methodology.
          </p>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-foreground">
            <ListItem>
              Start from the LEH Operational Excellence Standard, or author your
              own framework.
            </ListItem>
            <ListItem>
              Customise copy, structure and scoring so the organisation owns the
              method.
            </ListItem>
            <ListItem>
              Designed so operational evidence from LEH modules can later
              support how maturity is assessed — without forcing module usage
              into the doctrine.
            </ListItem>
          </ul>
        </MarketingSurface>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Value() {
  return (
    <MarketingSection>
      <MarketingContainer>
        <SectionIntro
          kicker="Business value"
          title="What a connected system changes."
        >
          <p>
            Functionality only matters if it reduces fragmentation, raises
            accountability and makes improvement results visible to the
            organisation.
          </p>
        </SectionIntro>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE.map((item) => (
            <IconTile key={item.title} {...item} />
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Audience() {
  return (
    <MarketingSection className="border-y border-border bg-surface">
      <MarketingContainer>
        <SectionIntro
          kicker="Who it is for"
          title="Built for every level of Operational Excellence."
        >
          <p>
            Lean Excellence Hub is designed for organisations, not only
            individual Lean practitioners. Sites, roles and permissions already
            exist so operational work can be scoped to the people who should see
            it.
          </p>
        </SectionIntro>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {AUDIENCES.map((item, index) => (
            <IconTile
              key={item.title}
              {...item}
              className={
                index < 3 ? "lg:col-span-2" : "sm:col-span-1 lg:col-span-3"
              }
            />
          ))}
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}

function FinalCta() {
  return (
    <MarketingSection>
      <MarketingContainer className="max-w-3xl">
        <h2 className="marketing-heading">
          Build a Continuous Improvement system people actually use.
        </h2>
        <p className="marketing-lede mt-5">
          Connect improvement activity, capability and results in one
          Operational Excellence platform.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <CtaPair
            primaryLabel="Explore Lean Excellence Hub"
            primaryHref="#platform"
          />
          <BookDemoControl noteId="final-demo-booking-note" />
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <MarketingContainer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground">
          Lean Excellence Hub
        </p>
        <p className="text-sm text-muted-foreground">
          Operational Excellence and Continuous Improvement platform.
        </p>
      </MarketingContainer>
    </footer>
  );
}

function ListItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2
        className="mt-0.5 size-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}
