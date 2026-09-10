// Regenerates resources/atlases/icon-atlas.png with 3 new columns:
//   Oil Pump (6), Mine (7), Airstrip (8)
// Existing 6 columns are copied 1:1, new glyphs drawn with node-canvas
// (anti-aliased). Glyph conventions: 64×64 white masks over transparent.
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLS = 9;
const SIZE = 64;
const OUT = path.join(
  __dirname,
  "..",
  "resources",
  "atlases",
  "icon-atlas.png",
);

async function main() {
  const img = await loadImage(OUT);
  const canvas = createCanvas(COLS * SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, SIZE * 6, SIZE); // keep original 6 columns

  ctx.fillStyle = "#ffffff";
  const c = SIZE / 2;
  function glyph(col, fn) {
    ctx.save();
    ctx.translate(col * SIZE, 0);
    fn();
    ctx.restore();
  }

  // Oil Pump (6): pumpjack
  glyph(6, () => {
    ctx.beginPath(); // tower
    ctx.moveTo(c - 8, c + 24);
    ctx.lineTo(c - 3, c - 10);
    ctx.lineTo(c + 3, c - 10);
    ctx.lineTo(c + 8, c + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(c - 28, c - 16, 44, 7); // beam
    ctx.beginPath(); // horse head
    ctx.moveTo(c + 14, c - 12);
    ctx.lineTo(c + 28, c - 20);
    ctx.lineTo(c + 30, c - 6);
    ctx.lineTo(c + 15, c - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(c - 14, c + 20, 28, 6); // base
  });

  // Mine (7): pickaxe + rock pile
  glyph(7, () => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(-0.55);
    ctx.fillRect(-3, -20, 6, 42); // handle
    ctx.restore();
    ctx.beginPath(); // pick head
    ctx.moveTo(c - 24, c - 20);
    ctx.quadraticCurveTo(c, c - 34, c + 24, c - 20);
    ctx.quadraticCurveTo(c, c - 26, c - 24, c - 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // rock pile
    ctx.ellipse(c + 8, c + 22, 15, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(c - 6, c + 25, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Airstrip (8): runway + control tower
  glyph(8, () => {
    ctx.save();
    ctx.translate(c, c - 2);
    ctx.rotate(-0.3);
    ctx.fillRect(-26, -4, 52, 13); // runway
    ctx.globalCompositeOperation = "destination-out";
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * 10 - 2, 1, 5, 3); // dashes
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    ctx.fillRect(c + 14, c - 24, 8, 16); // tower shaft
    ctx.fillRect(c + 11, c - 28, 14, 6); // cab
    ctx.fillRect(c + 17, c - 32, 2, 4); // antenna
  });

  fs.writeFileSync(OUT, canvas.toBuffer("image/png"));
  console.log("wrote", OUT, `${COLS * SIZE}x${SIZE}`);
}

main();
