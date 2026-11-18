import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const directory = process.argv[2] || "dist";
await mkdir(`${directory}/icons`, { recursive: true });
const artwork = '<rect width="128" height="128" rx="28" fill="#315d45"/><path d="M43 29h42v73L64 88l-21 14z" fill="none" stroke="white" stroke-width="8" stroke-linejoin="round"/><path d="M55 53h18M55 66h13" stroke="white" stroke-width="6" stroke-linecap="round"/>';
for (const size of [16, 48, 128]) {
  // Store artwork occupies 96px with 16px transparent padding in the 128px icon.
  const content = size === 128 ? `<g transform="translate(16 16) scale(0.75)">${artwork}</g>` : artwork;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${content}</svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${directory}/icons/${size}.png`);
}
if (directory === "dist") await writeFile(`${directory}/INSTALL.txt`, "Load this folder through chrome://extensions > Developer mode > Load unpacked. See the project's docs/LOCAL-SETUP.md for the Notion connection service.\n");
