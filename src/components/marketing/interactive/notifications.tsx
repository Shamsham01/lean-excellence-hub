"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { unreadCount, useDemoDispatch, useDemoState } from "./demo-store";

export function DemoNotificationBell() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const count = unreadCount(state);
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";

  return (
    <button
      type="button"
      className="leh-demo-bell"
      data-testid="leh-demo-notification-bell"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={state.notificationsOpen}
      onClick={() =>
        dispatch({
          type: state.notificationsOpen
            ? "close-notifications"
            : "open-notifications",
        })
      }
    >
      <Bell aria-hidden="true" className="size-4" />
      {count > 0 ? (
        <span
          className="leh-demo-bell-count"
          data-testid="leh-demo-notification-count"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function DemoNotificationCentre({
  container,
}: {
  container: HTMLElement | null;
}) {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.notificationsOpen) {
      closeRef.current?.focus();
    }
  }, [state.notificationsOpen]);

  return (
    <Dialog.Root
      open={state.notificationsOpen}
      onOpenChange={(open) =>
        dispatch({ type: open ? "open-notifications" : "close-notifications" })
      }
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="leh-demo-notify-overlay" />
        <Dialog.Content
          className="leh-demo-notify"
          data-testid="leh-demo-notification-panel"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <div className="leh-demo-notify-head">
            <div>
              <Dialog.Title id={titleId}>Notifications</Dialog.Title>
              <Dialog.Description id={descriptionId}>
                Demo notifications for this workspace.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                ref={closeRef}
                type="button"
                className="leh-demo-icon-button"
                aria-label="Close notifications"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          {state.notifications.length === 0 ? (
            <p className="leh-demo-notify-empty">No notifications yet.</p>
          ) : (
            <ul className="leh-demo-notify-list" role="list">
              {state.notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="leh-demo-notify-item"
                    data-unread={item.unread ? "true" : undefined}
                    onClick={() =>
                      dispatch({ type: "focus-notification", id: item.id })
                    }
                  >
                    <span className="leh-demo-notify-title">{item.title}</span>
                    <span className="leh-demo-notify-body">{item.body}</span>
                    <span className="leh-demo-notify-meta">{item.meta}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
