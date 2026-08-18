// Lightweight in-memory store to pass scan data between screens
// (avoids stuffing large base64 payloads through router params).

export interface ScanDraft {
  uri?: string;
  base64?: string;
  result?: any; // AI extraction result
  imagePath?: string; // uploaded storage path
}

let draft: ScanDraft = {};

export const scanStore = {
  set(partial: Partial<ScanDraft>) {
    draft = { ...draft, ...partial };
  },
  get(): ScanDraft {
    return draft;
  },
  clear() {
    draft = {};
  },
};
