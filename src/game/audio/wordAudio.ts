/**
 * Word audio behind a small interface so game logic never touches <audio> or
 * speechSynthesis directly. Providers are tried in order: bundled MP3
 * (consistent pronunciation, precached for offline), then browser speech
 * (PROVISIONAL: quality and availability differ in Android WebView). Ported
 * from the source project's AudioProvider.
 */
export interface Pronounceable {
  readonly itemId: string;
  readonly target: string;
}

export type PlayOutcome = "played" | "unavailable" | "failed";

export interface AudioProvider {
  readonly name: string;
  play(word: Pronounceable): Promise<PlayOutcome>;
  stop(): void;
}

export interface MediaElementLike {
  play(): Promise<void>;
  pause(): void;
}

export const WORD_AUDIO_PATH = "/audio/words/";

export function wordAudioUrl(target: string): string {
  return `${WORD_AUDIO_PATH}${encodeURIComponent(target)}.mp3`;
}

export function bundledAudioProvider(
  createElement: (src: string) => MediaElementLike = (src) => new Audio(src),
): AudioProvider {
  let current: MediaElementLike | null = null;
  return {
    name: "bundled",
    async play({ target }) {
      current?.pause();
      const element = createElement(wordAudioUrl(target));
      current = element;
      try {
        await element.play();
        return "played";
      } catch {
        return "failed";
      }
    },
    stop() {
      current?.pause();
      current = null;
    },
  };
}

export interface SpeechLike {
  speak(utterance: { rate: number; lang: string }): void;
  cancel(): void;
}

export function speechAudioProvider(
  speech: SpeechLike | undefined,
  createUtterance: (text: string) => { rate: number; lang: string },
): AudioProvider {
  return {
    name: "speech",
    async play({ target }) {
      if (!speech) return "unavailable";
      try {
        speech.cancel();
        const utterance = createUtterance(target);
        utterance.lang = "en-US";
        utterance.rate = 0.8;
        speech.speak(utterance);
        return "played";
      } catch {
        return "failed";
      }
    },
    stop() {
      speech?.cancel();
    },
  };
}

/** Tries each provider in turn, stopping previous sound first so playback never overlaps. */
export function fallbackAudioProvider(providers: readonly AudioProvider[]): AudioProvider {
  return {
    name: providers.map((p) => p.name).join(">"),
    async play(word) {
      for (const p of providers) p.stop();
      let outcome: PlayOutcome = "unavailable";
      for (const provider of providers) {
        const result = await provider.play(word);
        if (result === "played") return "played";
        if (result === "failed") outcome = "failed";
      }
      return outcome;
    },
    stop() {
      for (const p of providers) p.stop();
    },
  };
}

interface SpeechWindowLike {
  speechSynthesis?: SpeechLike;
  SpeechSynthesisUtterance?: new (text: string) => { rate: number; lang: string };
  Audio?: new (src: string) => MediaElementLike;
}

export function createDefaultAudioProvider(win: SpeechWindowLike | undefined): AudioProvider {
  if (!win) return fallbackAudioProvider([]);
  const providers: AudioProvider[] = [];
  const AudioCtor = win.Audio;
  if (AudioCtor) providers.push(bundledAudioProvider((src) => new AudioCtor(src)));
  const Utterance = win.SpeechSynthesisUtterance;
  providers.push(
    speechAudioProvider(win.speechSynthesis, (text) =>
      Utterance ? new Utterance(text) : { rate: 1, lang: "en" },
    ),
  );
  return fallbackAudioProvider(providers);
}
