/** Extract @handles from comment body (alphanumeric + . _ + -). */
export function extractMentionsFromBody(body: string): string[] {
  const re = /@([a-z0-9._+-]+)/gi;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    set.add(m[1].toLowerCase());
  }
  return [...set];
}
