// 解析 CraftEngine 配置与原版 assets，为 wiki 中出现的每个物品 id 找到贴图，
// 把 PNG 拷到 static/img/items/，并生成 src/data/items.json（id -> 贴图层列表）。
//
// 贴图定义在配置里有 5 种写法，这里逐一处理：
//   1. texture: "minecraft:item/custom/x"          单值
//   2. textures: [底图, 叠加层]                     多层叠加（银星作物）
//   3. model: "minecraft:item/custom/x"            指向模型 JSON，沿 parent 链取 layer0
//   4. model: {path, generation:{textures:{layer0}}} 新版模型对象（小刀）
//   5. 内联在 behavior.block.states.appearances 里  （stove 等）
//
// 有真实几何体的方块（箱柜、砧板、木桶等）不用单面贴图，而是按模型 JSON
// 烘焙成等轴测 3D 图标，见 lib/model-render.mjs。
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {load} from 'js-yaml';
import {
  renderModel,
  loadTexture,
  opaqueRatio,
  resolveModel as resolveModelChain,
} from './lib/model-render.mjs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');
const rootDir = path.resolve(siteDir, '..');
const ceDir = path.join(rootDir, 'ce配置', 'nong', 'configuration');
const packAssets = path.join(rootDir, 'ce配置', 'nong', 'resourcepack', 'assets');
const vanillaAssets = path.join(rootDir, 'assets', 'minecraft');
/**
 * 捕蟹笼产出与部分工作站配方会引用蟹农（xienong）、末地乐事（endersdelight）、
 * 山茶花（camellia）等插件的物品，它们各自带资源包，按顺序参与查找。
 */
const extraPackAssets = [
  path.join(rootDir, '蟹农和末地乐事', 'xienong', 'resourcepack', 'assets'),
  path.join(rootDir, '蟹农和末地乐事', 'enders', 'resourcepack', 'assets'),
  path.join(rootDir, '山茶花', 'camellia_ce_pack', 'resourcepack', 'assets'),
];
const searchPacks = [packAssets, ...extraPackAssets.filter((dir) => fs.existsSync(dir))];
const extraCeDirs = [
  path.join(rootDir, '蟹农和末地乐事', 'xienong', 'configuration'),
  path.join(rootDir, '蟹农和末地乐事', 'enders', 'configuration'),
  path.join(rootDir, '山茶花', 'camellia_ce_pack', 'configuration'),
];
const outImgDir = path.join(siteDir, 'static', 'img', 'items');

/** 把 "ns:path" 拆成 [命名空间, 路径]，无命名空间时默认 minecraft。 */
function splitRef(ref) {
  const text = String(ref);
  const index = text.indexOf(':');
  return index === -1 ? ['minecraft', text] : [text.slice(0, index), text.slice(index + 1)];
}

/** 贴图引用 -> 实际 PNG 路径。资源包优先，回落到原版 assets。 */
function texturePath(ref) {
  const [namespace, rest] = splitRef(ref);
  for (const dir of searchPacks) {
    const packFile = path.join(dir, namespace, 'textures', `${rest}.png`);
    if (fs.existsSync(packFile)) return packFile;
  }
  if (namespace === 'minecraft') {
    const vanillaFile = path.join(vanillaAssets, 'textures', `${rest}.png`);
    if (fs.existsSync(vanillaFile)) return vanillaFile;
  }
  return null;
}

/** 模型引用 -> 实际模型 JSON 路径，同样资源包优先。 */
function modelPath(ref) {
  const [namespace, rest] = splitRef(ref);
  for (const dir of searchPacks) {
    const packFile = path.join(dir, namespace, 'models', `${rest}.json`);
    if (fs.existsSync(packFile)) return packFile;
  }
  if (namespace === 'minecraft') {
    const vanillaFile = path.join(vanillaAssets, 'models', `${rest}.json`);
    if (fs.existsSync(vanillaFile)) return vanillaFile;
  }
  return null;
}

// 从模型的 textures 里挑一个能代表该物品的面，按优先级排。
// 方块优先取正面/侧面：玩家在配方栏看到的是物品的正面，取 top/bottom 会认不出是什么方块。
// particle 只是粒子取色，常指向底面，不能当外观用，所以不列入这里（仅最后兜底）。
const FACE_KEYS = ['layer0', 'all', 'texture', 'front', 'side', 'north', 'top', 'end'];

