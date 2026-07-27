import fs from 'node:fs';
import path from 'node:path';
import {extractMethodBody, extractStaticConstants} from './java-expr.mjs';

/** Material.COOKED_BEEF -> minecraft:cooked_beef */
function materialToId(ref) {
  const name = ref.replace(/^Material\./, '');
  return `minecraft:${name.toLowerCase()}`;
}

/**
 * 求值一个物品表达式，返回 {id, count} 或候选数组。
 * 覆盖各 Service 的 c()/m()/mi()/custom()/new ItemStack() 与局部变量引用。
 */
/** 求标量字面量，支持指向 static final 常量的 ref。 */
function evalLiteral(node, locals) {
  if (!node) return null;
  if ('literal' in node) return node.literal;
  if (node.ref && locals.has(node.ref)) return evalLiteral(locals.get(node.ref), locals);
  return null;
}

function evalItem(node, locals) {
  if (!node) return null;
  if (node.literal === null) return null;
  if (node.ref) {
    if (locals.has(node.ref)) return evalItem(locals.get(node.ref), locals);
    if (node.ref.startsWith('Material.')) return {id: materialToId(node.ref), count: 1};
    return null;
  }
  if (!node.call) return null;

  const {call, args} = node;
  // c(itemId, fallback[, amount]) / custom(itemId, amount, fallback)
  if (call === 'c') {
    const id = args[0]?.literal;
    if (typeof id !== 'string') return null;
    // 两种重载：c(id, fallback, amount) 与 c(id, amount, fallback)
    const numeric = args.slice(1).find((arg) => typeof arg?.literal === 'number');
    return {id, count: numeric?.literal ?? 1};
  }
  if (call === 'custom') {
    const id = args[0]?.literal;
    if (typeof id !== 'string') return null;
    const numeric = args.slice(1).find((arg) => typeof arg?.literal === 'number');
    return {id, count: numeric?.literal ?? 1};
  }
  // m(Material)/mi(Material, amount)/new ItemStack(Material[, amount])
  if (call === 'm' || call === 'mi' || call === 'new ItemStack') {
    const ref = args[0]?.ref;
    if (!ref?.startsWith('Material.')) return null;
    const numeric = args.slice(1).find((arg) => typeof arg?.literal === 'number');
    return {id: materialToId(ref), count: numeric?.literal ?? 1};
  }
  return null;
}

/** g(a, b, ...) / cabbage() / milkChoice() -> 候选物品数组。 */
function evalGroup(node, locals, namedGroups) {
  if (!node?.call) return [];
  if (namedGroups[node.call]) return namedGroups[node.call];
  if (node.call === 'g') {
    return node.args.map((arg) => evalItem(arg, locals)).filter(Boolean);
  }
  const single = evalItem(node, locals);
  return single ? [single] : [];
}

/** List.of(g(...), g(...)) -> 材料组数组。 */
function evalGroupList(node, locals, namedGroups) {
  if (!node?.call) return [];
  if (node.call === 'List.of') {
    return node.args.map((arg) => evalGroup(arg, locals, namedGroups)).filter((g) => g.length > 0);
  }
  const group = evalGroup(node, locals, namedGroups);
  return group.length > 0 ? [group] : [];
}

function readSource(pluginRoot, relative) {
  return fs.readFileSync(path.join(pluginRoot, 'src/main/java/com/nong/stoveigniter', relative), 'utf8');
}

/** 把一个方法体内的调用与局部变量合并收集（支持多个方法拼接）。 */
function gatherCalls(source, methodNames) {
  const calls = [];
  const locals = new Map();
  // 类内 static final 常量（如 DEFAULT_LIQUID_DISPLAY_NAME）当作只读局部量参与求值。
  for (const [key, value] of extractStaticConstants(source)) locals.set(key, {literal: value});
  for (const name of methodNames) {
    const body = extractMethodBody(source, name);
    for (const [key, value] of body.locals) locals.set(key, value);
    calls.push(...body.calls);
  }
  return {calls, locals};
}

