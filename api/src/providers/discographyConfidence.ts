/**
 * Cruza títulos de Qobuz con listas de referencia (Last.fm, MusicBrainz) y devuelve 0–100.
 */

export function normalizeDiscographyTitle(raw: string): string {
  let s = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
  s = s.replace(
    /\b(deluxe|super\s*deluxe|remaster(?:ed)?|anniversary|expanded|edition|vol\.?\s*\d+|bonus\s*tracks?|live\s+at|bootleg)\b/gi,
    " "
  );
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Mejor coincidencia del título de Qobuz contra una lista de referencia (0–100).
 * null solo si la lista está vacía.
 */
export function scoreTitleAgainstReferenceList(qobuzTitle: string, referenceTitles: string[]): number | null {
  if (!referenceTitles.length) return null;
  const q = normalizeDiscographyTitle(qobuzTitle);
  if (q.length < 2) return null;

  const qTokens = new Set(q.split(" ").filter((t) => t.length > 1));
  let best = 0;

  for (const rawRef of referenceTitles) {
    const ref = normalizeDiscographyTitle(rawRef);
    if (ref.length < 2) continue;

    if (q === ref) {
      best = 100;
      break;
    }

    if (q.includes(ref) || ref.includes(q)) {
      const shorter = Math.min(q.length, ref.length);
      const sub = shorter >= 10 ? 92 : shorter >= 6 ? 85 : 75;
      best = Math.max(best, sub);
      continue;
    }

    const refTokens = new Set(ref.split(" ").filter((x) => x.length > 1));
    let inter = 0;
    for (const tok of qTokens) {
      if (refTokens.has(tok)) inter += 1;
    }
    const union = qTokens.size + refTokens.size - inter;
    if (union <= 0) continue;
    const jaccard = Math.round((100 * inter) / union);
    if (jaccard > best) best = jaccard;
  }

  return best;
}

/** @deprecated usar scoreTitleAgainstReferenceList */
export function computeDiscographyMatchConfidence(
  qobuzTitle: string,
  _qobuzYear: string,
  lastFmTitles: string[]
): number | null {
  return scoreTitleAgainstReferenceList(qobuzTitle, lastFmTitles);
}

/**
 * Combina Last.fm (popularidad) y MusicBrainz (catálogo); null si no hay ninguna referencia.
 */
export function computeCombinedDiscographyConfidence(
  qobuzTitle: string,
  _qobuzYear: string,
  lastFmTitles: string[],
  mbTitles: string[]
): number | null {
  const lf = lastFmTitles.length ? scoreTitleAgainstReferenceList(qobuzTitle, lastFmTitles) : null;
  const mb = mbTitles.length ? scoreTitleAgainstReferenceList(qobuzTitle, mbTitles) : null;
  if (lf == null && mb == null) return null;
  if (lf != null && mb != null) return Math.min(100, Math.round(0.42 * lf + 0.58 * mb));
  return (lf ?? mb) as number;
}
