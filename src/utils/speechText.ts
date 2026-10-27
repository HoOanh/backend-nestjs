/**
 * Remove visual-only markdown and ASCII diagrams while preserving technical names
 * for the AI voice to pronounce as English terms.
 */
export function normalizeTextForVietnameseSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' . Mở phần minh họa trên bảng. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬▲▼◀▶→←↑↓⚡🎯💡📌🔥✅❌✋🎙️]/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_~|]/g, ' ')
    .replace(/\bepoll_wait\b/g, 'epoll wait')
    .replace(/\bprocess\.memoryUsage\b/g, 'process memory usage')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split cleaned Vietnamese text into natural speaking clauses/sentences.
 */
export function splitIntoVietnameseSentences(text: string): string[] {
  const cleaned = normalizeTextForVietnameseSpeech(text);
  if (!cleaned) return [];
  const rawParts = cleaned.split(/(?<=[.!?;:\n])\s+/);
  const result: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 165) {
      result.push(trimmed);
    } else {
      const clauses = trimmed.split(/(?<=,)\s+/);
      let acc = '';
      for (const clause of clauses) {
        if ((acc + ' ' + clause).trim().length <= 165) {
          acc = (acc + ' ' + clause).trim();
        } else {
          if (acc) result.push(acc);
          acc = clause.trim();
        }
      }
      if (acc) result.push(acc);
    }
  }
  return result.length > 0 ? result : [cleaned.slice(0, 165)];
}

