const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dayTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type DayParts = {
  year: string;

  month: string;

  day: string;
};

function toDayParts(value: string): DayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: match[1],

    month: match[2],

    day: match[3],
  };
}

/**
 * Parses a calendar date string ("YYYY-MM-DD") into a local Date,
 * avoiding timezone shifts that plain `new Date(value)` can cause.
 */
export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parts = toDayParts(value);

  if (!parts) {
    return undefined;
  }

  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

/** Serializes a local Date back into a "YYYY-MM-DD" string. */
export function serializeIsoDate(date: Date): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Formats any date value ("YYYY-MM-DD", ISO datetime, or Date) as DD/MM/YYYY. Returns null when invalid. */
export function formatDate(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dayFormatter.format(value);
  }

  const parts = toDayParts(value.trim());

  if (parts) {
    return `${parts.day}/${parts.month}/${parts.year}`;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : dayFormatter.format(date);
}

/** Formats an ISO datetime as "DD/MM/YYYY, H:mm". Returns "" when missing, or the original value when invalid. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dayTimeFormatter.format(date);
}
