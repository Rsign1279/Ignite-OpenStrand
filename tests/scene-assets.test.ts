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
      expect(seconds).toBeGreaterThanOrEqual(10);
      expect(seconds).toBeLessThanOrEqual(13);
      expect(
        film.includes(Buffer.from("avc1")),
        `${strand} browser-compatible H.264`,
      ).toBe(true);
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
