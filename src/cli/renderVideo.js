import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import { chromium } from "playwright";

import { getRendererBrowserLaunchOptions } from "./browserLaunch.js";
import { parseStateSelection } from "./stateSelection.js";

const createWriteStreamChunkBinding = async (page, outputPath) => {
  const stream = fs.createWriteStream(outputPath);

  await page.exposeBinding(
    "__routeGraphicsWriteVideoChunk",
    async (_source, base64) => {
      const buffer = Buffer.from(base64, "base64");
      await new Promise((resolve, reject) => {
        stream.write(buffer, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  );

  return () =>
    new Promise((resolve, reject) => {
      stream.end((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
};

const captureVideoWebm = async ({
  origin,
  width,
  height,
  backgroundColor,
  states,
  stateIndexes,
  browserAssets,
  fps,
  holdMS,
  initialHoldMS,
  finalHoldMS,
  maxStateDurationMS,
  browserExecutablePath,
  webmPath,
}) => {
  const browser = await chromium.launch(
    getRendererBrowserLaunchOptions(browserExecutablePath),
  );

  try {
    const page = await browser.newPage({
      viewport: {
        width,
        height,
      },
    });
    const pageErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.stack ?? error.message);
    });

    await page.goto(origin, {
      waitUntil: "domcontentloaded",
    });

    const closeChunkStream = await createWriteStreamChunkBinding(
      page,
      webmPath,
    );

    let chunkStreamClosed = false;
    const closeChunksOnce = async () => {
      if (chunkStreamClosed) {
        return;
      }
      chunkStreamClosed = true;
      await closeChunkStream();
    };

    try {
      const result = await page.evaluate(
        async ({ moduleUrl, renderPayload }) => {
          const sleep = (ms) =>
            new Promise((resolve) => {
              window.setTimeout(resolve, Math.max(0, ms));
            });

          const nextFrame = async (count = 2) => {
            await new Promise((resolve) => {
              let remaining = count;
              const tick = () => {
                if (remaining <= 0) {
                  resolve();
                  return;
                }
                remaining -= 1;
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
          };

          const bytesToBase64 = (bytes) => {
            let binary = "";
            const chunkSize = 0x8000;
            for (let index = 0; index < bytes.length; index += chunkSize) {
              binary += String.fromCharCode(
                ...bytes.subarray(index, index + chunkSize),
              );
            }
            return btoa(binary);
          };

          const getRecorderMimeType = () => {
            const candidates = [
              "video/webm;codecs=vp9",
              "video/webm;codecs=vp8",
              "video/webm",
            ];

            return candidates.find((candidate) =>
              MediaRecorder.isTypeSupported(candidate),
            );
          };

          if (typeof MediaRecorder === "undefined") {
            throw new Error("MediaRecorder is not available in this browser.");
          }

          const recorderMimeType = getRecorderMimeType();
          if (!recorderMimeType) {
            throw new Error(
              "No supported WebM MediaRecorder codec is available.",
            );
          }

          const routeGraphicsModule = await import(moduleUrl);
          const {
            default: createRouteGraphics,
            animatedSpritePlugin,
            containerPlugin,
            createAssetBufferManager,
            inputPlugin,
            particlesPlugin,
            rectPlugin,
            sliderPlugin,
            soundPlugin,
            spritePlugin,
            textPlugin,
            textRevealingPlugin,
            tweenPlugin,
            videoPlugin,
          } = routeGraphicsModule;

          const app = createRouteGraphics();
          const assetBufferManager = createAssetBufferManager();
          const pendingRenderWaiters = [];

          const createRenderCompleteWaiter = (stateId) =>
            new Promise((resolve, reject) => {
              let waiter;
              const timeoutId = window.setTimeout(() => {
                const waiterIndex = pendingRenderWaiters.findIndex(
                  (candidate) => candidate === waiter,
                );
                if (waiterIndex >= 0) {
                  pendingRenderWaiters.splice(waiterIndex, 1);
                }
                reject(
                  new Error(
                    `Timed out waiting for renderComplete for state "${stateId}".`,
                  ),
                );
              }, renderPayload.maxStateDurationMS);

              waiter = {
                stateId,
                resolve: (payload) => {
                  window.clearTimeout(timeoutId);
                  resolve(payload);
                },
                reject: (error) => {
                  window.clearTimeout(timeoutId);
                  reject(error);
                },
              };
              pendingRenderWaiters.push(waiter);
            });

          try {
            await app.init({
              width: renderPayload.width,
              height: renderPayload.height,
              backgroundColor: renderPayload.backgroundColor,
              animationPlaybackMode: "auto",
              plugins: {
                elements: [
                  textPlugin,
                  rectPlugin,
                  spritePlugin,
                  videoPlugin,
                  sliderPlugin,
                  inputPlugin,
                  containerPlugin,
                  textRevealingPlugin,
                  animatedSpritePlugin,
                  particlesPlugin,
                ].filter(Boolean),
                animations: [tweenPlugin].filter(Boolean),
                audio: [soundPlugin].filter(Boolean),
              },
              eventHandler: (eventName, payload) => {
                if (eventName !== "renderComplete") {
                  return;
                }

                const waiterIndex = pendingRenderWaiters.findIndex(
                  (waiter) =>
                    payload?.aborted !== true &&
                    (waiter.stateId === payload?.id ||
                      waiter.stateId === undefined),
                );

                if (waiterIndex < 0) {
                  return;
                }

                const [waiter] = pendingRenderWaiters.splice(waiterIndex, 1);
                waiter.resolve(payload);
              },
              debug: false,
            });

            if (Object.keys(renderPayload.assets).length > 0) {
              await assetBufferManager.load(renderPayload.assets);
              await app.loadAssets(assetBufferManager.getBufferMap());
            }

            document.body.replaceChildren(app.canvas);
            await nextFrame(2);

            const stream = app.canvas.captureStream(renderPayload.fps);
            const recorder = new MediaRecorder(stream, {
              mimeType: recorderMimeType,
            });
            const chunkWrites = [];
            const stopped = new Promise((resolve, reject) => {
              recorder.addEventListener("stop", resolve, { once: true });
              recorder.addEventListener("error", (event) => {
                reject(event.error ?? new Error("MediaRecorder failed."));
              });
            });

            recorder.addEventListener("dataavailable", (event) => {
              if (!event.data || event.data.size === 0) {
                return;
              }

              chunkWrites.push(
                (async () => {
                  const buffer = await event.data.arrayBuffer();
                  const base64 = bytesToBase64(new Uint8Array(buffer));
                  await window.__routeGraphicsWriteVideoChunk(base64);
                })(),
              );
            });

            recorder.start(250);

            try {
              for (
                let renderIndex = 0;
                renderIndex < renderPayload.stateIndexes.length;
                renderIndex += 1
              ) {
                const stateIndex = renderPayload.stateIndexes[renderIndex];
                const state = renderPayload.states[stateIndex];
                const waitForComplete = createRenderCompleteWaiter(state.id);

                app.render(state);
                app.render(state);
                await waitForComplete;

                const isFinal =
                  renderIndex === renderPayload.stateIndexes.length - 1;
                const hold = isFinal
                  ? renderPayload.finalHoldMS
                  : renderIndex === 0
                    ? renderPayload.initialHoldMS
                    : renderPayload.holdMS;

                if (hold > 0) {
                  await sleep(hold);
                }
              }

              await nextFrame(2);
            } finally {
              if (recorder.state !== "inactive") {
                recorder.stop();
              }
              await stopped;
              await Promise.all(chunkWrites);
              stream.getTracks().forEach((track) => {
                track.stop();
              });
            }

            return {
              mimeType: recorderMimeType,
            };
          } finally {
            pendingRenderWaiters.splice(0).forEach((waiter) => {
              waiter.reject(
                new Error("Render session ended before completion."),
              );
            });
            app.destroy();
          }
        },
        {
          moduleUrl: `${origin}/dist/RouteGraphics.js`,
          renderPayload: {
            width,
            height,
            backgroundColor,
            states,
            stateIndexes,
            assets: browserAssets,
            fps,
            holdMS,
            initialHoldMS,
            finalHoldMS,
            maxStateDurationMS,
          },
        },
      );

      await closeChunksOnce();

      if (pageErrors.length > 0) {
        throw new Error(pageErrors.join("\n"));
      }

      return result;
    } catch (error) {
      await closeChunksOnce();
      throw error;
    }
  } finally {
    await browser.close();
  }
};

const runProcess = async (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");

      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with code ${code}.\n${stderrText || stdoutText}`,
          ),
        );
        return;
      }

      resolve({ stdout: stdoutText, stderr: stderrText });
    });
  });

const transcodeWebmToMp4 = async ({ ffmpegPath, inputPath, outputPath }) => {
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
  await runProcess(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
};

export const renderMp4 = async ({
  cliOptions,
  definition,
  inputPath,
  outputPath,
  origin,
  browserAssets,
  width,
  height,
  backgroundColor,
}) => {
  const stateIndexes = parseStateSelection(
    cliOptions.stateSelection,
    definition.states.length,
  );
  const tempDir = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), "route-graphics-video-"),
  );
  const webmPath = path.join(tempDir, "capture.webm");
  const ffmpegPath = cliOptions.ffmpegPath ?? "ffmpeg";

  try {
    const renderStartedAt = performance.now();
    const captureInfo = await captureVideoWebm({
      origin,
      width,
      height,
      backgroundColor,
      states: definition.states,
      stateIndexes,
      browserAssets,
      fps: cliOptions.fps ?? 30,
      holdMS: cliOptions.holdMS ?? 0,
      initialHoldMS: cliOptions.initialHoldMS ?? cliOptions.holdMS ?? 0,
      finalHoldMS: cliOptions.finalHoldMS ?? 1000,
      maxStateDurationMS:
        cliOptions.maxStateDurationMS ?? cliOptions.timeoutMS ?? 15000,
      browserExecutablePath: cliOptions.browserExecutablePath,
      webmPath,
    });
    const renderDurationMS = performance.now() - renderStartedAt;

    const writeStartedAt = performance.now();
    await transcodeWebmToMp4({
      ffmpegPath,
      inputPath: webmPath,
      outputPath,
    });
    const writeDurationMS = performance.now() - writeStartedAt;

    return {
      inputPath,
      outputPath,
      renderDurationMS,
      writeDurationMS,
      captureMimeType: captureInfo.mimeType,
      stateCount: stateIndexes.length,
    };
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
};
