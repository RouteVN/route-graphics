import { createAssetBufferManager } from "./util/createAssetBufferManager.js";
import parse from "./parser/index.js";
import { Application, Assets } from "pixi.js";
import parseJSONToAST from "./parser/index.js";
import { AudioAsset } from "./AudioAsset.js";
import { createElementPlugin } from "./plugins/elements/elementPlugin.js";
import { createAnimationPlugin } from "./plugins/animations/animationPlugin.js";
import { createAudioPlugin } from "./plugins/audio/audioPlugin.js";
import { textPlugin } from "./plugins/elements/text";
import { rectPlugin } from "./plugins/elements/rect";
import { spritePlugin } from "./plugins/elements/sprite";
import { sliderPlugin } from "./plugins/elements/slider";
import { containerPlugin } from "./plugins/elements/container";
import { textRevealingPlugin } from "./plugins/elements/text-revealing";
import { gifPlugin } from "./plugins/elements/gif/index.js";
import { tweenPlugin } from "./plugins/animations/tween";
import { soundPlugin } from "./plugins/audio/sound";
import { renderElements } from "./plugins/renderElements.js";
import { renderAudio } from "./plugins/renderAudio.js";
import createRouteGraphics from "./RouteGraphics.js";

export default createRouteGraphics;

export {
  Application,
  Assets,
  AudioAsset,
  parse,
  parseJSONToAST,
  createAssetBufferManager,
  createElementPlugin,
  createAnimationPlugin,
  createAudioPlugin,
  textPlugin,
  rectPlugin,
  spritePlugin,
  sliderPlugin,
  containerPlugin,
  textRevealingPlugin,
  gifPlugin,
  tweenPlugin,
  soundPlugin,
  renderElements,
  renderAudio,
};
