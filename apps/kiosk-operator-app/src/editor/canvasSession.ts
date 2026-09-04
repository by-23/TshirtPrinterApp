/**
 * Generation token for the in-memory editor session.
 *
 * Page transitions keep the old editor mounted while the gallery (and then
 * the next editor) is already on screen. The dying canvas must not write
 * snapshots into a session that has already been cleared.
 */
let sessionId = 0;

export function getCanvasSessionId(): number {
  return sessionId;
}

export function discardCanvasSession(): number {
  sessionId += 1;
  return sessionId;
}

export function isLiveCanvasSession(token: number): boolean {
  return token === sessionId;
}
