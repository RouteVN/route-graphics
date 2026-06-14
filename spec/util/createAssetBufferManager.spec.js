import { afterEach, describe, expect, it, vi } from "vitest";
import { createAssetBufferManager } from "../../src/util/createAssetBufferManager.js";

describe("createAssetBufferManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects failed fetches with asset key, type, URL, and HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      ),
    );

    const manager = createAssetBufferManager();

    let thrownError;
    try {
      await manager.load({
        themeMusic: {
          url: "https://cdn.example.test/theme.mp3",
          type: "audio/mpeg",
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe(
      'Could not load asset "themeMusic". File not found.',
    );
    expect(thrownError?.details).toEqual(
      expect.objectContaining({
        assetKey: "themeMusic",
        type: "audio/mpeg",
        url: "https://cdn.example.test/theme.mp3",
        cause: "HTTP 404 Not Found",
      }),
    );
  });

  it("rejects missing asset URLs with asset key and root cause", async () => {
    const manager = createAssetBufferManager();

    await expect(
      manager.load({
        brokenAsset: {
          type: "audio/mpeg",
        },
      }),
    ).rejects.toThrow('Could not load asset "brokenAsset". Missing file URL.');
  });
});
