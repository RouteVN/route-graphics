export default function playAudio(url, volume = 1.0){
    const audioBuffer = AudioAsset.getAsset(url);
    if (!audioBuffer) {
      throw new Error("Audio asset not found: ", url);
    }

    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = audioBuffer;
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
}
