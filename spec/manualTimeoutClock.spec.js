import { describe, expect, it } from "vitest";
import { createManualTimeoutClock } from "../vt/static/manualTimeoutClock.js";

describe("VT manual timeout clock", () => {
  it("advances async reveal loops by elapsed time and honors cancellation", async () => {
    const host = { setTimeout, clearTimeout };
    const clock = createManualTimeoutClock(host);
    clock.install();
    clock.install();
    const canceled = host.setTimeout(() => {
      throw new Error("Canceled timeout ran");
    }, 10);
    host.clearTimeout(canceled);

    let revealed = 0;
    const reveal = async () => {
      for (let index = 0; index < 5; index++) {
        await new Promise((resolve) => host.setTimeout(resolve, 20));
        revealed++;
      }
    };
    const done = reveal();
    clock.advance(45);
    await clock.idle();
    expect(revealed).toBe(2);
    clock.advance(15);
    await clock.idle();
    expect(revealed).toBe(3);
    clock.advance(40);
    await clock.idle();
    await done;
    expect(revealed).toBe(5);
  });
});
