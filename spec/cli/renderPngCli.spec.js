// @vitest-environment node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
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
const directFixturePath = path.join(
  projectRoot,
  "examples",
  "benchmark-direct.yaml",
);
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

  it("renders identical PNG output for direct paths and asset aliases", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rtgl-cli-test-"));
    const directOutputPath = path.join(tempDir, "direct.png");
    const aliasOutputPath = path.join(tempDir, "alias.png");

    const directRun = await runCliRender({
      inputPath: directFixturePath,
      outputPath: directOutputPath,
    });
    const aliasRun = await runCliRender({
      inputPath: aliasFixturePath,
      outputPath: aliasOutputPath,
    });

    expect(directRun.stdout).toContain(`Wrote ${directOutputPath}`);
    expect(aliasRun.stdout).toContain(`Wrote ${aliasOutputPath}`);
    expect(directRun.stdout).toMatch(
      /Timing: render=\d+(?:\.\d+)?(?:ms|s), write=\d+(?:\.\d+)?(?:ms|s), total=\d+(?:\.\d+)?(?:ms|s)/,
    );
    expect(aliasRun.stdout).toMatch(
      /Timing: render=\d+(?:\.\d+)?(?:ms|s), write=\d+(?:\.\d+)?(?:ms|s), total=\d+(?:\.\d+)?(?:ms|s)/,
    );

    const directPngBuffer = await fs.readFile(directOutputPath);
    const aliasPngBuffer = await fs.readFile(aliasOutputPath);

    expect(directPngBuffer.length).toBeGreaterThan(50_000);
    expect(aliasPngBuffer.length).toBeGreaterThan(50_000);
    expect(toHex(directPngBuffer)).toBe(toHex(aliasPngBuffer));

    const directPng = PNG.sync.read(directPngBuffer);
    const aliasPng = PNG.sync.read(aliasPngBuffer);

    expect(directPng.width).toBe(1280);
    expect(directPng.height).toBe(720);
    expect(aliasPng.width).toBe(1280);
    expect(aliasPng.height).toBe(720);

    expect(Buffer.from(readPixel(directPng, 10, 10))).toEqual(
      Buffer.from([0x11, 0x15, 0x1c, 0xff]),
    );
    expect(Buffer.from(readPixel(directPng, 780, 480))).toEqual(
      Buffer.from([0x1a, 0x23, 0x30, 0xff]),
    );

    const spriteCenterPixel = Buffer.from(readPixel(directPng, 108, 192));
    expect(
      spriteCenterPixel.equals(Buffer.from([0x11, 0x15, 0x1c, 0xff])),
    ).toBe(false);
  }, 30_000);
});
