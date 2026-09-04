import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discardCanvasSession, getCanvasSessionId, isLiveCanvasSession } from "./canvasSession.js";

describe("canvasSession", () => {
  it("invalidates writes from a canvas created before reset", () => {
    const dying = getCanvasSessionId();
    assert.equal(isLiveCanvasSession(dying), true);

    discardCanvasSession();
    const next = getCanvasSessionId();

    assert.equal(isLiveCanvasSession(dying), false);
    assert.equal(isLiveCanvasSession(next), true);
    assert.notEqual(dying, next);
  });
});
