/** Money helpers. All comparisons are done in integer cents to avoid float drift. */
export function toCents(value: number | string): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Math.round(n * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