// 有些模型用无语义的数字键（cask 的 0/1/2/3），键名帮不上忙，
// 只能看贴图路径本身叫什么面。数字越小越优先只是文件顺序，不代表正面。
const FACE_NAME_ORDER = ['_front', '_side', '_north', '_top', '_end', '_bottom'];

/** 从贴图引用集合里挑最能代表物品外观的一张。 */
function pickByTextureName(values) {
  for (const suffix of FACE_NAME_ORDER) {
    const hit = values.find((value) => value.endsWith(suffix));
    if (hit) return hit;
  }
  return values[0] ?? null;
}

/** 沿 parent 链解析模型，返回贴图引用。 */
function resolveModel(ref, depth = 0) {
  if (depth > 8) return null;
  const file = modelPath(ref);
  if (!file) return null;
  const model = JSON.parse(fs.readFileSync(file, 'utf8'));
  const textures = model.textures ?? {};
  for (const key of FACE_KEYS) {
    const value = textures[key];
    if (typeof value === 'string' && !value.startsWith('#')) return value;
  }
  // 只剩数字键之类的无语义键位，改看贴图名字判断是哪个面。
  const rest = Object.entries(textures)
    .filter(([key, value]) => key !== 'particle' && typeof value === 'string' && !value.startsWith('#'))
    .map(([, value]) => value);
  if (rest.length > 0) return pickByTextureName(rest);
  if (model.parent) return resolveModel(model.parent, depth + 1);
  if (typeof textures.particle === 'string' && !textures.particle.startsWith('#')) {
    return textures.particle;
  }
  return null;
}

/** 从物品配置里解析出贴图层列表（自下而上）。 */
function resolveItemTextures(config) {
  if (Array.isArray(config.textures) && config.textures.length > 0) {
    return config.textures.map(String);
  }
  if (typeof config.texture === 'string') return [config.texture];

  const model = config.model;
  if (model && typeof model === 'object' && !Array.isArray(model)) {
    const layer0 = model.generation?.textures?.layer0;
    if (typeof layer0 === 'string') return [layer0];
    if (typeof model.path === 'string') {
      const resolved = resolveModel(model.path);
      if (resolved) return [resolved];
    }
  }
  if (typeof model === 'string') {
    const resolved = resolveModel(model);
    if (resolved) return [resolved];
  }

  // 内联模型（stove 等）：配置里直接写了各面贴图，按面名择优，
  // 并排除点燃态之类的状态变体，取常态外观。
  const inline = JSON.stringify(config).match(/"(minecraft:(?:item|block)\/[a-z0-9_/]+)"/g) ?? [];
  const refs = [...new Set(inline.map((raw) => raw.slice(1, -1)))]
    .filter((ref) => texturePath(ref) && !ref.endsWith('_on'));
  if (refs.length > 0) return [pickByTextureName(refs)];
  return null;
}

// 物品标签没有自己的贴图，列出代表成员，让前端像游戏里那样循环展示。
const TAG_MEMBERS = {
  '#minecraft:planks': [
    'minecraft:oak_planks',
    'minecraft:spruce_planks',
    'minecraft:birch_planks',
    'minecraft:jungle_planks',
    'minecraft:acacia_planks',
    'minecraft:dark_oak_planks',
  ],
  // 捕蟹笼配方用木台阶，半砖几何由 3D 烘焙保留
  '#minecraft:wooden_slabs': [
    'minecraft:oak_slab',
    'minecraft:spruce_slab',
    'minecraft:birch_slab',
    'minecraft:jungle_slab',
    'minecraft:acacia_slab',
    'minecraft:dark_oak_slab',
  ],
};

/**
 * 原版方块类物品 -> 可烘焙的方块模型引用。
 * 判定顺序与游戏一致：item/<name>.json 若继承 generated/handheld，说明它在物品栏里
 * 本就是平面图标（胡萝卜、小麦等），不当方块处理；否则若存在 block/<name>.json
 * 且父链带 elements，就用方块自带模型（原木的柱体、台阶的半砖、南瓜的朝向面）。
 */
function vanillaBlockModel(id) {
  const [, name] = splitRef(id);
  const itemModel = modelPath(`item/${name}`);
  if (itemModel) {
    try {
      const parent = JSON.parse(fs.readFileSync(itemModel, 'utf8')).parent ?? '';
      if (/generated|handheld/.test(parent)) return null;
    } catch {
      return null; // 模型损坏时保持原有平面贴图行为
    }
  }
  // 活板门这类没有 block/<name>.json，只有状态变体，取关闭态（_bottom）作为常态外观
  for (const ref of [`block/${name}`, `block/${name}_bottom`]) {
    if (modelPath(ref) && hasGeometry(ref)) return ref;
  }
  return null;
}

