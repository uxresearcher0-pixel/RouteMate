/** Seat-structure helpers — mirrors web/src/lib/allocation.ts (display only). */

const KNOWN_LAYOUTS: Record<number, number[]> = {
  9: [1, 3, 2, 3],
  10: [1, 3, 3, 3],
  11: [1, 3, 3, 4],
};

export function defaultSeatLayout(capacity: number): number[] {
  if (KNOWN_LAYOUTS[capacity]) return KNOWN_LAYOUTS[capacity];
  if (capacity >= 20) {
    const k = Math.floor((capacity - 5) / 4);
    if (capacity - 5 - 4 * k === 0) return [...Array<number>(k).fill(4), 5];
    const k2 = Math.floor(capacity / 4);
    const rem = capacity - 4 * k2;
    return rem === 0 ? Array<number>(k2).fill(4) : [...Array<number>(k2).fill(4), rem];
  }
  const rows = [1];
  let remaining = capacity - 1;
  while (remaining > 4) {
    rows.push(3);
    remaining -= 3;
  }
  if (remaining > 0) rows.push(remaining);
  return rows;
}

export function resolveSeatRows(capacity: number, seatLayout?: number[]): number[] {
  if (seatLayout?.length && seatLayout.reduce((a, b) => a + b, 0) === capacity) {
    return seatLayout;
  }
  return defaultSeatLayout(capacity);
}

export function seatRowGroups(rows: number[]): string[][] {
  let n = 0;
  return rows.map((size) => Array.from({ length: size }, () => `P${++n}`));
}

export function parseArrangement(s: string | undefined, expected: number): number[] | null {
  if (!s) return null;
  const segs = s
    .split("_")
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return segs.length > 0 && segs.reduce((a, b) => a + b, 0) === expected ? segs : null;
}

export type Slot = { kind: "seat"; label: string } | { kind: "gap" };

export function rowSlots(
  labels: string[],
  arrangement: string | undefined,
  width: number,
  coaster: boolean,
): Slot[] {
  const segs =
    parseArrangement(arrangement, labels.length) ??
    (coaster && labels.length === 4 ? [2, 2] : [labels.length]);
  const slots: Slot[] = [];
  let li = 0;
  segs.forEach((n, i) => {
    if (i > 0) slots.push({ kind: "gap" });
    for (let k = 0; k < n; k++) slots.push({ kind: "seat", label: labels[li++] });
  });
  while (slots.length < width) slots.unshift({ kind: "gap" });
  return slots;
}
