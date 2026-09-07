// Bagian murni dari mesin saran kategori: tidak menyentuh database sama sekali,
// supaya bisa diuji langsung dengan `node --test` tanpa koneksi maupun alias path.
// Sisanya (query dan pembelajaran hit_count) ada di suggest-categories.ts.
export type Rule = {
  categoryId: string;
  amountMin: bigint | null;
  amountMax: bigint | null;
  minuteStart: number | null;
  minuteEnd: number | null;
  priority: number;
  hitCount: number;
};

// WIB tidak punya DST, jadi offset tetap. Konversi zona waktu di UI pakai
// Intl; di sini aritmetika saja sudah benar dan tidak perlu dependensi.
const WIB_OFFSET_MINUTES = 7 * 60;

export function minuteOfDayWib(at: Date): number {
  const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  return (utcMinutes + WIB_OFFSET_MINUTES) % 1440;
}

function withinWindow(minute: number, start: number, end: number): boolean {
  // start > end berarti window melewati tengah malam, mis. 22:00–02:00.
  return start <= end ? minute >= start && minute <= end : minute >= start || minute <= end;
}

// Semakin kecil semakin spesifik. null = aturan tidak cocok sama sekali.
function specificity(rule: Rule, amount: bigint, minute: number): number | null {
  const hasAmount = rule.amountMin !== null || rule.amountMax !== null;
  if (rule.amountMin !== null && amount < rule.amountMin) return null;
  if (rule.amountMax !== null && amount > rule.amountMax) return null;

  const hasTime = rule.minuteStart !== null && rule.minuteEnd !== null;
  if (rule.minuteStart !== null && rule.minuteEnd !== null) {
    if (!withinWindow(minute, rule.minuteStart, rule.minuteEnd)) return null;
  }

  if (rule.amountMin !== null && rule.amountMin === rule.amountMax) return 0; // nominal persis
  if (hasAmount) return 1; // rentang nominal
  if (hasTime) return 2; // window waktu
  return 3; // aturan tanpa syarat, paling akhir
}

/**
 * Urutkan kategori kandidat: nominal persis dulu, lalu rentang, lalu window waktu.
 * Di dalam tingkat yang sama: hit_count desc, priority desc.
 * Hasil sudah unik per kategori dan bisa lebih pendek dari 3 — pemanggil yang
 * menambal sisanya dengan fallback.
 */
export function rankRules(rules: Rule[], amount: bigint, minute: number): string[] {
  const matched = rules
    .map((rule) => ({ rule, tier: specificity(rule, amount, minute) }))
    .filter((m): m is { rule: Rule; tier: number } => m.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.rule.hitCount - a.rule.hitCount ||
        b.rule.priority - a.rule.priority,
    );

  return [...new Set(matched.map((m) => m.rule.categoryId))];
}
