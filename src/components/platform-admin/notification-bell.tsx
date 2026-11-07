"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  markAllPlatformOwnerInAppNotificationsRead,
  markPlatformOwnerInAppNotificationRead,
} from "@/app/org_admin/(console)/actions";
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
import type { PlatformAdminInAppNotification } from "@/modules/platform-admin/schemas";

type PlatformOwnerNotificationBellProps = {
  initialUnreadCount: number;
  initialItems: PlatformAdminInAppNotification[];
};

export function PlatformOwnerNotificationBell({
  initialUnreadCount,
  initialItems,
}: PlatformOwnerNotificationBellProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = initialUnreadCount;
  const menuLabel =
    unread > 0 ? `Alerts, ${unread} unread` : "Signup and billing alerts";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-11 shrink-0"
          aria-label={menuLabel}
          data-testid="platform-owner-notification-bell"
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span
              className="absolute top-1 right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white"
              data-testid="platform-owner-notification-count"
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
            Signup and billing alerts
          </DropdownMenuLabel>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await markAllPlatformOwnerInAppNotificationsRead();
                  router.refresh();
                });
              }}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </Button>
          ) : null}
        </div>
        {initialItems.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No signup or billing alerts yet.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {initialItems.map((item) => (
              <li key={item.id}>
                <DropdownMenuItem
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-1 rounded-none px-3 py-2.5",
                    item.read_at ? "opacity-80" : "bg-muted/40",
                  )}
                  onClick={() => {
                    startTransition(async () => {
                      if (!item.read_at) {
                        await markPlatformOwnerInAppNotificationRead(item.id);
                      }
                      if (item.href) {
                        router.push(item.href);
                      } else {
                        router.refresh();
                      }
                    });
                  }}
                >
                  <span className="text-sm font-medium leading-snug">
                    {item.title}
                  </span>
                  {item.body ? (
                    <span className="text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="rounded-none px-3 py-2.5">
          <a href="/org_admin/notifications" className="text-sm">
            View delivery history
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
