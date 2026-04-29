export function enforceCharLimit(text: string, limit: number = 280): string {
  if (text.length <= limit) {
    return text;
  }
  return text.substring(0, limit - 3) + '...';
}

export function countChars(text: string): number {
  return text.length;
}

export function getCharCountColor(count: number): string {
  if (count < 250) return 'emerald';
  if (count <= 280) return 'amber';
  return 'rose';
}
