let audioContext: AudioContext | undefined;

export function playTypewriterKey(key: string, volume = 0.7): void {
  if (typeof window === 'undefined') return;
  if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;
  if (volume <= 0) return;

  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === 'suspended') void audioContext.resume();

  const now = audioContext.currentTime;
  const duration = key === 'Enter' ? 0.055 : key === 'Backspace' ? 0.04 : 0.032;
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const buffer = audioContext.createBuffer(1, Math.max(1, audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  const pitch = key === 'Enter' ? 0.36 : key === 'Backspace' ? 0.48 : 0.72 + Math.random() * 0.18;

  for (let index = 0; index < data.length; index += 1) {
    const envelope = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * envelope * pitch;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = key === 'Enter' ? 760 : key === 'Backspace' ? 1200 : 1800 + Math.random() * 420;
  filter.Q.value = 8;
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime((key === 'Enter' ? 0.16 : 0.1) * normalizedVolume, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start(now);
  source.stop(now + duration);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
