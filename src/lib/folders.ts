import type { Note, VaultFolder } from "../types";

export interface FolderTreeNode {
  folder: VaultFolder;
  children: FolderTreeNode[];
  notes: Note[];
}

export function normalizeFolderPath(path: string): string {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

export function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

export function joinFolderPath(parentPath: string | null, name: string): string {
  const cleanName = sanitizeFolderName(name);
  return normalizeFolderPath(parentPath ? `${parentPath}/${cleanName}` : cleanName);
}

export function inferFoldersFromNotes(notes: Note[]): VaultFolder[] {
  const timestamp = new Date().toISOString();
  const seen = new Set<string>();
  const folders: VaultFolder[] = [];

  for (const note of notes) {
    const normalized = normalizeFolderPath(note.folder);

    if (!normalized) {
      continue;
    }

    const parts = normalized.split("/");

    for (let index = 0; index < parts.length; index += 1) {
      const path = parts.slice(0, index + 1).join("/");

      if (seen.has(path)) {
        continue;
      }

      seen.add(path);
      folders.push({
        id: crypto.randomUUID(),
        name: parts[index],
        path,
        parentPath: index === 0 ? null : parts.slice(0, index).join("/"),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  }

  return folders;
}

export function buildFolderTree(folders: VaultFolder[], notes: Note[]): {
  roots: FolderTreeNode[];
  rootNotes: Note[];
} {
  const nodes = new Map<string, FolderTreeNode>();

  for (const folder of folders) {
    nodes.set(folder.path, {
      folder,
      children: [],
      notes: []
    });
  }

  const roots: FolderTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.folder.parentPath ? nodes.get(node.folder.parentPath) : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const rootNotes: Note[] = [];

  for (const note of notes) {
    const folderPath = normalizeFolderPath(note.folder);
    const folderNode = folderPath ? nodes.get(folderPath) : null;

    if (folderNode) {
      folderNode.notes.push(note);
    } else {
      rootNotes.push(note);
    }
  }

  const sortNodes = (treeNodes: FolderTreeNode[]) => {
    treeNodes.sort((left, right) => left.folder.name.localeCompare(right.folder.name, "cs"));

    for (const node of treeNodes) {
      node.notes.sort((left, right) => left.title.localeCompare(right.title, "cs"));
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  rootNotes.sort((left, right) => left.title.localeCompare(right.title, "cs"));

  return { roots, rootNotes };
}

export function isPathInsideFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

export function renameFolderPath(path: string, oldPath: string, newPath: string): string {
  if (!isPathInsideFolder(path, oldPath)) {
    return path;
  }

  return normalizeFolderPath(`${newPath}${path.slice(oldPath.length)}`);
}
