/**
 * 裁切工作站 GUI 贴图到「操作区」（去掉玩家背包与快捷栏），复制到 site/static/img/gui。
 * 裁切高度来自 gui-slots.mjs 实测的背包首行 y 坐标，不使用估计值。
 */
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import {detectSlots, groupRows} from './lib/gui-slots.mjs';

const SRC_DIR = path.resolve('../新建文件夹');
const VANILLA_GUI_DIR = path.resolve('../assets/minecraft/textures/gui/container');
const OUT_DIR = path.resolve('static/img/gui');

/** 源文件 -> 输出名。背包首行由检测结果推断，无背包的图保持原高。 */
const FILES = [
  {src: 'crafting_table.png', out: 'crafting_table.png'},
  {src: 'cask_gui.png', out: 'cask.png'},
  {src: 'cooking_pot.png', out: 'cooking_pot.png'},
  {src: 'cooking_pot_gold.png', out: 'cooking_pot_gold.png'},
  {src: 'cutting_board.png', out: 'cutting_board.png'},
  {src: 'cutting_skillet.png', out: 'skillet.png'},
  {src: 'stomping.png', out: 'stomping_basin.png'},
  {src: 'crab_trap.png', out: 'crab_trap.png'},
  // 原版熔炼类 GUI 取自资源包，用于 smelting / smoking / campfire_cooking 配方。
  {src: 'furnace.png', out: 'furnace.png', dir: VANILLA_GUI_DIR, cropWidth: 176},
  {src: 'smoker.png', out: 'smoker.png', dir: VANILLA_GUI_DIR, cropWidth: 176},
  // 末地乐事有 blasting 配方（破损金煎锅回收），需要高炉界面。
  {src: 'blast_furnace.png', out: 'blast_furnace.png', dir: VANILLA_GUI_DIR, cropWidth: 176},
];

/**
 * 找出玩家背包起始 y：背包是连续的 3 行 9 格 + 1 行快捷栏，行距 18。
 * 返回 null 表示该图没有背包区。
 */
function findInventoryTop(slots) {
  const rows = groupRows(slots).filter((row) => row.slots.length === 9);
  for (let i = 0; i + 2 < rows.length; i++) {
    const [a, b, c] = [rows[i], rows[i + 1], rows[i + 2]];
    if (Math.abs(b.y - a.y - 18) <= 1 && Math.abs(c.y - b.y - 18) <= 1) return a.y;
  }
  return null;
}

/** 裁到左上角 width x height。原版 GUI 是 256x256 图集，只有左上 176 宽是界面本体。 */
function cropTopLeft(pngPath, height, width) {
  const src = PNG.sync.read(fs.readFileSync(pngPath));
  const w = Math.min(width ?? src.width, src.width);
  const h = Math.min(height, src.height);
  if (w === src.width && h === src.height) return src;
  const out = new PNG({width: w, height: h});
  for (let y = 0; y < h; y++) {
    src.data.copy(out.data, y * w * 4, (y * src.width) * 4, (y * src.width + w) * 4);
  }
  return out;
}

fs.mkdirSync(OUT_DIR, {recursive: true});
const manifest = {};

for (const file of FILES) {
  const srcPath = path.join(file.dir ?? SRC_DIR, file.src);
  const {slots, width, height} = detectSlots(srcPath);
  const invTop = findInventoryTop(slots);
  // 槽位上边框占 1px，向上留 4px GUI 边距，保证操作区完整。
  const cropHeight = invTop == null ? height : invTop - 4;
  const png = cropTopLeft(srcPath, cropHeight, file.cropWidth);
  fs.writeFileSync(path.join(OUT_DIR, file.out), PNG.sync.write(png));
  manifest[file.out.replace(/\.png$/, '')] = {width: png.width, height: png.height, source: file.src};
  console.log(`${file.src} ${width}x${height} -> ${file.out} ${png.width}x${png.height}` + (invTop == null ? ' (无背包区)' : ` (背包首行 y=${invTop})`));
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`已写出 ${Object.keys(manifest).length} 张 GUI -> static/img/gui`);
