"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_membership_id: string;
};

type ResourceCommentsProps = {
  resourceId: string;
  comments: CommentRow[];
  title?: string;
};

function rpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "Could not post comment";
}

export function ResourceComments({
  resourceId,
  comments,
  title = "Discussion",
}: ResourceCommentsProps) {
  const [localComments, setLocalComments] = useState(comments);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAddComment() {
    if (!commentBody.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: commentId, error: rpcError } = await supabase.rpc(
        "create_comment",
        {
          target_resource_id: resourceId,
          target_body: commentBody.trim(),
        },
      );
      if (rpcError) throw rpcError;
      setLocalComments((prev) => [
        ...prev,
        {
          id: commentId as string,
          body: commentBody.trim(),
          created_at: new Date().toISOString(),
          author_membership_id: "",
        },
      ]);
      setCommentBody("");
    } catch (err) {
      setError(rpcErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-testid="resource-comments">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {localComments.length === 0 ? (
          <p className="text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {localComments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-md border border-border p-3"
              >
                <p>{comment.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          placeholder="Add a clarification or note…"
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !commentBody.trim()}
          onClick={() => handleAddComment()}
        >
          {loading ? "Posting…" : "Post comment"}
        </Button>
      </CardContent>
    </Card>
  );
}
