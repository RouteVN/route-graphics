import { AudioAsset } from "./AudioAsset";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Creates an audio player instance
 * @param {string} id
 * @param {Object} options
 * @param {string} options.url
 * @param {boolean} [options.loop=false]
 * @param {number} [options.volume=1.0]
 * @returns {Object} Audio player instance
 */
export const createAudioPlayer = (id, options) => {
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
    const audioBuffer = AudioAsset.getAsset(state.url);
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
    id: state.id,
    url: state.url,
    loop: state.loop,
    volume: state.volume,
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
export const createAudioStage = () => {
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
        console.log('[AudioStage] Creating player with volume:', audio.volume);
        const player = createAudioPlayer(audio.id, {
          url: audio.url,
          loop: audio.loop,
          volume: audio.volume ?? 1.0,
        });
        audioPlayers.push(player);
        player.play();
        return;
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

  return {
    add,
    remove,
    getById,
    tick,
    destroy,
  };
};

export const AudioStage = createAudioStage;
