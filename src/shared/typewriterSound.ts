import returnBellUrl from '../assets/typewriter-return-bell.mp3';

let audioContext: AudioContext | undefined;
let returnBellAudio: HTMLAudioElement | undefined;

function getAudioContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return undefined;
  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

export function playTypewriterKey(key: string, volume = 0.7, bellVolume = volume): void {
  if (typeof window === 'undefined') return;
  if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;
  if (key === 'Enter') {
    playTypewriterReturnBell(bellVolume);
    return;
  }
  if (volume <= 0) return;

  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const duration = key === 'Backspace' ? 0.04 : 0.032;
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const buffer = context.createBuffer(1, Math.max(1, context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  const pitch = key === 'Backspace' ? 0.48 : 0.72 + Math.random() * 0.18;

  for (let index = 0; index < data.length; index += 1) {
    const envelope = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * envelope * pitch;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = key === 'Backspace' ? 1200 : 1800 + Math.random() * 420;
  filter.Q.value = 8;
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.1 * normalizedVolume, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  source.stop(now + duration);
}

export function playTypewriterReturnBell(volume = 0.7): void {
  if (volume <= 0) return;
  const normalizedVolume = Math.max(0, Math.min(1, volume));
  if (typeof Audio === 'undefined') return;

  returnBellAudio ??= new Audio(returnBellUrl);
  returnBellAudio.preload = 'auto';
  const bell = returnBellAudio.cloneNode(true) as HTMLAudioElement;
  bell.volume = normalizedVolume;
  bell.currentTime = 0;
  void bell.play().catch(() => {
    // The keystroke sound is decorative; blocked playback should never interrupt writing.
  });
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
