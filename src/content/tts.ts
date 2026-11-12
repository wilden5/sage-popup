// ---- text-to-speech for AI-explained phrases (no dictionary MP3 exists
// for arbitrary selections, so use the browser's built-in TTS voices)

import { stopAudio } from "./audio";

let speechActive = false;

/** Speak `text` with a browser voice matching `lang` (en-GB / en-US). */
export function speakText(text: string, lang: string): void {
  stopAudio();
  stopSpeech();
  if (!text || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95; // slightly slower than the default 1.0 for learners
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => (v.lang || "").replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()));
  if (voice) utterance.voice = voice; // fall back to the engine default otherwise
  utterance.onend = () => {
    speechActive = false;
  };
  utterance.onerror = () => {
    speechActive = false;
  };
  speechActive = true;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if ("speechSynthesis" in window && speechActive) {
    window.speechSynthesis.cancel();
  }
  speechActive = false;
}
