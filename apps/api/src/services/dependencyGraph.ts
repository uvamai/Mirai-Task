/**
 * Task.dependencies lists tasks that must be satisfied first (edge dep -> task).
 * Adding deps to `taskId` creates a cycle if any new dependency can reach `taskId` by following dependencies.
 */
export function dependencyAdditionCreatesCycle(
  taskId: string,
  newDeps: string[],
  existingDepsByTask: Map<string, string[]>
): boolean {
  const adj = new Map<string, string[]>();
  for (const [k, v] of existingDepsByTask) adj.set(k, [...v]);
  adj.set(taskId, [...new Set([...(adj.get(taskId) ?? []), ...newDeps])]);

  function reachable(from: string, target: string, maxSteps = 500): boolean {
    const stack: string[] = [from];
    const seen = new Set<string>();
    let steps = 0;
    while (stack.length && steps < maxSteps) {
      steps += 1;
      const n = stack.pop()!;
      if (n === target) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const d of adj.get(n) ?? []) stack.push(d);
    }
    return false;
  }

  for (const d of newDeps) {
    if (d === taskId) return true;
    if (reachable(d, taskId)) return true;
  }
  return false;
}
