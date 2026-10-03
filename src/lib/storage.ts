import type { Note, VaultFolder } from "../types";

const databaseName = "ethical-world";
const databaseVersion = 2;
const notesStore = "notes";
const foldersStore = "folders";

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

      if (!database.objectStoreNames.contains(notesStore)) {
        const store = database.createObjectStore(notesStore, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains(foldersStore)) {
        const store = database.createObjectStore(foldersStore, { keyPath: "id" });
        store.createIndex("path", "path", { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

export async function listNotes(): Promise<Note[]> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readonly");
  const notes = await requestToPromise(transaction.objectStore(notesStore).getAll() as IDBRequest<Note[]>);
  await transactionDone(transaction);
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
  const store = transaction.objectStore(notesStore);

  for (const note of notes) {
    store.put(note);
  }

  await transactionDone(transaction);
  database.close();
}

export async function removeNote(noteId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readwrite");
  transaction.objectStore(notesStore).delete(noteId);
  await transactionDone(transaction);
  database.close();
}

export async function listFolders(): Promise<VaultFolder[]> {
  const database = await openDatabase();
  const transaction = database.transaction(foldersStore, "readonly");
  const folders = await requestToPromise(
    transaction.objectStore(foldersStore).getAll() as IDBRequest<VaultFolder[]>
  );
  await transactionDone(transaction);
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
  const store = transaction.objectStore(foldersStore);

  for (const folder of folders) {
    store.put(folder);
  }

  await transactionDone(transaction);
  database.close();
}

export async function removeFolder(folderId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(foldersStore, "readwrite");
  transaction.objectStore(foldersStore).delete(folderId);
  await transactionDone(transaction);
  database.close();
}
