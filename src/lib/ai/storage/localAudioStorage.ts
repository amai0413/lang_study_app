import { promises as fs } from "fs";
import path from "path";
import type { AudioExtension } from "@/lib/ai/types";

const AUDIO_CACHE_DIR = path.join(process.cwd(), "public", "audio-cache");

const CONTENT_TYPES: Record<AudioExtension, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export interface AudioStorageFile {
  cacheKey: string;
  extension: AudioExtension;
  filePath: string;
  audioUrl: string;
  contentType: string;
}

function fileFor(cacheKey: string, extension: AudioExtension): AudioStorageFile {
  return {
    cacheKey,
    extension,
    filePath: path.join(AUDIO_CACHE_DIR, `${cacheKey}.${extension}`),
    audioUrl: `/audio-cache/${cacheKey}.${extension}`,
    contentType: CONTENT_TYPES[extension],
  };
}

async function ensureCacheDir() {
  await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
}

export async function findLocalAudio(cacheKey: string): Promise<AudioStorageFile | null> {
  for (const extension of ["mp3", "wav"] as const) {
    const file = fileFor(cacheKey, extension);
    try {
      await fs.access(file.filePath);
      return file;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

export async function writeLocalAudio(
  cacheKey: string,
  audioBuffer: Buffer,
  extension: AudioExtension,
): Promise<AudioStorageFile> {
  await ensureCacheDir();
  const file = fileFor(cacheKey, extension);
  await fs.writeFile(file.filePath, audioBuffer);
  return file;
}

export async function readLocalAudio(file: AudioStorageFile): Promise<Buffer> {
  return fs.readFile(file.filePath);
}
