// 生成站点图标：白底 + 黑色 Z 字标（与站头 logo 的黑字白底一致）。
// 用法：node scripts/gen-favicons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = new URL('../public/src/favicons/', import.meta.url);
const BASE = 512;
// 站头 logo 用的字体，本地回退到 Helvetica Neue / Arial。
const FONT = "neue-haas-grotesk-display, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const INK = 0.64; // 字标高度占画布的比例：再小在 16px 下会糊，再大显得挤

// librsvg 不认 dominant-baseline，所以 y 就是字母基线，居中靠下面量出来的 dy 补。
// text-anchor="middle" 是生效的，dx 只是给字体字宽不齐时留的修正量。
// size 决定栅格化尺寸（viewBox 不变）：每个尺寸都直接栅格化，
// 小图标才不会是从 512 缩下来的糊图。
const mark = ({ fontSize, dx = 0, dy = 0, size = BASE }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${BASE} ${BASE}">
  <rect width="${BASE}" height="${BASE}" fill="#ffffff"/>
  <text x="${BASE / 2 + dx}" y="${BASE / 2 + dy}" font-family="${FONT}" font-weight="700" font-size="${fontSize}"
        fill="#000000" text-anchor="middle">Z</text>
</svg>`;

const render = (opts) => sharp(Buffer.from(mark(opts))).png({ compressionLevel: 9 }).toBuffer();

// 量出字标实际占的墨迹范围（不同字体的字面大小不一样，量一次比猜数值可靠）
async function inkBox(fontSize, dx, dy) {
  const { info } = await sharp(await render({ fontSize, dx, dy }))
    .trim()
    .toBuffer({ resolveWithObject: true });
  // sharp 的 trimOffsetLeft/Top 是负号反的（实测黑块在 x=100 时返回 -100），这里取反。
  return { w: info.width, h: info.height, left: -info.trimOffsetLeft, top: -info.trimOffsetTop };
}

async function fittedMark() {
  // 探针用小字号：字号一大，字形顶部会顶出画布被裁掉，量到的字高就偏小。
  const probe = 200;
  const { h: probeH } = await inkBox(probe, 0, 0);
  const capRatio = probeH / probe; // 字高 / 字号，由字体决定

  const fontSize = Math.round((INK * BASE) / capRatio);
  const capHeight = fontSize * capRatio;
  // 基线在字形底部，往下挪半个字高，墨迹才真正居中
  const dy = Math.round(capHeight / 2);
  const dx = 0; // text-anchor="middle" 已经把字标水平居中

  // 校验：量一次成品，确认居中偏差在 1px 内
  const ink = await inkBox(fontSize, dx, dy);
  const offX = Math.round(ink.left + ink.w / 2 - BASE / 2);
  const offY = Math.round(ink.top + ink.h / 2 - BASE / 2);
  if (Math.abs(offX) > 1 || Math.abs(offY) > 1) {
    throw new Error(`字标没居中：偏差 (${offX}, ${offY})`);
  }

  return { fontSize, dx, dy, ink };
}

// ICO 容器：目录头 + 每项 16 字节描述 + 内嵌 PNG（Vista 起支持，无需 BMP）
function packIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const dirSize = 16 * entries.length;
  const dir = Buffer.alloc(dirSize);
  let offset = header.length + dirSize;

  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at);
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // 调色板色数
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // 色平面
    dir.writeUInt16LE(32, at + 6); // 位深
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

await mkdir(OUT, { recursive: true });

const { fontSize, dx, dy, ink } = await fittedMark();
console.log(
  `字标：font-size=${fontSize} 偏移=(${dx}, ${dy}) 墨迹=${ink.w}x${ink.h}` +
    `（占画布 ${(ink.h / BASE).toFixed(2)}）`,
);

// 矢量源文件，浏览器优先用它（缩放永远清晰）
await writeFile(new URL('favicon.svg', OUT), mark({ fontSize, dx, dy }));

const pngSizes = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
};

const icoSizes = [16, 32, 48];
const pngs = {};

for (const [name, size] of Object.entries(pngSizes)) {
  const buf = await render({ fontSize, dx, dy, size });
  await writeFile(new URL(name, OUT), buf);
  pngs[size] = buf;
  console.log(`${name} ${size}x${size} ${buf.length}B`);
}

const icoEntries = [];
for (const size of icoSizes) {
  pngs[size] ??= await render({ fontSize, dx, dy, size });
  icoEntries.push({ size, png: pngs[size] });
}
const ico = packIco(icoEntries);
await writeFile(new URL('favicon.ico', OUT), ico);
console.log(`favicon.ico（${icoSizes.join('/')}）${ico.length}B`);
