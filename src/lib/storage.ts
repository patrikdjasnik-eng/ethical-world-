import type { Note } from "../types";

const databaseName = "ethical-world";
const databaseVersion = 1;
const notesStore = "notes";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

export async function listNotes(): Promise<Note[]> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readonly");
  const notes = await requestToPromise(transaction.objectStore(notesStore).getAll() as IDBRequest<Note[]>);
  database.close();

  return notes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveNote(note: Note): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readwrite");
  await requestToPromise(transaction.objectStore(notesStore).put(note));
  database.close();
}

export async function removeNote(noteId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(notesStore, "readwrite");
  await requestToPromise(transaction.objectStore(notesStore).delete(noteId));
  database.close();
}
