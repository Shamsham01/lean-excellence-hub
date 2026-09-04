"use client";

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { invitationContinuePath } from "@/modules/identity/invitation-constants";
import type { InvitationLifecycleView } from "@/modules/identity/invitation-lifecycle";

type InvitationAcceptanceCardProps =
  | {
      token: string;
      bindingId?: undefined;
      lifecycle: InvitationLifecycleView;
      loginPath: string;
      activatePath: string;
      acceptEndpoint: string;
    }
  | {
      token?: undefined;
      bindingId: string;
      lifecycle: InvitationLifecycleView;
      loginPath?: undefined;
      activatePath?: undefined;
      acceptEndpoint: string;
    };

function InvitationDetails({
  lifecycle,
}: {
  lifecycle: InvitationLifecycleView;
}) {
  return (
    <dl className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
      {lifecycle.organisationName ? (
        <div>
          <dt className="text-muted-foreground">Join</dt>
          <dd className="font-medium text-foreground">
            {lifecycle.organisationName}
          </dd>
        </div>
      ) : null}
      {lifecycle.recipientEmailMasked || lifecycle.recipientEmail ? (
        <div>
          <dt className="text-muted-foreground">Invitation for</dt>
          <dd className="font-medium text-foreground">
            {lifecycle.recipientEmailMasked ?? lifecycle.recipientEmail}
          </dd>
        </div>
      ) : null}
      {lifecycle.roleDisplayName ? (
        <div>
          <dt className="text-muted-foreground">Application role</dt>
          <dd className="font-medium text-foreground">
            {lifecycle.roleDisplayName}
          </dd>
        </div>
      ) : null}
      {lifecycle.scopeLabel ? (
        <div>
          <dt className="text-muted-foreground">Access scope</dt>
          <dd className="font-medium text-foreground">
            {lifecycle.scopeLabel}
          </dd>
        </div>
      ) : null}
      {lifecycle.expiresAt ? (
        <div>
          <dt className="text-muted-foreground">Expires</dt>
          <dd className="font-medium text-foreground">
            {new Date(lifecycle.expiresAt).toLocaleDateString("en-GB", {
              dateStyle: "long",
            })}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function InvitationAcceptanceCard(props: InvitationAcceptanceCardProps) {
  const { lifecycle, acceptEndpoint } = props;
  const signOutNext =
    props.bindingId !== undefined
      ? invitationContinuePath(props.bindingId)
      : `/invitations/${props.token}`;

  if (lifecycle.state === "invalid") {
    return (
      <AuthCard
        title="Invitation unavailable"
        description="This invitation link is not valid."
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Ask your organisation administrator for a new invitation.
          </p>
        }
      >
        <p className="text-sm text-muted-foreground">
          If you received this link recently, it may have been replaced or typed
          incorrectly.
        </p>
      </AuthCard>
    );
  }

  if (lifecycle.state === "expired") {
    return (
      <AuthCard
        title="Invitation expired"
        description="This invitation has expired."
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Ask your organisation administrator for a new invitation.
          </p>
        }
      >
        <p className="text-sm text-muted-foreground">
          Organisation invitations are time-limited for security. Request a
          fresh link from your administrator.
        </p>
      </AuthCard>
    );
  }

  if (lifecycle.state === "revoked") {
    return (
      <AuthCard
        title="Invitation no longer active"
        description="This invitation is no longer active."
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Contact your organisation administrator if you still need access.
          </p>
        }
      >
        <p className="text-sm text-muted-foreground">
          The invitation was revoked before it could be accepted.
        </p>
      </AuthCard>
    );
  }

  if (lifecycle.state === "accepted") {
    return (
      <AuthCard
        title="Invitation already accepted"
        description="This invitation has already been accepted."
      >
        {lifecycle.organisationName ? (
          <p className="text-sm text-muted-foreground">
            You already joined {lifecycle.organisationName}.
          </p>
        ) : null}
        <Button asChild className="w-full">
          <Link href="/platform">Open workspace</Link>
        </Button>
      </AuthCard>
    );
  }

  if (lifecycle.sessionState === "wrong_account") {
    return (
      <AuthCard
        title="Different account signed in"
        description="This invitation belongs to a different account."
      >
        <InvitationDetails lifecycle={lifecycle} />
        <p className="text-sm text-muted-foreground">
          Sign out and continue using the email address that received the
          invitation.
        </p>
        <form action="/auth/signout" method="post">
          <input type="hidden" name="next" value={signOutNext} />
          <Button type="submit" className="w-full">
            Sign out and continue
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (lifecycle.sessionState === "email_unconfirmed") {
    return (
      <AuthCard
        title="Confirm your email"
        description="Confirm the email address on this invitation before accepting."
      >
        <InvitationDetails lifecycle={lifecycle} />
        <p className="text-sm text-muted-foreground">
          Check your inbox for the confirmation email, then return to this
          invitation.
        </p>
      </AuthCard>
    );
  }

  if (lifecycle.sessionState === "already_member") {
    return (
      <AuthCard
        title="Already a member"
        description={
          lifecycle.organisationName
            ? `You're already a member of ${lifecycle.organisationName}.`
            : "You're already a member of this organisation."
        }
      >
        <InvitationDetails lifecycle={lifecycle} />
        <Button asChild className="w-full">
          <Link href="/platform">Open workspace</Link>
        </Button>
      </AuthCard>
    );
  }

  if (lifecycle.sessionState === "ready_to_accept") {
    return (
      <AuthCard
        title="Accept invitation"
        description="Accepting will apply the role and scope offered to you for this organisation."
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Need help? Contact your organisation administrator.
          </p>
        }
      >
        <InvitationDetails lifecycle={lifecycle} />
        <form
          action={acceptEndpoint}
          method="post"
          className="flex flex-col gap-4"
        >
          {props.bindingId !== undefined ? (
            <input type="hidden" name="bindingId" value={props.bindingId} />
          ) : (
            <input type="hidden" name="token" value={props.token} />
          )}
          <Button type="submit" className="w-full">
            Accept invitation
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (props.bindingId !== undefined) {
    return (
      <AuthCard
        title="Invitation unavailable"
        description="Sign in with the invited account to continue."
      >
        <InvitationDetails lifecycle={lifecycle} />
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="You're invited to Lean Excellence Hub"
      description="Create an account or sign in to accept this invitation."
      footer={
        <p className="text-center text-xs text-muted-foreground">
          Account creation is only available through a valid organisation
          invitation.
        </p>
      }
    >
      <InvitationDetails lifecycle={lifecycle} />
      <div className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={props.activatePath}>Create my account</Link>
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?
        </div>
        <Button variant="outline" asChild className="w-full">
          <Link href={props.loginPath}>Sign in</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
