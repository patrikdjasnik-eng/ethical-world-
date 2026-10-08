import type { AgentAuditEntry, CarrotCommit, Note, VaultFolder } from "../types";
import { carrotHead, orderCarrotHistory } from "./carrotOrder";

const databaseName = "ethical-world";
const databaseVersion = 4;
const notesStore = "notes";
const foldersStore = "folders";
const carrotStore = "carrotCommits";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("agentAudit")) {
        database.createObjectStore("agentAudit", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(notesStore)) {
        const store = database.createObjectStore(notesStore, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains(foldersStore)) {
        const store = database.createObjectStore(foldersStore, { keyPath: "id" });
        store.createIndex("path", "path", { unique: true });
      }

      if (!database.objectStoreNames.contains(carrotStore)) {
        const store = database.createObjectStore(carrotStore, { keyPath: "id" });
        store.createIndex("noteId", "noteId");
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onblocked = () => reject(new Error("Vault je otevřený v jiné starší kartě. Zavři ji a zkus znovu."));
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

export async function listNotes(): Promise<Note[]> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readonly");
  const done = transactionDone(transaction);
  const notes = await requestToPromise(transaction.objectStore(notesStore).getAll() as IDBRequest<Note[]>);
  await done;
  database.close();

  return notes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveNote(note: Note): Promise<void> {
  await saveNotes([note]);
}

export async function saveNotes(notes: Note[]): Promise<void> {
  if (notes.length === 0) {
    return;
  }

  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(notesStore);

  for (const note of notes) {
    store.put(note);
  }

  await done;
  database.close();
}

export async function removeNote(noteId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(notesStore).delete(noteId);
  await done;
  database.close();
}

export async function listFolders(): Promise<VaultFolder[]> {
  const database = await openDatabase();
  const transaction = database.transaction(foldersStore, "readonly");
  const done = transactionDone(transaction);
  const folders = await requestToPromise(
    transaction.objectStore(foldersStore).getAll() as IDBRequest<VaultFolder[]>
  );
  await done;
  database.close();

  return folders.sort((left, right) => left.path.localeCompare(right.path, "cs"));
}

export async function saveFolder(folder: VaultFolder): Promise<void> {
  await saveFolders([folder]);
}

export async function saveFolders(folders: VaultFolder[]): Promise<void> {
  if (folders.length === 0) {
    return;
  }

  const database = await openDatabase();
  const transaction = database.transaction(foldersStore, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(foldersStore);

  for (const folder of folders) {
    store.put(folder);
  }

  await done;
  database.close();
}

export async function removeFolder(folderId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(foldersStore, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(foldersStore).delete(folderId);
  await done;
  database.close();
}


export async function listCarrotCommits(noteId: string): Promise<CarrotCommit[]> {
  const database = await openDatabase();
  const transaction = database.transaction(carrotStore, "readonly");
  const done = transactionDone(transaction);
  const index = transaction.objectStore(carrotStore).index("noteId");
  const commits = await requestToPromise(
    index.getAll(IDBKeyRange.only(noteId)) as IDBRequest<CarrotCommit[]>
  );
  await done;
  database.close();

  return orderCarrotHistory(commits);
}

export async function saveCarrotCommit(commit: CarrotCommit): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(carrotStore, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(carrotStore);
  const request = store.index("noteId").getAll(IDBKeyRange.only(commit.noteId)) as IDBRequest<CarrotCommit[]>;
  let conflict: unknown;
  request.onsuccess = () => {
    try {
      const head = carrotHead(request.result);
      if ((head?.id ?? null) !== commit.parentId || (head?.commitHash ?? null) !== commit.parentCommitHash) throw new Error("Carrot historie se během podpisu změnila. Zkus uložení znovu.");
      store.add(commit);
    } catch (error) { conflict = error; transaction.abort(); }
  };
  try { await done; } catch (error) { throw conflict ?? error; } finally { database.close(); }
}

export async function saveWorkspace(notes: Note[], folders: VaultFolder[]): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([notesStore, foldersStore], "readwrite");
    const done = transactionDone(transaction);
    for (const note of notes) transaction.objectStore(notesStore).put(note);
    for (const folder of folders) transaction.objectStore(foldersStore).put(folder);
    await done;
  } finally {
    database.close();
  }
}

// Compare and write in one transaction, including absent notes and concurrent tabs.
export async function saveImportedWorkspace(notes: Note[], folders: VaultFolder[], expectedNotes: Note[], isCurrent: () => boolean): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([notesStore, foldersStore], "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(notesStore);
    const expected = new Map(expectedNotes.map((note) => [note.id, note]));
    const read = store.getAll() as IDBRequest<Note[]>;
    let conflict = false;
    read.onsuccess = () => {
      const stored = new Map(read.result.map((note) => [note.id, note]));
      const sourceKey = (note: Note) => note.source ? JSON.stringify([note.source.provider, note.source.connectionId, note.source.relativePath]) : null;
      const owners = new Map<string, Set<string>>();
      for (const item of read.result) {
        const key = sourceKey(item);
        if (key === null) continue;
        const ids = owners.get(key) ?? new Set<string>();
        ids.add(item.id);
        owners.set(key, ids);
      }
      if (!isCurrent() || notes.some((note) => {
        const key = sourceKey(note);
        const ids = key === null ? undefined : owners.get(key);
        const duplicateSource = ids !== undefined && (ids.size > 1 || !ids.has(note.id));
        return duplicateSource || JSON.stringify(stored.get(note.id)) !== JSON.stringify(expected.get(note.id));
      })) {
        conflict = true;
        transaction.abort();
        return;
      }
      for (const note of notes) store.put(note);
      const folderStore = transaction.objectStore(foldersStore);
      for (const folder of folders) {
        const existing = folderStore.index("path").get(folder.path);
        existing.onsuccess = () => { if (!existing.result) folderStore.put(folder); };
      }
    };
    try { await done; } catch (error) {
      if (conflict) throw new Error("Konflikt importu: vault se během načítání změnil. Zkus import znovu; lokální změny zůstaly zachované.");
      throw error;
    }
  } finally { database.close(); }
}


export async function saveAgentAudit(entry: AgentAuditEntry): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("agentAudit", "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("agentAudit").put(entry);
    await done;
  } finally {
    database.close();
  }
}

export async function listAgentAudit(): Promise<AgentAuditEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("agentAudit", "readonly");
    const done = transactionDone(transaction);
    const entries = await requestToPromise(transaction.objectStore("agentAudit").getAll() as IDBRequest<AgentAuditEntry[]>);
    await done;
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}
