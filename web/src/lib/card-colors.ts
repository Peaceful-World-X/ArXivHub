export const CARD_COLORS = [
  "var(--color-card-rose)", "var(--color-card-mint)", "var(--color-card-sky)",
  "var(--color-card-lilac)", "var(--color-card-lemon)", "var(--color-card-peach)",
];

// Keep a pastel background while varying saturation and lightness enough for large favorite lists.
export function favoriteColor(hue: number): string {
  const saturation = 64 + (Math.round(hue * 10) % 9);
  const lightness = 90 + (Math.round(hue * 7) % 7);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function assignFavoriteHues(ids: string[], saved: Record<string, number> = {}): Record<string, number> {
  const hues = { ...saved };
  const used = new Set(Object.values(hues));
  for (const id of ids) {
    if (hues[id] !== undefined) continue;
    const available = [350, 150, 210, 270, 60, 30].filter((hue) => !used.has(hue));
    let hue: number;
    if (available.length) {
      hue = available[Math.floor(Math.random() * available.length)];
    } else {
      // Split the widest remaining gap to keep new colors distinct as favorites grow.
      const sorted = [...used].sort((a, b) => a - b);
      let widest = 0;
      hue = 0;
      sorted.forEach((start, index) => {
        const end = sorted[index + 1] ?? sorted[0] + 360;
        if (end - start > widest) {
          widest = end - start;
          hue = ((start + end) / 2) % 360;
        }
      });
    }
    hues[id] = hue;
    used.add(hue);
  }
  return hues;
}
