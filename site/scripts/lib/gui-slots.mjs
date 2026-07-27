import fs from 'node:fs';
import {PNG} from 'pngjs';

/**
 * GUI 槽位配色：内部填充与左上暗边框。
 * 第一组是 MC 原版灰；金烹饪锅等重着色 GUI 沿用同一版式但换了色板，故按组匹配。
 */
const SLOT_PALETTES = [
  {fill: [139, 139, 139], dark: [55, 55, 55]},
  {fill: [200, 144, 46], dark: [107, 71, 20]},
];

function px(png, x, y) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return null;
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}

function isColor(pixel, rgb, tolerance = 6) {
  if (!pixel || pixel[3] < 250) return false;
  return rgb.every((value, index) => Math.abs(pixel[index] - value) <= tolerance);
}

/**
 * 扫描 GUI 贴图中的 18×18 槽位。
 * 判定条件：16×16 内部为槽位灰，且左上两条边为暗边框。
 * 返回的 x/y 是内部 16×16 区域左上角（放物品用的坐标）。
 */
export function detectSlots(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const slots = [];
  const taken = new Set();
  for (let y = 1; y <= png.height - 17; y++) {
    for (let x = 1; x <= png.width - 17; x++) {
      if (taken.has(`${x},${y}`)) continue;
      const palette = SLOT_PALETTES.find(
        (entry) =>
          isColor(px(png, x, y), entry.fill) &&
          isColor(px(png, x - 1, y), entry.dark) &&
          isColor(px(png, x, y - 1), entry.dark),
      );
      if (!palette) continue;
      let filled = true;
      for (let dy = 0; dy < 16 && filled; dy++) {
        for (let dx = 0; dx < 16; dx++) {
          if (!isColor(px(png, x + dx, y + dy), palette.fill)) {
            filled = false;
            break;
          }
        }
      }
      if (!filled) continue;
      slots.push({x, y});
      for (let dy = 0; dy < 16; dy++) {
        for (let dx = 0; dx < 16; dx++) taken.add(`${x + dx},${y + dy}`);
      }
    }
  }
  slots.sort((a, b) => a.y - b.y || a.x - b.x);
  return {width: png.width, height: png.height, slots};
}

/** 把槽位按 y 坐标聚成行（同一行允许 2px 抖动）。 */
export function groupRows(slots) {
  const rows = [];
  for (const slot of slots) {
    const row = rows.find((entry) => Math.abs(entry.y - slot.y) <= 2);
    if (row) row.slots.push(slot);
    else rows.push({y: slot.y, slots: [slot]});
  }
  return rows;
}
