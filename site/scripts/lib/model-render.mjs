// 把 Minecraft 方块模型 JSON 烘焙成等轴测视角的 PNG 图标。
//
// 算法参考 Blockbench 源码（blockbench-master/）：
//   - js/preview/canvas.js:357            面序 east/west/up/down/south/north
//   - js/preview/preview_scenes.js:268-285 UV 归一化与面 rotation 的角点轮转
//   - js/preview/preview_scenes.js:259-266 元素 rotation 绕 origin 的施加顺序
//   - js/formats/java/java_block.js:399-417 rotation{angle,axis,origin} 解析
//
// 这里不用 WebGL：几何全是轴对齐立方体加简单旋转，纯 JS 软件光栅化足够，
// 且避免了 node 端 gl 包的原生编译依赖。
import fs from 'node:fs';
import {PNG} from 'pngjs';

/** 立方体 6 个面的方向名，顺序与 UV 布局对应。 */
export const FACE_ORDER = ['east', 'west', 'up', 'down', 'south', 'north'];

/** 每个面的 4 个角点（单位立方体 0..1 空间），顺序为 uv 的 [0,0] [1,0] [1,1] [0,1]。 */
const FACE_CORNERS = {
  // x+ 面：从 (1,y,z) 看向 -x
  east: [[1, 1, 1], [1, 1, 0], [1, 0, 0], [1, 0, 1]],
  west: [[0, 1, 0], [0, 1, 1], [0, 0, 1], [0, 0, 0]],
  up: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
  down: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]],
  south: [[0, 1, 1], [1, 1, 1], [1, 0, 1], [0, 0, 1]],
  north: [[1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]],
};

/** 面法线，用于方向光着色与背面剔除。 */
const FACE_NORMALS = {
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
  south: [0, 0, 1],
  north: [0, 0, -1],
};

/**
 * 各面亮度。仿 Minecraft 的固定方向光：顶面最亮，底面最暗，
 * 侧面按南北/东西分两档，这样立方体的三个可见面能区分开。
 */
const FACE_SHADE = {
  up: 1,
  down: 0.5,
  north: 0.8,
  south: 0.8,
  east: 0.6,
  west: 0.6,
};

export {FACE_CORNERS, FACE_NORMALS, FACE_SHADE};

/**
 * 读取贴图为 {width, height, data}。
 * 带 .mcmeta 的动画贴图是多帧竖排长图，这里只截第一帧，
 * 否则整条帧序列会被贴到一个面上（silver_star 24 帧、glowberry_crate_side 4 帧）。
 */
const textureCache = new Map();
export function loadTexture(file) {
  if (textureCache.has(file)) return textureCache.get(file);
  const png = PNG.sync.read(fs.readFileSync(file));
  let {width, height} = png;
  let frameHeight = height;

  if (fs.existsSync(`${file}.mcmeta`)) {
    frameHeight = width; // 动画帧默认是正方形
    try {
      const meta = JSON.parse(fs.readFileSync(`${file}.mcmeta`, 'utf8'));
      if (meta.animation?.height) frameHeight = Number(meta.animation.height);
    } catch {
      // mcmeta 损坏时按正方形帧推算
    }
  }

  let data = png.data;
  if (frameHeight > 0 && frameHeight < height) {
    // 只保留顶部第一帧的像素
    data = png.data.subarray(0, width * frameHeight * 4);
    height = frameHeight;
  }

  const texture = {width, height, data};
  textureCache.set(file, texture);
  return texture;
}

