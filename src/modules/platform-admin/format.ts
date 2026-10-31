const londonDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatLondon(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return `${londonDateTime.format(date)} UK`;
}

export function stripeModeLabel(livemode: boolean | null | undefined) {
  if (livemode === true) {
    return "Stripe live";
  }
  if (livemode === false) {
    return "Stripe test";
  }
  return "Mode not observed";
}
