import {getLayout, type GuiSlotSpec} from './index';

type Entry = {id: string; name?: string; count?: number};
type Output = {id: string; name?: string; count?: number; chance?: number; weight?: number};

export type AnyRecipe = {
  id: string;
  type: string;
  station?: string;
  result: {id: string; count: number} | null;
  resultName?: string | null;
  pattern?: string[];
  key?: Record<string, Entry[]>;
  ingredients?: Entry[][];
  outputs?: Output[];
  container?: Entry | null;
  bait?: Entry | null;
  tool?: string | null;
  /** 烹饪锅专属：true 表示仅金烹饪锅可制作（CookingPotRecipeService.addGoldRecipe）。 */
  gold?: boolean;
};

/** 配方 type -> gui-layouts.json 布局键。 */
const LAYOUT_BY_TYPE: Record<string, string> = {
  shaped: 'crafting_table',
  shapeless: 'crafting_table',
  smelting: 'furnace',
  blasting: 'blast_furnace',
  smoking: 'smoker',
  campfire_cooking: 'campfire',
  cask: 'cask',
  cooking_pot: 'cooking_pot',
  cutting_board: 'cutting_board',
  skillet: 'skillet',
  stomping_basin: 'stomping_basin',
  crab_trap: 'crab_trap',
};

export function layoutKeyFor(recipe: AnyRecipe): string | undefined {
  // goldOnly 配方在游戏内换用金锅界面（CookingPotRecipeGui 的 gold-view-title）。
  if (recipe.type === 'cooking_pot' && recipe.gold) return 'cooking_pot_gold';
  return LAYOUT_BY_TYPE[recipe.type];
}

const named = (entry: Entry | Output) => ({id: entry.id, name: entry.name ?? entry.id});

/**
 * 砧板刀具槽在游戏内展示的物品，来自 CuttingBoardRecipeGui.refreshKnifeSlot：
 * KNIFE 轮播 CuttingBoardService.KNIFE_ID_LIST，AXE / SHOVEL 用铁质工具占位。
 */
const TOOL_DISPLAY: Record<string, Entry[]> = {
  knife: [
    {id: 'default:flint_knife', name: '燧石小刀'},
    {id: 'default:iron_knife', name: '铁质小刀'},
    {id: 'default:golden_knife', name: '金质小刀'},
    {id: 'default:diamond_knife', name: '钻石小刀'},
    {id: 'default:netherite_knife', name: '下界合金小刀'},
  ],
  axe: [{id: 'minecraft:iron_axe', name: '铁斧'}],
  shovel: [{id: 'minecraft:iron_shovel', name: '铁锹'}],
};

const TOOL_ROLE: Record<string, string> = {
  knife: '刀具槽：任意小刀均可切割',
  axe: '刀具槽：任意斧均可切割',
  shovel: '刀具槽：任意锹均可切割',
};

/** 超出 GUI 产出槽数量、只能在界面外列出的产出。 */
export function overflowOutputs(recipe: AnyRecipe): Output[] {
  const key = layoutKeyFor(recipe);
  const layout = key ? getLayout(key) : undefined;
  const cells = layout?.outputs?.length ?? 0;
  if (!cells) return [];
  return (recipe.outputs ?? []).slice(cells);
}

/**
 * 有序合成：按 pattern 的符号落到 3×3 的对应槽位；空格跳过。
 * 其它类型：ingredients 按顺序铺进 inputs。
 */
function inputSlots(recipe: AnyRecipe, layout: NonNullable<ReturnType<typeof getLayout>>): GuiSlotSpec[] {
  const slots = layout.inputs ?? [];
  const result: GuiSlotSpec[] = [];
  if (recipe.type === 'shaped') {
    const cols = layout.inputGrid?.cols ?? 3;
    const rows = recipe.pattern ?? [];
    for (let row = 0; row < rows.length; row++) {
      for (let column = 0; column < rows[row].length; column++) {
        const symbol = rows[row][column];
        if (symbol === ' ') continue;
        const entries = recipe.key?.[symbol];
        const slot = slots[row * cols + column];
        if (!entries?.length || !slot) continue;
        result.push({slot, entries: entries.map(named), count: entries[0].count, lookup: true});
      }
    }
    return result;
  }
  const list = recipe.ingredients ?? [];
  for (let index = 0; index < list.length; index++) {
    const entries = list[index];
    const slot = slots[index];
    if (!entries?.length || !slot) continue;
    result.push({slot, entries: entries.map(named), count: entries[0].count, lookup: true});
  }
  return result;
}

/**
 * 把一条配方转成 RecipeGui 需要的槽位列表。
 * 捕蟹笼没有固定产物，产出走 outputs 展示行，饵料走 bait 槽。
 */
export function toGuiSlots(recipe: AnyRecipe): {layout: string; slots: GuiSlotSpec[]} | null {
  const key = layoutKeyFor(recipe);
  if (!key) return null;
  const layout = getLayout(key);
  if (!layout) return null;

  const slots: GuiSlotSpec[] = [];

  if (recipe.type === 'crab_trap') {
    if (recipe.bait && layout.bait) {
      slots.push({slot: layout.bait, entries: [named(recipe.bait)], role: '饵料', lookup: true});
    }
    const cells = layout.outputs ?? [];
    (recipe.outputs ?? []).forEach((output, index) => {
      const slot = cells[index];
      if (!slot) return;
      const percent = output.chance != null ? `${(output.chance * 100).toFixed(1)}%` : undefined;
      slots.push({
        slot,
        entries: [named(output)],
        count: output.count,
        role: percent ? `产出概率 ${percent}（权重 ${output.weight ?? '-'}）` : '产出',
      });
    });
    return {layout: key, slots};
  }

  slots.push(...inputSlots(recipe, layout));

  // 砧板界面有独立刀具槽，展示的是工具类别对应的示例物品。
  if (recipe.tool && layout.tool) {
    const entries = TOOL_DISPLAY[recipe.tool];
    if (entries?.length) {
      slots.push({slot: layout.tool, entries, role: TOOL_ROLE[recipe.tool] ?? '刀具槽'});
    }
  }

  if (recipe.container && layout.container) {
    slots.push({slot: layout.container, entries: [named(recipe.container)], role: '容器'});
  }

  // 砧板界面有两个并排产出槽；其余工作站与原版用单一 result 槽。
  const multi = layout.outputs ?? [];
  if (multi.length > 0 && (recipe.outputs?.length ?? 0) > 0) {
    recipe.outputs!.slice(0, multi.length).forEach((output, index) => {
      const slot = multi[index];
      if (!slot) return;
      const percent = output.chance != null && output.chance < 1
        ? `（${(output.chance * 100).toFixed(0)}% 概率）`
        : '';
      slots.push({
        slot,
        entries: [named(output)],
        count: output.count,
        role: `产出${percent}`,
      });
    });
  } else if (recipe.result && layout.result) {
    slots.push({
      slot: layout.result,
      entries: [{id: recipe.result.id, name: recipe.resultName ?? recipe.result.id}],
      count: recipe.result.count,
      role: '产出',
    });
  } else if (recipe.result && multi.length > 0) {
    slots.push({
      slot: multi[0],
      entries: [{id: recipe.result.id, name: recipe.resultName ?? recipe.result.id}],
      count: recipe.result.count,
      role: '产出',
    });
  }

  return {layout: key, slots};
}