/** 原版物品 id -> 贴图引用。先试物品贴图，再试物品/方块模型。 */
function resolveVanilla(id) {
  const [, name] = splitRef(id);
  if (texturePath(`item/${name}`)) return [`item/${name}`];
  const fromItem = resolveModel(`item/${name}`);
  if (fromItem) return [fromItem];
  const fromBlock = resolveModel(`block/${name}`);
  if (fromBlock) return [fromBlock];
  if (texturePath(`block/${name}`)) return [`block/${name}`];
  return null;
}

/** 读取所有 CE 配置里的 items 定义。同名以先出现的为准。 */
/**
 * 展开 CraftEngine 模板占位符 ${arg}。蟹农的桶装海鲜、珍珠块、板条箱都是
 * template + arguments 的写法，模板体里用 ${id} / ${top} 引用参数，
 * 不展开就拿不到贴图与模型路径。
 */
function applyTemplateArgs(node, args) {
  if (typeof node === 'string') {
    return node.replace(/\$\{([a-z0-9_]+)\}/gi, (raw, key) => (key in args ? String(args[key]) : raw));
  }
  if (Array.isArray(node)) return node.map((child) => applyTemplateArgs(child, args));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) out[applyTemplateArgs(key, args)] = applyTemplateArgs(value, args);
    return out;
  }
  return node;
}

/** 把 {template, arguments} 物品解析成实际配置；模板可再继承模板。 */
function expandTemplate(config, templates, depth = 0) {
  if (depth > 4 || !config?.template) return config;
  const base = templates[config.template];
  if (!base) return config;
  const args = config.arguments ?? {};
  const merged = {...applyTemplateArgs(base, args), ...config};
  delete merged.template;
  delete merged.arguments;
  return expandTemplate({...merged, template: base.template}, templates, depth + 1);
}

function loadItemConfigs() {
  const configs = {};
  const templates = {};
  const pending = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.yml')) {
        let doc;
        try {
          doc = load(fs.readFileSync(full, 'utf8')) ?? {};
        } catch {
          continue; // 语言文件等非物品配置，解析失败直接跳过
        }
        if (!doc || typeof doc !== 'object') continue;
        Object.assign(templates, doc.templates ?? {});
        for (const [id, config] of Object.entries(doc.items ?? {})) {
          if (!config || typeof config !== 'object' || id in configs) continue;
          // 模板可能定义在后读到的文件里，先收集，等全部扫完再展开
          if (config.template) pending.push([id, config]);
          else configs[id] = config;
        }
      }
    }
  };
  for (const dir of [ceDir, ...extraCeDirs]) {
    if (fs.existsSync(dir)) walk(dir);
  }
  for (const [id, config] of pending) {
    if (!(id in configs)) configs[id] = expandTemplate(config, templates);
  }
  return configs;
}

/**
 * 砧板刀具槽在 GUI 里展示的物品，来自 CuttingBoardRecipeGui.refreshKnifeSlot
 * 与 CuttingBoardService.KNIFE_ID_LIST。它们不是配方材料，需单独纳入图标生成。
 */
const CUTTING_BOARD_TOOL_IDS = [
  'default:flint_knife',
  'default:iron_knife',
  'default:golden_knife',
  'default:diamond_knife',
  'default:netherite_knife',
  'minecraft:iron_axe',
  'minecraft:iron_shovel',
];

/**
 * 小木桶配方浏览界面的固定装饰物品，来自 CaskRecipeGui：
 * 槽位 5 / 7 是进度条两侧的 default:pao、default:pao2，
 * 槽位 22 是光照槽展示的 default:deng2。它们不是配方材料，需单独纳入图标生成。
 */
const CASK_DECOR_IDS = ['default:pao', 'default:pao2', 'default:deng2'];

/** 收集 recipes.json 里出现过的所有物品 id（配方材料、产物、图鉴分类）。 */
function collectIds(data) {
  const ids = new Set([...CUTTING_BOARD_TOOL_IDS, ...CASK_DECOR_IDS]);
  for (const recipe of data.recipes) {
    if (recipe.result?.id) ids.add(recipe.result.id);
    for (const list of Object.values(recipe.key ?? {})) {
      for (const entry of list) ids.add(entry.id);
    }
    for (const list of recipe.ingredients ?? []) {
      for (const entry of list) ids.add(entry.id);
    }
    // 工作站配方的多产物、容器、饵料不在 result / ingredients 里，需单独收集。
    for (const output of recipe.outputs ?? []) ids.add(output.id);
    if (recipe.container?.id) ids.add(recipe.container.id);
    if (recipe.bait?.id) ids.add(recipe.bait.id);
  }
  for (const category of data.categories) {
    for (const id of category.items) ids.add(id);
  }
  return [...ids].sort();
}

