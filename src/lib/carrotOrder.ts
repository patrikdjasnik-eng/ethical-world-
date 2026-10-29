import type { CarrotCommit } from "../types";

export function carrotHead(commits: CarrotCommit[]): CarrotCommit | null {
  if (!commits.length) return null;
  const parents = new Set(commits.map((commit) => commit.parentId));
  const heads = commits.filter((commit) => !parents.has(commit.id));
  if (heads.length !== 1) throw new Error("Carrot historie má více hlav nebo cyklus.");
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const seen = new Set<string>();
  let current: CarrotCommit | undefined = heads[0];
  while (current) {
    if (seen.has(current.id)) throw new Error("Carrot historie obsahuje cyklus.");
    seen.add(current.id);
    if (current.parentId === null) break;
    const parent = byId.get(current.parentId);
    if (!parent || parent.noteId !== current.noteId || parent.commitHash !== current.parentCommitHash) throw new Error("Carrot historie má chybějící nebo změněný parent.");
    current = parent;
  }
  if (seen.size !== commits.length) throw new Error("Carrot historie obsahuje odpojené commity.");
  return heads[0];
}

export function orderCarrotHistory(commits: CarrotCommit[]): CarrotCommit[] {
  const head = carrotHead(commits);
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const ordered: CarrotCommit[] = [];
  let current = head;
  while (current) {
    ordered.push(current);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }
  return ordered;
}
