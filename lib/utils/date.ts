import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "UTC";

export function formatDate(
  date: string | Date,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return String(date);
    }
    return d.toLocaleDateString(locale, options || {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    return String(date);
  }
}

export function formatTime(
  time: string | Date,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const t = typeof time === "string" ? new Date(time) : time;
    if (isNaN(t.getTime())) return String(time);
    return t.toLocaleTimeString(locale, options || {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(time);
  }
}

export function formatTime24h(
  time?: string | Date | null,
  locale: string = "vi-VN"
): string {
  if (!time) return "";

  const ensureTwoDigits = (value: string | number): string =>
    String(value ?? "").padStart(2, "0");

  const appendSuffix = (value: string): string => {
    const [hours] = value.split(":");
    const hourNum = parseInt(hours || "0", 10);
    const suffix = hourNum >= 12 ? "PM" : "AM";
    return `${value} ${suffix}`;
  };

  if (typeof time === "string" && !time.includes("T")) {
    const match = time.match(/(\d{1,2}):(\d{1,2})/);
    if (match) {
      const formatted = `${ensureTwoDigits(match[1])}:${ensureTwoDigits(match[2])}`;
      return appendSuffix(formatted);
    }
  }

  try {
    const dateValue =
      typeof time === "string" ? new Date(time) : (time as Date);
    if (!dateValue || isNaN(dateValue.getTime())) {
      return typeof time === "string" ? time : "";
    }
    const formatted = dateValue.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return appendSuffix(formatted);
  } catch {
    return typeof time === "string" ? time : "";
  }
}

function toDateTime(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): DateTime {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timeZone);
}

export function getDateStringInTimezone(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  return toDateTime(date, timeZone).toFormat("yyyy-LL-dd");
}

export function getMonthStartDate(timeZone: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  return toDateTime(date, timeZone).startOf("month").toFormat("yyyy-LL-dd");
}

export function getMonthLabel(timeZone: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  return toDateTime(date, timeZone).toFormat("yyyy-LL");
}

export function getMonthPeriodRange(timeZone: string = DEFAULT_TIMEZONE, date: Date = new Date()): {
  periodStartIso: string;
  nextPeriodStartIso: string;
} {
  const start = toDateTime(date, timeZone).startOf("month");
  const next = start.plus({ months: 1 });
  const periodStartIso = start.toUTC().toISO() || start.toUTC().toJSDate().toISOString();
  const nextPeriodStartIso = next.toUTC().toISO() || next.toUTC().toJSDate().toISOString();
  return {
    periodStartIso,
    nextPeriodStartIso
  };
}

export function getWeekStartDate(timeZone: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  return toDateTime(date, timeZone).startOf("week").toFormat("yyyy-LL-dd");
}

export function toUtcISOString(date: Date = new Date()): string {
  const iso = DateTime.fromJSDate(date).toUTC().toISO();
  return iso || new Date(date).toISOString();
}

export function getDateRangeForTimezone(
  timeZone: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): { start: DateTime; end: DateTime } {
  const start = toDateTime(date, timeZone).startOf("day");
  const end = start.endOf("day");
  return { start, end };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function formatTimeTo12Hour(time24?: string): string {
  if (!time24) return "";
  try {
    const [hh, mm] = time24.split(":");
    const hour24 = parseInt(hh || "0", 10);
    const amPm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${String(hour12).padStart(2, "0")}:${(mm || "00").padStart(2, "0")} ${amPm}`;
  } catch {
    return time24;
  }
}

export function convert24HourToAmPm(timeStr: string): { hour: number; minute: number; ampm: "AM" | "PM" } {
  const [hh, mm] = timeStr.split(":").map(Number);
  const hour24 = hh || 0;
  const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour: hour12, minute: mm || 0, ampm };
}

export function convertAmPmTo24Hour(hour: number, minute: number, ampm: "AM" | "PM"): string {
  let hour24 = hour;
  if (ampm === "PM" && hour !== 12) hour24 += 12;
  if (ampm === "AM" && hour === 12) hour24 = 0;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function convertTo24Hour(time12: string): string {
  const match = time12.match(/(\d+):(\d+)\s*(SA|CH|AM|PM)/i);
  if (!match) return time12;

  const [, hours, minutes, period] = match;
  let hour = parseInt(hours);

  if ((period === "CH" || period === "PM") && hour !== 12) {
    hour += 12;
  } else if ((period === "SA" || period === "AM") && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, "0")}:${minutes}`;
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}
