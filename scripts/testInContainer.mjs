import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Runs `bun run test` the way CI does. Text is measured by scanning rendered
// pixels, so macOS and Linux disagree by 1px in some specs, and CI is Linux.
// On Linux this runs the tests directly. Elsewhere it runs them in a Linux
// container, so a push is judged by the same environment as CI. Without Docker
// it falls back to running them here, where those specs may fail.
const root = fileURLToPath(new URL("../", import.meta.url));
const IMAGE = "route-graphics-test";
const BUN_CACHE_VOLUME = "route-graphics-test-bun-cache";

const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });

const runLocally = () => {
  process.exit(run("bun", ["run", "test"]).status ?? 1);
};

if (process.platform === "linux") {
  runLocally();
}

if (run("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  console.warn(
    "Docker is not available, so the tests run on this machine. Specs that measure text may fail here and pass in CI.",
  );
  runLocally();
}

const font = readFileSync(
  new URL("../spec/assets/fonts/NotoSans-Regular.ttf", import.meta.url),
  "utf8",
);
if (font.startsWith("version https://git-lfs")) {
  console.error(
    "The test fonts and fixtures are Git LFS pointers. Run `git lfs install --skip-repo` and `git lfs pull` first.",
  );
  process.exit(1);
}

const { dependencies } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const build = run("docker", [
  "build",
  "--quiet",
  "--tag",
  IMAGE,
  "--build-arg",
  `PLAYWRIGHT_VERSION=${dependencies.playwright}`,
  "--file",
  "docker/test.Dockerfile",
  "docker",
]);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// The container works on a copy, so its Linux node_modules and any files the
// tests write never touch this checkout.
const script = [
  "set -e",
  "mkdir /work",
  "tar -C /src --exclude=./node_modules --exclude=./.git --exclude=./dist -cf - . | tar -C /work -xf -",
  "cd /work",
  "bun install --frozen-lockfile",
  "bun run test",
].join("\n");
const test = run("docker", [
  "run",
  "--rm",
  "--volume",
  `${root}:/src:ro`,
  "--volume",
  `${BUN_CACHE_VOLUME}:/root/.bun/install/cache`,
  IMAGE,
  "sh",
  "-c",
  script,
]);
process.exit(test.status ?? 1);
