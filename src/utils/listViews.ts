export interface GroupedItems<T> {
  key: string;
  label: string;
  items: T[];
}

function parseDate(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

export function sortByRecent<T>(items: T[], getIso: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => parseDate(getIso(b)) - parseDate(getIso(a)));
}

export function getDateBucket(iso: string | null | undefined): string {
  if (!iso) return "Ohne Datum";

  const now = new Date();
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfTarget - startOfToday) / 86400000);

  if (dayDiff < 0) return "Überfällig";
  if (dayDiff === 0) return "Heute";
  if (dayDiff === 1) return "Morgen";
  if (dayDiff <= 7) return "Diese Woche";
  if (dayDiff <= 30) return "Diesen Monat";
  return "Später";
}

export function getDateBucketRank(label: string): number {
  switch (label) {
    case "Überfällig": return 0;
    case "Heute": return 1;
    case "Morgen": return 2;
    case "Diese Woche": return 3;
    case "Diesen Monat": return 4;
    case "Später": return 5;
    case "Ohne Datum": return 6;
    default: return 99;
  }
}

export function groupByItems<T>(
  items: T[],
  getKey: (item: T) => string,
  getLabel: (key: string) => string = (key) => key,
  compareGroups?: (a: GroupedItems<T>, b: GroupedItems<T>) => number,
): GroupedItems<T>[] {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }

  const groups = [...map.entries()].map(([key, groupItems]) => ({
    key,
    label: getLabel(key),
    items: groupItems,
  }));

  if (compareGroups) {
    groups.sort(compareGroups);
  }

  return groups;
}