/** 读 PNG 头部的宽高（IHDR 固定在前 24 字节内）。 */
function pngSize(file) {
  const buffer = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buffer, 0, 24, 0);
  fs.closeSync(fd);
  return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
}

/**
 * 拷贝 PNG 到 static/img/items/，返回 {url, frames, frametime}。
 * 带 .mcmeta 的动画贴图是多帧竖排长图，frames 记录总帧数，
 * frametime 是每帧停留的游戏刻（MC 默认 1 刻 = 50ms），
 * 交给前端按帧推进播放。
 */
const copied = new Map();
function copyTexture(ref) {
  if (copied.has(ref)) return copied.get(ref);
  const source = texturePath(ref);
  if (!source) return null;
  const [namespace, rest] = splitRef(ref);
  const name = `${namespace}__${rest.replace(/\//g, '__')}.png`;
  fs.copyFileSync(source, path.join(outImgDir, name));

  let frames = 1;
  let frametime = 1; // MC animation.frametime 默认 1 刻
  if (fs.existsSync(`${source}.mcmeta`)) {
    const {width, height} = pngSize(source);
    // 动画帧是正方形竖排，帧高默认等于贴图宽度。
    let frameHeight = width;
    try {
      const meta = JSON.parse(fs.readFileSync(`${source}.mcmeta`, 'utf8'));
      if (meta.animation?.height) frameHeight = Number(meta.animation.height);
      if (meta.animation?.frametime > 0) frametime = Number(meta.animation.frametime);
    } catch {
      // mcmeta 损坏时按正方形帧推算，帧率取默认
    }
    if (frameHeight > 0 && height > frameHeight) {
      frames = Math.round(height / frameHeight);
    }
  }

  const entry = {url: `/img/items/${name}`, frames, frametime};
  copied.set(ref, entry);
  return entry;
}

// ---- 3D 烘焙 ----

const ICON_SIZE = 64; // 16px 贴图放大 4 倍，兼顾清晰度与体积
const renderDeps = {
  findModelFile: modelPath,
  resolveTexture: (ref) => {
    const file = texturePath(ref);
    return file ? loadTexture(file) : null;
  },
  size: ICON_SIZE,
};

/**
 * 从物品配置里取出模型引用。
 * 多数是字符串或 {path}，直接指向资源包里的模型 JSON。
 * 但 stove 的模型文件并不存在：它在 behavior.block.states.appearances 下用
 * generation:{parent, textures} 声明，由 CE 运行时生成。这类要把内联定义
 * 原样取出来交给渲染器（renderModel 支持直接吃模型对象）。
 */
function modelRefOf(config) {
  const model = config?.model;
  if (typeof model === 'string' && modelPath(model)) return model;
  if (model && typeof model === 'object' && typeof model.path === 'string' && modelPath(model.path)) {
    return model.path;
  }
  return inlineGeneration(config);
}

/** 找出配置里第一个方块类 generation 定义，取常态外观（排除 _on / lit 等状态变体）。 */
function inlineGeneration(config) {
  const found = [];
  const walk = (node, key) => {
    if (!node || typeof node !== 'object') return;
    if (node.generation?.parent && node.generation.textures) {
      found.push({key: String(key), generation: node.generation});
    }
    for (const [childKey, value] of Object.entries(node)) walk(value, childKey);
  };
  walk(config, '');
  if (found.length === 0) return null;
  // 优先取朝北的未点燃态，和平面贴图分支的取向保持一致
  const pick =
    found.find((entry) => entry.key.startsWith('north') && !entry.key.includes('_on')) ??
    found.find((entry) => !entry.key.includes('_on')) ??
    found[0];
  const {parent, textures} = pick.generation;
  return {parent, textures};
}

/**
 * 判断该模型是否有真实几何体。
 * 注意：不能只看模型文件自身有没有 elements。stove / tatami 这类继承
 * block/cube、cube_all，elements 定义在父模型里，也应当走 3D。
 */
