// @vitest-environment node

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { PNG } from "pngjs";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const specDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(specDir, "..", "..");
const cliPath = path.join(projectRoot, "bin", "route-graphics-render.js");
const aliasFixturePath = path.join(
  projectRoot,
  "examples",
  "benchmark-alias.yaml",
);

const readPixel = (png, x, y) => {
  const offset = (png.width * y + x) * 4;

  return png.data.slice(offset, offset + 4);
};

const toHex = (buffer) => {
  return createHash("sha256").update(buffer).digest("hex");
};

const runCliRender = async ({ inputPath, outputPath }) => {
  return await execFileAsync(
    process.execPath,
    [cliPath, inputPath, "-o", outputPath],
    {
      cwd: projectRoot,
      env: process.env,
    },
  );
};

describe("route-graphics-render CLI", () => {
  beforeAll(async () => {
    await execFileAsync("bun", ["run", "build"], {
      cwd: projectRoot,
      env: process.env,
    });
  }, 30_000);

  it("renders a valid PNG from asset aliases", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rtgl-cli-test-"));
    const aliasOutputPath = path.join(tempDir, "alias.png");
    const aliasRun = await runCliRender({
      inputPath: aliasFixturePath,
      outputPath: aliasOutputPath,
    });

    expect(aliasRun.stdout).toContain(`Wrote ${aliasOutputPath}`);
    expect(aliasRun.stdout).toMatch(
      /Timing: render=\d+(?:\.\d+)?(?:ms|s), write=\d+(?:\.\d+)?(?:ms|s), total=\d+(?:\.\d+)?(?:ms|s)/,
    );

    const aliasPngBuffer = await fs.readFile(aliasOutputPath);

    expect(aliasPngBuffer.length).toBeGreaterThan(50_000);
    const aliasPng = PNG.sync.read(aliasPngBuffer);

    expect(aliasPng.width).toBe(1280);
    expect(aliasPng.height).toBe(720);

    expect(Buffer.from(readPixel(aliasPng, 10, 10))).toEqual(
      Buffer.from([0x11, 0x15, 0x1c, 0xff]),
    );
    expect(Buffer.from(readPixel(aliasPng, 780, 480))).toEqual(
      Buffer.from([0x1a, 0x23, 0x30, 0xff]),
    );

    expect(toHex(aliasPngBuffer)).toMatch(/^[0-9a-f]{64}$/);

    const spriteCenterPixel = Buffer.from(readPixel(aliasPng, 108, 192));
    expect(
      spriteCenterPixel.equals(Buffer.from([0x11, 0x15, 0x1c, 0xff])),
    ).toBe(false);
  }, 30_000);

  it("rejects direct file references inside render state", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rtgl-cli-test-"));
    const invalidInputPath = path.join(
      tempDir,
      `invalid-direct-${randomUUID()}.yaml`,
    );
    const outputPath = path.join(tempDir, "invalid.png");

    await fs.writeFile(
      invalidInputPath,
      `
width: 1280
height: 720
elements:
  - id: avatar
    type: sprite
    x: 80
    y: 80
    width: 128
    height: 128
    src: ./assets/hero.png
`,
    );

    let failure;
    try {
      await runCliRender({
        inputPath: invalidInputPath,
        outputPath,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeDefined();
    expect(failure.stderr).toContain(
      "Direct asset references are not supported.",
    );
  });
});