/** 小木桶：addRecipe(id, name, List.of(groups), output, seconds, exp) */
function extractCask(pluginRoot) {
  const source = readSource(pluginRoot, 'cask/CaskRecipeService.java');
  const {calls, locals} = gatherCalls(source, ['createDefaultRecipes']);
  const recipes = [];
  for (const node of calls) {
    if (node.call !== 'addRecipe') continue;
    const [id, name, groupList, output, seconds, experience] = node.args;
    const result = evalItem(output, locals);
    if (!result) continue;
    recipes.push({
      id: `cask:${id.literal}`,
      station: 'cask',
      displayName: name?.literal ?? null,
      inputs: evalGroupList(groupList, locals, {}),
      result,
      seconds: seconds?.literal ?? null,
      experience: experience?.literal ?? null,
    });
  }
  return recipes;
}

/** 烹饪锅：addRecipe/addGoldRecipe(id, name, List.of(groups), container, output[, seconds, exp]) */
function extractCookingPot(pluginRoot) {
  const source = readSource(pluginRoot, 'cookingpot/CookingPotRecipeService.java');
  const namedGroups = collectNamedGroups(source, ['cabbage', 'milkChoice', 'cheeseChoice']);
  const {calls, locals} = gatherCalls(source, [
    'createDefaultRecipes',
    'ensureNongDefaultRecipes',
  ]);
  const recipes = [];
  for (const node of calls) {
    if (node.call !== 'addRecipe' && node.call !== 'addGoldRecipe') continue;
    const [id, name, groupList, container, output, seconds, experience] = node.args;
    const result = evalItem(output, locals);
    if (!result) continue;
    recipes.push({
      id: `cooking_pot:${id.literal}`,
      station: 'cooking_pot',
      displayName: name?.literal ?? null,
      inputs: evalGroupList(groupList, locals, namedGroups),
      container: evalItem(container, locals),
      result,
      seconds: seconds?.literal ?? null,
      experience: experience?.literal ?? null,
      gold: node.call === 'addGoldRecipe' || undefined,
    });
  }
  return recipes;
}