function hasGeometry(ref) {
  if (!ref) return false;
  try {
    const model = resolveModelChain(ref, modelPath);
    if (!model?.elements?.length) return false;
    // item/generated 那种平面物品也会被父链带出一个 elements 吗？不会：
    // generated 没有 elements，只有 layer0 贴图，所以这里天然只命中真几何。
    return true;
  } catch {
    return false;
  }
}

const baked = new Map();
/** 烘焙 3D 图标，返回 {url, frames:1}；失败返回 null 以便回落贴图。 */
function bakeModel(id, ref) {
  if (baked.has(id)) return baked.get(id);
  let result = null;
  try {
    result = renderModel(ref, renderDeps);
  } catch (error) {
    console.log(`  3D 烘焙失败 ${id}: ${error.message}`);
  }
  if (!result) return null;

  // 自检：几乎全空或几乎铺满整幅画布都说明投影/缩放出了问题
  const ratio = opaqueRatio(result.pixels);
  if (ratio < 0.02 || ratio > 0.95) {
    console.log(`  3D 结果异常 ${id}: 非透明像素占比 ${(ratio * 100).toFixed(1)}%`);
    return null;
  }

  const name = `model__${id.replace(/[^a-z0-9_]+/gi, '_')}.png`;
  fs.writeFileSync(path.join(outImgDir, name), result.buffer);
  const entry = {url: `/img/items/${name}`, frames: 1};
  baked.set(id, entry);
  return entry;
}

function main() {
  const dataFile = path.join(siteDir, 'src', 'data', 'recipes.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const ids = collectIds(data);
  const configs = loadItemConfigs();

  fs.rmSync(outImgDir, {recursive: true, force: true});
  fs.mkdirSync(outImgDir, {recursive: true});

  const icons = {};
  const tags = {};
  const missing = [];
  for (const id of ids) {
    // 标签不是叠加贴图，而是多个可替换成员，单独存一份供前端轮播。
    if (id.startsWith('#')) {
      const members = TAG_MEMBERS[id] ?? [];
      const list = members
        .map((member) => {
          // 木板这类成员本身是方块，同样按 3D 烘焙，保持与其它方块一致
          const blockRef = vanillaBlockModel(member);
          if (blockRef) {
            const baked3d = bakeModel(member, blockRef);
            if (baked3d) return baked3d;
          }
          const ref = resolveVanilla(member);
          return ref ? copyTexture(ref[0]) : null;
        })
        .filter(Boolean)
        .map((entry) => (entry.frames > 1 ? entry : entry.url));
      if (list.length > 0) tags[id] = list;
      else missing.push(id);
      continue;
    }
    let refs = null;
    if (id.startsWith('minecraft:')) {
      // 原版方块（红砖块、原木、台阶等）按自带模型烘焙成 3D，失败回落平面贴图
      const blockRef = vanillaBlockModel(id);
      if (blockRef) {
        const entry = bakeModel(id, blockRef);
        if (entry) {
          icons[id] = [entry.url];
          continue;
        }
      }
      refs = resolveVanilla(id);
    } else {
      const config = configs[id];
      // 有真实几何体的方块走 3D 烘焙，失败则回落到单面贴图
      const modelRef = modelRefOf(config);
      if (hasGeometry(modelRef)) {
        const entry = bakeModel(id, modelRef);
        if (entry) {
          icons[id] = [entry.url];
          continue;
        }
      }
      if (config) refs = resolveItemTextures(config);
      // 借用原版材质的自定义物品（如野生作物），回落到 material 指定的原版贴图
      if (!refs && config?.material) refs = resolveVanilla(`minecraft:${config.material}`);
    }
    if (!refs) {
      missing.push(id);
      continue;
    }
    // 单帧贴图直接存 URL 字符串，动画贴图存 {url, frames, frametime}，减小数据体积。
    const layers = refs
      .map(copyTexture)
      .filter(Boolean)
      .map((entry) => (entry.frames > 1 ? entry : entry.url));
    if (layers.length === 0) missing.push(id);
    else icons[id] = layers;
  }

  const outFile = path.join(siteDir, 'src', 'data', 'items.json');
  fs.writeFileSync(outFile, JSON.stringify({icons, tags}, null, 2) + '\n', 'utf8');

  console.log(
    `已解析 ${Object.keys(icons).length + Object.keys(tags).length}/${ids.length} 个图标` +
      `（含 ${Object.keys(tags).length} 个物品标签）`,
  );
  console.log(`拷贝贴图 ${copied.size} 张、3D 烘焙 ${baked.size} 张 -> static/img/items/`);
  if (missing.length) console.log(`未找到贴图（${missing.length}）:`, missing.join(', '));
}

main();
