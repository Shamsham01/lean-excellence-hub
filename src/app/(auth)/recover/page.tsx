import { requestRecovery } from "./actions";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main>
      <h1>Recover access</h1>
      {sent ? (
        <p>
          If an eligible account exists, recovery instructions have been sent.
        </p>
      ) : (
        <form action={requestRecovery}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
          <button type="submit">Request recovery</button>
        </form>
      )}
    </main>
  );
}
