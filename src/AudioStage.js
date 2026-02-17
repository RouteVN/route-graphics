import { AudioAsset } from "./AudioAsset.js";

const createDefaultAudioContext = () =>
  new (window.AudioContext || window.webkitAudioContext)();

/**
 * Creates an audio player instance
 * @param {Object} params
 * @param {AudioContext} params.audioContext
 * @param {Function} params.getAssetByUrl
 * @param {string} params.id
 * @param {Object} params.options
 * @param {string} params.options.url
 * @param {boolean} [params.options.loop=false]
 * @param {number} [params.options.volume=1.0]
 * @returns {Object} Audio player instance
 */
export const createAudioPlayer = ({ audioContext, getAssetByUrl, id, options }) => {
  let audioSource;
  const gainNode = audioContext.createGain();
  gainNode.gain.value = options.volume ?? 1.0;
  gainNode.connect(audioContext.destination);

  let state = {
    id,
    url: options.url,
    loop: options.loop || false,
    volume: options.volume ?? 1.0,
  };

  const play = () => {
    const audioBuffer = getAssetByUrl(state.url);
    if (!audioBuffer) {
      console.warn("AudioPlayer.play: Asset not found", state.url);
      return;
    }
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.loop = state.loop;
    gainNode.gain.setValueAtTime(state.volume, audioContext.currentTime);
    audioSource.connect(gainNode);
    audioSource.start(0);
  };

  const stop = () => {
    if (audioSource) {
      audioSource.stop();
      audioSource.disconnect();
      gainNode.disconnect();
      gainNode.connect(audioContext.destination);
    }
  };

  const update = (newState) => {
    state = { ...state, ...newState };
  };

  const getId = () => state.id;
  const getUrl = () => state.url;
  const getLoop = () => state.loop;
  const getVolume = () => state.volume;
  const setUrl = (url) => {
    state.url = url;
  };
  const setLoop = (loop) => {
    state.loop = loop;
  };
  const setVolume = (volume) => {
    state.volume = volume;
    gainNode.gain.value = volume;
  };

  return {
    play,
    stop,
    update,
    getId,
    getUrl,
    getLoop,
    getVolume,
    setUrl,
    setLoop,
    setVolume,
    get id() {
      return state.id;
    },
    get url() {
      return state.url;
    },
    get loop() {
      return state.loop;
    },
    get volume() {
      return state.volume;
    },
    gainNode,
  };
};

/**
 * @typedef {Object} AudioElement
 * @property {string} id - The ID of the audio element
 * @property {string} url - The URL of the audio file
 * @property {boolean} [loop=false] - Whether the audio should loop
 * @property {number} [volume=1.0] - Volume between 0 and 1
 */

/**
 * Creates an audio stage instance
 * @returns {Object} Audio stage instance
 */
export const createAudioStage = ({
  audioContext = createDefaultAudioContext(),
  getAssetByUrl = AudioAsset.getAsset,
} = {}) => {
  let audioPlayers = [];
  let stageAudios = [];

  const add = (element) => {
    stageAudios.push(element);
  };

  const remove = (id) => {
    stageAudios = stageAudios.filter((audio) => audio.id !== id);
  };

  const getById = (id) => {
    return stageAudios.find((audio) => audio.id === id);
  };

  const tick = () => {
    for (const audio of stageAudios) {
      const audioPlayer = audioPlayers.find((player) => player.id === audio.id);

      // add
      if (!audioPlayer) {
        const player = createAudioPlayer({
          audioContext,
          getAssetByUrl,
          id: audio.id,
          options: {
            url: audio.url,
            loop: audio.loop,
            volume: audio.volume ?? 1.0,
          },
        });
        audioPlayers.push(player);
        player.play();
        continue;
      }

      // check if need update
      if (audioPlayer.url !== audio.url || audioPlayer.loop !== audio.loop) {
        audioPlayer.stop();
        audioPlayer.setUrl(audio.url);
        audioPlayer.setLoop(audio.loop ?? false);
        audioPlayer.play();
      }

      if (audioPlayer.getVolume() !== (audio.volume ?? 1.0)) {
        audioPlayer.setVolume(audio.volume ?? 1.0);
      }
    }

    // to be removed
    const toRemoveAudioPlayerIds = [];
    for (const player of audioPlayers) {
      if (!stageAudios.find((audio) => audio.id === player.id)) {
        player.stop();
        toRemoveAudioPlayerIds.push(player.id);
      }
    }
    audioPlayers = audioPlayers.filter(
      (player) => !toRemoveAudioPlayerIds.includes(player.id),
    );
  };

  const destroy = () => {
    for (const player of audioPlayers) {
      player.stop();
    }
    audioPlayers = [];
    stageAudios = [];
  };

  const resume = async () => {
    if (audioContext.state === "running") {
      return;
    }

    try {
      await audioContext.resume();
    } catch (error) {
      console.warn("Failed to resume audio context:", error);
    }
  };

  return {
    add,
    remove,
    getById,
    tick,
    resume,
    destroy,
  };
};

export const AudioStage = createAudioStage;
