import {
  Award,
  Bot,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderKanban,
  Footprints,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Lightbulb,
  ListChecks,
  Medal,
  Search,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { PlatformNavIcon } from "@/modules/platform-shell/navigation";

export const platformNavIconMap: Record<PlatformNavIcon, LucideIcon> = {
  home: LayoutDashboard,
  maturity: Layers,
  "five-s": Sparkles,
  gemba: Footprints,
  actions: ClipboardList,
  projects: FolderKanban,
  benefits: CircleDollarSign,
  "problem-solving": Search,
  suggestions: Lightbulb,
  people: Users,
  training: GraduationCap,
  skills: Award,
  recognition: Medal,
  schedule: CalendarDays,
  templates: FileText,
  setup: ListChecks,
  "lean-ai": Bot,
  settings: Settings,
};

export function PlatformNavIconComponent({
  icon,
  className,
}: {
  icon: PlatformNavIcon;
  className?: string;
}) {
  const Icon = platformNavIconMap[icon];
  return <Icon className={className} aria-hidden />;
}
