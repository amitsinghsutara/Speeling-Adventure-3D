import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCurriculum } from "@/learning/loadCurriculum";

const AUDIO_DIR = path.resolve(process.cwd(), "public/audio/words");

describe("word audio coverage", () => {
  const targets = new Set(loadCurriculum().items.map((i) => i.target));

  it("every target word has a bundled MP3", () => {
    const missing = [...targets].filter((t) => !fs.existsSync(path.join(AUDIO_DIR, `${t}.mp3`)));
    expect(missing).toEqual([]);
  });

  it("there are no empty or orphan audio files", () => {
    const files = fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith(".mp3"));
    expect(files.map((f) => f.replace(/\.mp3$/, "")).filter((w) => !targets.has(w))).toEqual([]);
    const empty = files.filter((f) => fs.statSync(path.join(AUDIO_DIR, f)).size === 0);
    expect(empty).toEqual([]);
  });
});
