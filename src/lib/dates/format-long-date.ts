const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
});

export function formatLongDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return LONG_DATE_FORMATTER.format(date);
}