/** 最近邻采样，保持像素风。u/v 为 0..1，超出范围时取模平铺。 */
function sample(texture, u, v) {
  const {width, height, data} = texture;
  let x = Math.floor(u * width);
  let y = Math.floor(v * height);
  x = ((x % width) + width) % width;
  y = ((y % height) + height) % height;
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

export {sample};

function readModelFile(ref, findModelFile) {
  const file = findModelFile(ref);
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stripNamespace(ref) {
  const text = String(ref);
  const index = text.indexOf(':');
  return index === -1 ? text : text.slice(index + 1);
}

/**
 * 沿 parent 链解析模型，返回 {elements, textures, chain}。
 * 子模型的 textures 覆盖父模型；elements 取链上最近一个定义了它的模型。
 * 原版 block/cube 自身带 16³ elements，orientable_with_bottom 之类只补面到变量的
 * 绑定（north:"#front" 等），所以统一递归合并即可，不需要为立方体特判。
 */
export function resolveModel(ref, findModelFile, depth = 0) {
  if (depth > 10) return null;
  // ref 也可以直接是一份内联模型定义（CE 配置里的 generation 段），
  // 这类模型在资源包里没有对应文件，由 CE 运行时生成。
  const model = typeof ref === 'object' && ref !== null ? ref : readModelFile(ref, findModelFile);
  if (!model) return null;

  const textures = {...(model.textures ?? {})};
  let elements = model.elements ?? null;
  const chain = [typeof ref === 'object' ? '<inline>' : stripNamespace(ref)];

  if (model.parent) {
    const parent = resolveModel(model.parent, findModelFile, depth + 1);
    if (parent) {
      for (const [key, value] of Object.entries(parent.textures)) {
        if (!(key in textures)) textures[key] = value;
      }
      if (!elements) elements = parent.elements;
      chain.push(...parent.chain);
    }
  }

  return {elements, textures, chain};
}

/** 解析 "#front" 这类变量引用，可能多级指向（#front -> #side -> 真实路径）。 */
export function resolveTextureRef(ref, textures) {
  let value = ref;
  for (let i = 0; i < 10 && typeof value === 'string' && value.startsWith('#'); i += 1) {
    value = textures[value.slice(1)];
  }
  if (typeof value !== 'string' || value.startsWith('#')) return null;
  return value;
}

/** 绕单轴旋转一个点，Blockbench 的做法是先平移到 origin、旋转、再平移回。 */
function rotateAround(point, axis, angleDeg, origin) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [x, y, z] = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  let out;
  if (axis === 'x') out = [x, y * cos - z * sin, y * sin + z * cos];
  else if (axis === 'y') out = [x * cos + z * sin, y, -x * sin + z * cos];
  else out = [x * cos - y * sin, x * sin + y * cos, z];
  return [out[0] + origin[0], out[1] + origin[1], out[2] + origin[2]];
}

/**
 * 面的 UV 四角。uv 为 [x1,y1,x2,y2]（0..16 贴图坐标），
 * face.rotation 按 Blockbench 的做法轮转角点顺序。
 */
function faceUVs(face) {
  const [x1, y1, x2, y2] = face.uv ?? [0, 0, 16, 16];
  // 顺序对应 FACE_CORNERS 的 4 个角
  let uvs = [
    [x1 / 16, y1 / 16],
    [x2 / 16, y1 / 16],
    [x2 / 16, y2 / 16],
    [x1 / 16, y2 / 16],
  ];
  const rotation = ((face.rotation ?? 0) % 360 + 360) % 360;
  const shift = rotation / 90;
  if (shift) uvs = uvs.slice(shift).concat(uvs.slice(0, shift));
  return uvs;
}

/**
 * 把 elements 展开成待光栅化的面列表。
 * 每个面是 {points:[4个世界坐标], uvs, texture, shade}。
 * applyRotation=false 时忽略元素旋转，用于断言 rotation 确实生效。
 */
export function buildFaces(elements, textures, resolveTexture, applyRotation = true) {
  const out = [];
  for (const element of elements) {
    const from = element.from ?? [0, 0, 0];
    const to = element.to ?? [16, 16, 16];
    const rotation = applyRotation ? element.rotation : null;

    for (const [name, face] of Object.entries(element.faces ?? {})) {
      const corners = FACE_CORNERS[name];
      if (!corners) continue;

      const ref = resolveTextureRef(face.texture, textures);
      if (!ref) continue;
      const texture = resolveTexture(ref);
      if (!texture) continue; // #missing 之类不可解析的贴图，跳过该面

      let points = corners.map(([cx, cy, cz]) => [
        from[0] + cx * (to[0] - from[0]),
        from[1] + cy * (to[1] - from[1]),
        from[2] + cz * (to[2] - from[2]),
      ]);
      let normal = FACE_NORMALS[name];

      if (rotation?.angle) {
        const origin = rotation.origin ?? [8, 8, 8];
        const axis = rotation.axis ?? 'y';
        points = points.map((p) => rotateAround(p, axis, rotation.angle, origin));
        normal = rotateAround(normal, axis, rotation.angle, [0, 0, 0]);
      }

      out.push({points, normal, uvs: faceUVs(face), texture, shade: FACE_SHADE[name]});
    }
  }
  return out;
}

/**
 * 物品栏视角：原版 block/block 的 display.gui 是 rotation [30, 225, 0]。
 * 这里按同样的角度做正交投影，得到大家熟悉的等轴测方块外观。
 */
const YAW = (225 * Math.PI) / 180;
const PITCH = (30 * Math.PI) / 180;

function project(point) {
  // 以方块中心为原点
  const x = point[0] - 8;
  const y = point[1] - 8;
  const z = point[2] - 8;
  const cy = Math.cos(YAW);
  const sy = Math.sin(YAW);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(PITCH);
  const sp = Math.sin(PITCH);
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1, y2, z2]; // z2 越大越靠近观察者
}

