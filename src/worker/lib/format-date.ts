/**
 * Formats a calendar date string ("YYYY-MM-DD") as DD/MM/YYYY without any
 * timezone conversion. Returns the original value when it cannot be parsed.
 */
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}
