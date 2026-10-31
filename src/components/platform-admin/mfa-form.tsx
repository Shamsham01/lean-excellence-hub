"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function PlatformMfaForm({
  verifiedFactorId,
}: {
  verifiedFactorId: string | null;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [factorId, setFactorId] = useState(verifiedFactorId);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function enroll() {
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "LEH platform owner",
    });
    setPending(false);
    if (enrollError || !data?.totp || !data.id) {
      setError("The authenticator could not be started. Try again.");
      return;
    }
    setFactorId(data.id);
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) {
      setError("Add an authenticator before entering a code.");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data?.id) {
      setPending(false);
      setError("The verification challenge could not be created.");
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      code,
      factorId,
    });
    setPending(false);
    if (verified.error) {
      setError("That code was not accepted.");
      return;
    }
    router.replace("/org_admin");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Platform owner
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Authenticator required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Organisation data stays hidden until this sign-in is confirmed with an
          authenticator app.
        </p>
      </div>
      {enrollment ? (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          {/* The QR payload is an authenticator URI generated for this operator. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Authenticator QR code"
            className="mx-auto h-44 w-44"
            src={enrollment.qrCode}
          />
          <p className="text-xs text-muted-foreground">
            Manual key:{" "}
            <span className="font-mono text-foreground">
              {enrollment.secret}
            </span>
          </p>
        </div>
      ) : null}
      {factorId ? (
        <form className="flex flex-col gap-4" onSubmit={verify}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="platform-mfa-code">6-digit code</Label>
            <Input
              id="platform-mfa-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            Confirm authenticator
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" onClick={enroll} disabled={pending}>
            Set up authenticator
          </Button>
        </div>
      )}
    </div>
  );
}
