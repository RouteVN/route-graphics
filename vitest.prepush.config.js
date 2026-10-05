import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.js'

// The tests the pre-push hook runs: everything except the specs whose result
// depends on the machine, so a push is never refused for a reason that is not
// in the change. CI runs the full suite on Linux with `bun run test`.
//
// - parseText and parseTextRevealing assert text heights that Pixi measures by
//   scanning rendered pixels. macOS and Linux differ by 1px there.
// - renderPngCli renders through Chromium and compares against fixtures in Git
//   LFS.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [
        ...configDefaults.exclude,
        'spec/parser/parseText.test.yaml',
        'spec/parser/parseTextRevealing.test.yaml',
        'spec/cli/renderPngCli.spec.js'
      ]
    }
  })
)
