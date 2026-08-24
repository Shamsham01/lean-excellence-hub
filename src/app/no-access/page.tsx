export default function NoAccessPage() {
  return (
    <main>
      <h1>No organisation access</h1>
      <p>Your identity is not currently eligible for an active organisation.</p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