/** 标准 16 单位立方体在当前视角下投影后的屏幕跨度，用作统一缩放基准。 */
let span16Cache = 0;
function projectedSpan16() {
  if (span16Cache) return span16Cache;
  let min = Infinity;
  let max = -Infinity;
  for (const x of [0, 16]) {
    for (const y of [0, 16]) {
      for (const z of [0, 16]) {
        const [px, py] = project([x, y, z]);
        min = Math.min(min, px, py);
        max = Math.max(max, px, py);
      }
    }
  }
  span16Cache = max - min;
  return span16Cache;
}

/** 三角形重心坐标插值 + Z-buffer 光栅化。 */
function rasterTriangle(target, tri) {
  const {size, color, depth} = target;
  const [a, b, c] = tri.screen;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));

  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-9) return;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const x = px + 0.5;
      const y = py + 0.5;
      let w0 = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / area;
      let w1 = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / area;
      let w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;

      const z = w0 * tri.z[0] + w1 * tri.z[1] + w2 * tri.z[2];
      const index = py * size + px;
      if (z <= depth[index]) continue;

      const u = w0 * tri.uv[0][0] + w1 * tri.uv[1][0] + w2 * tri.uv[2][0];
      const v = w0 * tri.uv[0][1] + w1 * tri.uv[1][1] + w2 * tri.uv[2][1];
      const [r, g, bl, alpha] = sample(tri.texture, u, v);
      if (alpha === 0) continue; // 透明像素不写深度，让后面的面透出来

      depth[index] = z;
      const offset = index * 4;
      color[offset] = Math.min(255, Math.round(r * tri.shade));
      color[offset + 1] = Math.min(255, Math.round(g * tri.shade));
      color[offset + 2] = Math.min(255, Math.round(bl * tri.shade));
      color[offset + 3] = alpha;
    }
  }
}

/**
 * 渲染面列表为 PNG buffer。size 为输出边长（正方形）。
 * 按模型实际包围盒等比缩放并居中，模型超出 0..16 也不会被裁掉。
 */
export function renderFaces(faces, size = 64) {
  const projected = faces.map((face) => ({
    ...face,
    xy: face.points.map(project),
  }));

  if (!projected.length) return null;

  // 缩放基准固定为标准 16 单位方块，而不是模型自身包围盒。
  // 否则像 canvas_rug 这种流苏伸到 -8..24 的模型，主体会被压成一半大小；
  // 用固定基准也能让所有图标彼此大小一致，和游戏物品栏里的观感相同。
  const margin = size * 0.04;
  const usable = size - margin * 2;
  let scale = usable / projectedSpan16();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const face of projected) {
    for (const [x, y] of face.xy) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return null;

  // 居中用模型实际范围，缩放用固定基准：既不压扁，也不会偏在一角
  const offsetX = size / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = size / 2 + ((minY + maxY) / 2) * scale;

  const target = {
    size,
    color: Buffer.alloc(size * size * 4, 0),
    depth: new Float64Array(size * size).fill(-Infinity),
  };

  for (const face of projected) {
    // 背面剔除：法线在投影后指向远离观察者的面不可见
    const viewZ = project([
      face.normal[0] + 8,
      face.normal[1] + 8,
      face.normal[2] + 8,
    ])[2];
    if (viewZ <= 0) continue;

    const screen = face.xy.map(([x, y]) => [x * scale + offsetX, offsetY - y * scale]);
    const z = face.xy.map((p) => p[2]);
    // 四边形拆两个三角形，顶点顺序与 uvs 对应
    for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
      rasterTriangle(target, {
        screen: [screen[i0], screen[i1], screen[i2]],
        z: [z[i0], z[i1], z[i2]],
        uv: [face.uvs[i0], face.uvs[i1], face.uvs[i2]],
        texture: face.texture,
        shade: face.shade,
      });
    }
  }

  const png = new PNG({width: size, height: size});
  target.color.copy(png.data);
  return {buffer: PNG.sync.write(png), pixels: target.color, size};
}

/**
 * 完整流程：模型引用 -> PNG buffer。
 * findModelFile / resolveTexture 由调用方注入，以便复用 build-item-icons 里
 * 已有的「资源包优先、回落原版 assets」查找逻辑。
 */
export function renderModel(ref, {findModelFile, resolveTexture, size = 64, applyRotation = true}) {
  const model = resolveModel(ref, findModelFile);
  if (!model?.elements?.length) return null;
  const faces = buildFaces(model.elements, model.textures, resolveTexture, applyRotation);
  if (!faces.length) return null;
  return renderFaces(faces, size);
}

/** 统计非透明像素占比，用于构建期自检。 */
export function opaqueRatio(pixels) {
  let count = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) count += 1;
  }
  return count / (pixels.length / 4);
}
