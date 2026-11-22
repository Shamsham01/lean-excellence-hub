import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Factory,
  Inbox,
  ListChecks,
  type LucideIcon,
  Timer,
} from "lucide-react";

export const ACTION_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  open: ListChecks,
  created: ClipboardList,
  overdue: AlertTriangle,
  completed: CheckCircle2,
  default: ListChecks,
};

export const PPS_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  active: Factory,
  opened: CircleDot,
  overdue: Timer,
  closed: CheckCircle2,
  default: Factory,
};

export const SUGGESTION_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  awaiting: Inbox,
  submitted: ClipboardList,
  implemented: CheckCircle2,
  total: BarChart3,
  default: Inbox,
};

export const FIVE_S_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  completed: CheckCircle2,
  avg: BarChart3,
  open: Clock,
  total: ListChecks,
  default: ListChecks,
};

export const MATURITY_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  score: BarChart3,
  activity: ClipboardList,
  review: Inbox,
  draft: Clock,
  default: BarChart3,
};

export const TRAINING_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  compliance: CheckCircle2,
  sessions: ClipboardList,
  outstanding: AlertTriangle,
  expiring: Timer,
  default: CheckCircle2,
};

export const GEMBA_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  completed: CheckCircle2,
  active: CircleDot,
  observations: ListChecks,
  cancelled: AlertTriangle,
  default: CircleDot,
};

export const BENEFITS_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  open: BarChart3,
  created: ClipboardList,
  validation: Inbox,
  total: ListChecks,
  default: BarChart3,
};

export const SKILLS_ANALYTICS_ICONS: Record<string, LucideIcon> = {
  coverage: BarChart3,
  compliance: CheckCircle2,
  active: ListChecks,
  gap: AlertTriangle,
  default: BarChart3,
};
