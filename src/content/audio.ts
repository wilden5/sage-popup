/** Pronunciation MP3 playback for dictionary entries (one at a time). */

let currentAudio: HTMLAudioElement | null = null;

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function playAudio(url: string): void {
  stopAudio();
  currentAudio = new Audio(url);
  currentAudio.play().catch(() => {}); // ignore autoplay/network errors
}
