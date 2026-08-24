export default async function WorkforceLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <h1>Workforce sign in</h1>
      {error ? (
        <p role="alert">Unable to sign in with those credentials.</p>
      ) : null}
      <form action="/api/auth/workforce" method="post">
        <label htmlFor="organisationCode">Organisation code</label>
        <input id="organisationCode" name="organisationCode" required />
        <label htmlFor="workforceAlias">Workforce ID or username</label>
        <input id="workforceAlias" name="workforceAlias" required />
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
    </main>
  );
}
