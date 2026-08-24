import Link from "next/link";

import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main>
      <h1>Sign in</h1>
      {error ? (
        <p role="alert">Unable to sign in with those credentials.</p>
      ) : null}
      <form action={login}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button type="submit">Sign in</button>
      </form>
      <p>
        <Link href="/workforce-login">
          Use organisation code and workforce ID
        </Link>
      </p>
      <p>
        <Link href="/recover">Forgot password?</Link>
      </p>
    </main>
  );
}