/** 砧板：addDefaultRecipe(id, name, input, List.of(output(item, chance)...)[, tool]) */
function extractCuttingBoard(pluginRoot) {
  const source = readSource(pluginRoot, 'cutting/CuttingBoardRecipeService.java');
  const methods = [...source.matchAll(/private void (createDefaultRecipes|add\w*Recipes)\s*\(/g)].map(
    (match) => match[1],
  );
  const {calls, locals} = gatherCalls(source, [...new Set(methods)]);
  const recipes = [];
  const seen = new Set();

  // addBarkRecipes/addBarkStemRecipes 是参数化循环，按源码语义展开。
  const bark = {count: 1, id: 'default:tree_bark'};
  for (const node of calls) {
    const wood = node.args[0]?.literal;
    if (typeof wood !== 'string') continue;
    const parts =
      node.call === 'addBarkRecipes'
        ? [['log', '原木剥皮', 'LOG'], ['wood', '木头剥皮', 'WOOD']]
        : node.call === 'addBarkStemRecipes'
          ? [['stem', '菌柄剥皮', 'STEM'], ['hyphae', '菌丝剥皮', 'HYPHAE']]
          : null;
    if (!parts) continue;
    for (const [suffix, label, material] of parts) {
      const id = `fd-${wood}-${suffix}`;
      seen.add(id);
      const outputs = [
        {id: `minecraft:stripped_${wood}_${material.toLowerCase()}`, count: 1, chance: 1},
        {...bark, chance: 1},
      ];
      recipes.push({
        id: `cutting_board:${id}`,
        station: 'cutting_board',
        displayName: `${wood} ${label}`,
        inputs: [[{id: `minecraft:${wood}_${material.toLowerCase()}`, count: 1}]],
        tool: 'axe',
        outputs,
        result: outputs[0],
      });
    }
  }

  for (const node of calls) {
    if (node.call !== 'addDefaultRecipe') continue;
    const [id, name, input, outputList, tool] = node.args;
    if (typeof id?.literal !== 'string') continue;
    const inputItem = evalItem(input, locals);
    if (!inputItem) continue;
    const outputs = (outputList?.call === 'List.of' ? outputList.args : [outputList])
      .map((arg) => {
        if (arg?.call !== 'output') return null;
        const item = evalItem(arg.args[0], locals);
        if (!item) return null;
        return {...item, chance: arg.args[1]?.literal ?? 1};
      })
      .filter(Boolean);
    if (outputs.length === 0) continue;
    if (seen.has(id.literal)) continue;
    seen.add(id.literal);
    recipes.push({
      id: `cutting_board:${id.literal}`,
      station: 'cutting_board',
      displayName: name?.literal ?? null,
      inputs: [[inputItem]],
      tool: tool?.ref ? tool.ref.replace(/^CuttingBoardTool\./, '').toLowerCase() : 'knife',
      outputs,
      result: outputs[0],
    });
  }
  return recipes;
}

/** 煎锅：addDefaultRecipe(id, Material, Material) 或 addDefaultCustomRecipe(id, name, input, outputId, fallback) */
function extractSkillet(pluginRoot) {
  const source = readSource(pluginRoot, 'skillet/SkilletRecipeService.java');
  const methods = [...source.matchAll(/private (?:void|boolean) (createDefaultRecipes|ensure\w+)\s*\(/g)].map(
    (match) => match[1],
  );
  const {calls, locals} = gatherCalls(source, [...new Set(methods)]);
  const recipes = [];
  for (const node of calls) {
    if (node.call === 'addDefaultRecipe') {
      const [id, input, output] = node.args;
      if (!input?.ref?.startsWith('Material.')) continue;
      recipes.push({
        id: `skillet:${id.literal}`,
        station: 'skillet',
        displayName: null,
        inputs: [[{id: materialToId(input.ref), count: 1}]],
        result: {id: materialToId(output.ref), count: 1},
      });
      continue;
    }
    if (node.call === 'addDefaultCustomRecipe') {
      const [id, name, input, outputId] = node.args;
      const inputItem = evalItem(input, locals);
      if (!inputItem || typeof outputId?.literal !== 'string') continue;
      recipes.push({
        id: `skillet:${id.literal}`,
        station: 'skillet',
        displayName: name?.literal ?? null,
        inputs: [[inputItem]],
        result: {id: outputId.literal, count: 1},
      });
    }
  }
  return recipes;
}

/**
 * 木盆踩踏，四种注册方式：
 *   addRecipe(id, name, List.of(groups), container, output, liquidPrefix, liquidName, stomps, mbPerItem, bottleMb[, ...])
 *   addSingleIngredientRecipe(id, name, input, output, liquidPrefix, liquidName, mbPerItem, bottleMb)
 *   addDirectRecipe(id, name, input, output)
 */
function extractStompingBasin(pluginRoot) {
  const source = readSource(pluginRoot, 'stomping/StompingBasinRecipeService.java');
  const {calls, locals} = gatherCalls(source, ['createDefaultRecipes']);
  const recipes = [];
  for (const node of calls) {
    const [id, name] = node.args;
    if (typeof id?.literal !== 'string') continue;
    const base = {
      id: `stomping_basin:${id.literal}`,
      station: 'stomping_basin',
      displayName: name?.literal ?? null,
    };
    if (node.call === 'addRecipe') {
      // 两个重载：10 参（…stomps, mbPerItem, bottleMb）与 12 参（额外 liquidEnabled, directOutput）。
      const [, , groupList, container, output, , liquidName, stomps, mbPerItem, , , directOutput] =
        node.args;
      const result = evalItem(output, locals);
      if (!result) continue;
      recipes.push({
        ...base,
        inputs: evalGroupList(groupList, locals, {}),
        container: evalItem(container, locals),
        result,
        liquidName: evalLiteral(liquidName, locals) || null,
        stompsPerItem: evalLiteral(stomps, locals) ?? null,
        mbPerItem: evalLiteral(mbPerItem, locals) ?? null,
        direct: directOutput ? evalItem(directOutput, locals) : null,
      });
      continue;
    }
    if (node.call === 'addSingleIngredientRecipe') {
      const [, , input, output, , liquidName, mbPerItem] = node.args;
      const inputItem = evalItem(input, locals);
      const result = evalItem(output, locals);
      if (!inputItem || !result) continue;
      recipes.push({
        ...base,
        inputs: [[inputItem]],
        container: {id: 'minecraft:glass_bottle', count: 1},
        result,
        liquidName: evalLiteral(liquidName, locals) || null,
        mbPerItem: evalLiteral(mbPerItem, locals) ?? null,
        // 包装方法固定传 DEFAULT_STOMPS_PER_ITEM。
        stompsPerItem: locals.get('DEFAULT_STOMPS_PER_ITEM')?.literal ?? null,
      });
      continue;
    }
    if (node.call === 'addDirectRecipe') {
      const [, , input, output] = node.args;
      const inputItem = evalItem(input, locals);
      const result = evalItem(output, locals);
      if (!inputItem || !result) continue;
      // addDirectRecipe 关闭液体产出，直接产出成品，踩踏次数同为默认值。
      recipes.push({
        ...base,
        inputs: [[inputItem]],
        result,
        direct: result,
        mbPerItem: 1,
        stompsPerItem: locals.get('DEFAULT_STOMPS_PER_ITEM')?.literal ?? null,
      });
    }
  }
  return recipes;
}

/**
 * 捕蟹笼：不是配方，而是「群系 → 饵料 → 加权产出池」。
 * 数据源为蟹农插件的 config.yml，概率按池内 weight 归一化。
 */
/** 蟹农 config.yml 里 biomes 下的池键名对应的中文名。 */
const CRAB_BIOME_LABELS = {
  ocean: '海洋',
  river: '河流',
};

function extractCrabTrap(crabRoot) {
  const file = path.join(crabRoot, '蟹农插件/src/main/resources/config.yml');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const entries = [];
  let biome = null;
  let section = null;
  let bait = null;
  let matches = [];

  const indentOf = (line) => line.match(/^ */)[0].length;
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = indentOf(line);
    const text = line.trim();

    if (indent === 0) {
      section = text.replace(/:$/, '');
      biome = null;
      continue;
    }
    if (section !== 'biomes') continue;
    if (indent === 2) {
      biome = text.replace(/:$/, '');
      matches = [];
      bait = null;
      continue;
    }
    if (indent === 4) {
      bait = text === 'baits:' ? 'baits' : text.replace(/:$/, '');
      continue;
    }
    if (indent === 6) {
      if (text.startsWith('- ')) {
        matches.push(text.slice(2).trim());
        continue;
      }
      bait = text.replace(/:$/, '');
      continue;
    }
    if (indent >= 8 && text.startsWith('-') && bait) {
      const id = /id:\s*"([^"]+)"/.exec(text)?.[1];
      const weight = Number(/weight:\s*([\d.]+)/.exec(text)?.[1]);
      if (!id || !Number.isFinite(weight)) continue;
      let pool = entries.find((entry) => entry.biome === biome && entry.bait === bait);
      if (!pool) {
        pool = {biome, bait, matches: [...matches], outputs: []};
        entries.push(pool);
      }
      pool.outputs.push({id, weight});
    }
  }

  return entries.map((pool) => {
    const total = pool.outputs.reduce((sum, item) => sum + item.weight, 0);
    const outputs = pool.outputs
      .map((item) => ({id: item.id, count: 1, chance: item.weight / total, weight: item.weight}))
      .sort((a, b) => b.weight - a.weight);
    return {
      id: `crab_trap:${pool.biome}__${pool.bait.replace(/[^a-z0-9_]/gi, '_')}`,
      station: 'crab_trap',
      biomeLabel: CRAB_BIOME_LABELS[pool.biome] ?? pool.biome,
      biomes: pool.matches,
      bait: pool.bait === 'default' ? null : {id: pool.bait, count: 1},
      inputs: pool.bait === 'default' ? [] : [[{id: pool.bait, count: 1}]],
      outputs,
      // 加权随机池没有确定产物，不设 result。
      result: null,
    };
  });
}

/** 解析 g()-only 的辅助方法（cabbage/milkChoice/cheeseChoice 等）。 */
function collectNamedGroups(source, names) {
  const groups = {};
  for (const name of names) {
    const match = new RegExp(`${name}\\(\\)\\s*\\{\\s*return\\s+([^;]+);`).exec(source);
    if (!match) continue;
    const {calls} = extractMethodBody(`private void __tmp() { ${match[1]}; }`, '__tmp');
    if (calls[0]) groups[name] = evalGroup(calls[0], new Map(), {});
  }
  return groups;
}


/** 提取全部工作站配方（真实数据：Java 默认配方 + 蟹农 config.yml）。 */
export function extractWorkstationRecipes({pluginRoot, crabRoot}) {
  return [
    ...extractCask(pluginRoot),
    ...extractCookingPot(pluginRoot),
    ...extractCuttingBoard(pluginRoot),
    ...extractSkillet(pluginRoot),
    ...extractStompingBasin(pluginRoot),
    ...extractCrabTrap(crabRoot),
  ];
}
