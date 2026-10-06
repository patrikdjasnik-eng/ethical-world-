import type { Note } from "../types";

export class NoteWriteQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly write: (note: Note) => Promise<void>) {}

  enqueue(note: Note): Promise<void> {
    const snapshot = { ...note };
    const task = this.tail.catch(() => undefined).then(() => this.write(snapshot));
    this.tail = task;
    return task;
  }

  async flush(): Promise<void> {
    await this.tail;
  }
}
