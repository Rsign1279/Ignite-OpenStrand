import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { strandIds } from "../src/config/strands";

function atoms(buffer: Buffer, start = 0, end = buffer.length) {
  const found: { type: string; start: number; end: number }[] = [];
  for (let offset = start; offset + 8 <= end;) {
    const size = buffer.readUInt32BE(offset);
    if (size < 8 || offset + size > end) throw new Error("Truncated film atom");
    found.push({
      type: buffer.toString("ascii", offset + 4, offset + 8),
      start: offset,
      end: offset + size,
    });
    offset += size;
  }
  return found;
}

describe("original strand scene media", () => {
  it("ships ten distinct, complete, fast-start H.264 films and their WebP posters", async () => {
    const hashes = new Set<string>();
    for (const strand of strandIds) {
      const film = await readFile(
        new URL(`../public/films/${strand}.mp4`, import.meta.url),
      );
      expect(
        film.length,
        `${strand} has a bounded complete film`,
      ).toBeGreaterThan(50_000);
      expect(film.length).toBeLessThan(2_000_000);
      const top = atoms(film);
      expect(top[0].type).toBe("ftyp");
      const movie = top.find((atom) => atom.type === "moov")!;
      const media = top.find((atom) => atom.type === "mdat")!;
      expect(movie, `${strand} movie metadata`).toBeDefined();
      expect(media, `${strand} media payload`).toBeDefined();
      expect(
        movie.start,
        `${strand} starts without downloading the entire film`,
      ).toBeLessThan(media.start);
      const header = atoms(film, movie.start + 8, movie.end).find(
        (atom) => atom.type === "mvhd",
      )!;
      expect(header).toBeDefined();
      const version = film[header.start + 8];
      expect(version).toBe(0);
      const seconds =
        film.readUInt32BE(header.start + 24) /
        film.readUInt32BE(header.start + 20);
      expect(
        seconds,
        `${strand} delivers its complete 12-second scene`,
      ).toBeCloseTo(12, 2);
      expect(
        film.includes(Buffer.from("avc1")),
        `${strand} browser-compatible H.264`,
      ).toBe(true);
      const tracks = atoms(film, movie.start + 8, movie.end).filter(
        (atom) => atom.type === "trak",
      );
      const handlers: string[] = [];
      for (const track of tracks) {
        const media = atoms(film, track.start + 8, track.end).find(
          (atom) => atom.type === "mdia",
        )!;
        expect(media, `${strand} track metadata`).toBeDefined();
        const metadata = atoms(film, media.start + 8, media.end);
        const handler = metadata.find((atom) => atom.type === "hdlr")!;
        const type = film.toString(
          "ascii",
          handler.start + 16,
          handler.start + 20,
        );
        handlers.push(type);
        if (type !== "vide") continue;
        const mediaHeader = metadata.find((atom) => atom.type === "mdhd")!;
        expect(film[mediaHeader.start + 8]).toBe(0);
        const timescale = film.readUInt32BE(mediaHeader.start + 20);
        const information = metadata.find((atom) => atom.type === "minf")!;
        const table = atoms(film, information.start + 8, information.end).find(
          (atom) => atom.type === "stbl",
        )!;
        const sampleTables = atoms(film, table.start + 8, table.end);
        const descriptions = sampleTables.find((atom) => atom.type === "stsd")!;
        const entry = atoms(film, descriptions.start + 16, descriptions.end)[0];
        expect(entry.type, `${strand} video codec`).toBe("avc1");
        expect(film.readUInt16BE(entry.start + 32), `${strand} width`).toBe(
          960,
        );
        expect(film.readUInt16BE(entry.start + 34), `${strand} height`).toBe(
          540,
        );
        const timing = sampleTables.find((atom) => atom.type === "stts")!;
        let sampleCount = 0;
        let duration = 0;
        const timingEntries = film.readUInt32BE(timing.start + 12);
        for (let i = 0; i < timingEntries; i++) {
          const count = film.readUInt32BE(timing.start + 16 + i * 8);
          const delta = film.readUInt32BE(timing.start + 20 + i * 8);
          sampleCount += count;
          duration += count * delta;
        }
        expect(
          (sampleCount * timescale) / duration,
          `${strand} smooth, consistent playback rate`,
        ).toBeCloseTo(24, 2);
      }
      expect(handlers, `${strand} has one silent video track`).toEqual([
        "vide",
      ]);
      hashes.add(createHash("sha256").update(film).digest("hex"));
      const poster = await readFile(
        new URL(`../public/films/${strand}.webp`, import.meta.url),
      );
      expect(poster.toString("ascii", 0, 4)).toBe("RIFF");
      expect(poster.toString("ascii", 8, 12)).toBe("WEBP");
      expect(poster.length).toBeGreaterThan(5_000);
      expect(poster.length).toBeLessThan(150_000);
    }
    expect(hashes.size).toBe(strandIds.length);
  });
});
