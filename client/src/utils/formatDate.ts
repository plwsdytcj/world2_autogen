export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    // Use browser locale; include fractional seconds when supported
    // @ts-ignore - fractionalSecondDigits may not exist in older TS lib
    const opts: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      fractionalSecondDigits: 3,
    } as any;
    // Some environments may not support fractionalSecondDigits; fallback silently
    const formatted = new Intl.DateTimeFormat(undefined, opts as any).format(d);
    return formatted;
  } catch {
    // Fallback ISO without ms
    return new Date(d).toISOString().replace('T', ' ').replace('Z', '');
  }
};
