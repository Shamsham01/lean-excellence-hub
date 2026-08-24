import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <h1>Set a new password</h1>
      {error ? <p role="alert">The password could not be updated.</p> : null}
      <form action={updatePassword}>
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <button type="submit">Update password</button>
      </form>
    </main>
  );
}
