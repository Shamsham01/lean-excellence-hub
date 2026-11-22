"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export type ActionPlannerComment = {
  id: string;
  body: string;
  created_at: string;
  author_membership_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
};

function plainTextBody(body: string) {
  return body;
}

export function ActionPlannerComments({
  actionId,
  comments,
  canPost,
  postAsAuthor,
  onPosted,
}: {
  actionId: string;
  comments: ActionPlannerComment[];
  canPost: boolean;
  postAsAuthor?: {
    membership_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [localComments, setLocalComments] = useState(comments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function postComment() {
    const body = draft.trim();
    if (!body) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: commentId, error: rpcError } = await supabase.rpc(
        "create_comment",
        {
          target_resource_id: actionId,
          target_body: body,
        },
      );
      if (rpcError) throw rpcError;
      const author = postAsAuthor;
      setLocalComments((prev) => [
        ...prev,
        {
          id: commentId as string,
          body,
          created_at: new Date().toISOString(),
          author_membership_id: author?.membership_id ?? "",
          author_display_name: author?.display_name ?? "You",
          author_avatar_url: author?.avatar_url ?? null,
        },
      ]);
      setDraft("");
      onPosted?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="action-planner-comments"
    >
      <h3 className="text-sm font-medium text-foreground">Comments</h3>
      <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto overscroll-y-contain">
        {localComments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : (
          localComments.map((comment) => (
            <li key={comment.id} className="flex gap-2">
              <PlatformMemberAvatar
                displayName={comment.author_display_name}
                avatarUrl={comment.author_avatar_url}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {comment.author_display_name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground">
                  {plainTextBody(comment.body)}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
      {canPost ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Label htmlFor="action-planner-comment-input" className="sr-only">
            Comment
          </Label>
          <Textarea
            id="action-planner-comment-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment…"
            rows={2}
            disabled={pending}
            aria-label="Comment"
            data-testid="action-planner-comment-input"
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={pending || !draft.trim()}
            onClick={() => void postComment()}
            data-testid="action-planner-comment-post"
          >
            {pending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
