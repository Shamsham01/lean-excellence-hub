"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/app/(platform)/platform/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";

type PlatformNotificationBellProps = {
  variant: "header" | "rail";
  initialUnreadCount: number;
  initialItems: PlatformInAppNotification[];
};

export function PlatformNotificationBell({
  variant,
  initialUnreadCount,
  initialItems,
}: PlatformNotificationBellProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = initialUnreadCount;
  const menuLabel =
    unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  const buttonClass =
    variant === "header"
      ? "relative size-9 shrink-0 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
      : "relative size-11 shrink-0 rounded-none text-foreground hover:bg-muted";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant === "header" ? "outline" : "ghost"}
          size="icon"
          className={buttonClass}
          aria-label={menuLabel}
          data-testid="platform-notification-bell"
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span
              className="absolute top-1 right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white dark:bg-emerald-500"
              data-testid="platform-notification-count"
              aria-hidden
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] border-border bg-card p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await markAllInAppNotificationsRead();
                  router.refresh();
                });
              }}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div
          className="max-h-[min(24rem,50dvh)] overflow-y-auto overscroll-contain py-1"
          data-testid="platform-notification-list"
        >
          {initialItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You are all caught up.
            </p>
          ) : (
            initialItems.map((item) => {
              const isUnread = item.read_at == null;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className="cursor-pointer rounded-none p-0 focus:bg-muted"
                  onSelect={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      if (isUnread) {
                        await markInAppNotificationRead(item.id);
                      }
                      if (item.href) {
                        router.push(item.href);
                      }
                      router.refresh();
                    });
                  }}
                >
                  <div
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm",
                      isUnread && "bg-emerald-500/5",
                    )}
                  >
                    <span className="leading-snug font-medium text-foreground">
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          High-signal updates only — email delivery is separate.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
