import React, {useEffect, useMemo, useState, type ReactNode} from 'react';
import data from '@site/src/data/recipes.json';
import ItemIcon from '@site/src/components/ItemIcon';
import RecipeGui, {LiquidBar} from '@site/src/components/RecipeGui';
import {overflowOutputs, toGuiSlots} from '@site/src/components/RecipeGui/mapRecipe';
import styles from './styles.module.css';

type Entry = {id: string; name: string; count?: number};
type Output = {id: string; name: string; count?: number; chance?: number; weight?: number};

type Recipe = {
  id: string;
  type: string;
  typeLabel: string;
  category: string | null;
  station?: string;
  result: {id: string; count: number} | null;
  resultName: string | null;
  resultCategory: string | null;
  pattern?: string[];
  key?: Record<string, Entry[]>;
  ingredients?: Entry[][];
  outputs?: Output[];
  container?: Entry | null;
  bait?: Entry | null;
  biomes?: string[];
  tool?: string | null;
  recipeName?: string | null;
  liquidName?: string | null;
  stompsPerItem?: number;
  mbPerItem?: number;
  seconds?: number;
  experience?: number;
  cookingTime?: number;
};

const ALL_RECIPES = data.recipes as Recipe[];
const CATEGORIES = data.categories as {key: string; name: string; hidden: boolean}[];
const CATEGORY_NAME = new Map(CATEGORIES.map((category) => [category.key, category.name]));

/**
 * 物品 id -> 产出它的配方，用于材料点击追溯。
 * 捕蟹笼这类没有固定 result 的配方也把 outputs 计入，
 * 这样点海鲜材料同样能查到它的来源。
 */
const RECIPES_BY_OUTPUT = (() => {
  const index = new Map<string, Recipe[]>();
  const add = (id: string, recipe: Recipe) => {
    const list = index.get(id);
    if (list) {
      if (!list.includes(recipe)) list.push(recipe);
    } else {
      index.set(id, [recipe]);
    }
  };
  for (const recipe of ALL_RECIPES) {
    if (recipe.result?.id) add(recipe.result.id, recipe);
    for (const output of recipe.outputs ?? []) add(output.id, recipe);
  }
  return index;
})();

function recipesFor(id: string): Recipe[] {
  return RECIPES_BY_OUTPUT.get(id) ?? [];
}

function hasRecipeFor(id: string): boolean {
  return RECIPES_BY_OUTPUT.has(id);
}

/** 展开链上下文：记录已展开的物品，避免 A→B→A 无限递归。 */
const LookupChain = React.createContext<readonly string[]>([]);
/** 已展开的层数。产出 id 会进入 LookupChain 做去重，但不该算作深度。 */
const LookupDepth = React.createContext(0);
/** 追溯深度上限，防止长链把页面撑爆。 */
const MAX_LOOKUP_DEPTH = 4;

/**
 * 多候选材料每 1.2 秒轮换一个，模仿游戏里合成栏的循环展示。
 * 单候选时不启动定时器。
 */
function useCycle(length: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % length), 1200);
    return () => clearInterval(timer);
  }, [length]);
  return length < 2 ? 0 : index % length;
}

/** 单元格：显示材料图标，多候选时轮播并标注数量。 */
function Cell({entries}: {entries: Entry[] | undefined}) {
  const list = entries ?? [];
  const index = useCycle(list.length);

  if (list.length === 0) {
    return <div className={`${styles.cell} ${styles.cellEmpty}`} aria-label="空格" />;
  }
  const current = list[index];
  const title = list.map((entry) => `${entry.name}（${entry.id}）`).join(' 或 ');
  return (
    <div className={`${styles.cell} ${styles.cellFilled}`} title={title}>
      <ItemIcon id={current.id} alt={current.name} size={32} />
      {list.length > 1 ? <span className={styles.cellBadge}>{list.length}</span> : null}
    </div>
  );
}

/** 收集有多个可替换候选的材料，单独列在配方下方。 */
function Alternatives({recipe}: {recipe: Recipe}) {
  const groups: Entry[][] = [
    ...Object.values(recipe.key ?? {}),
    ...(recipe.ingredients ?? []),
  ].filter((entries) => entries.length > 1);
  if (groups.length === 0) return null;
  return (
    <div className={styles.alternatives}>
      <strong>可替换材料：</strong>
      <ul>
        {groups.map((entries, index) => (
          <li key={index}>
            {entries.map((entry) => (
              <span key={entry.id} className={styles.altEntry}>
                <ItemIcon id={entry.id} alt={entry.name} size={18} />
                {entry.name}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 3×3 有序合成网格。pattern 行不足 3 行、列不足 3 列时按左上对齐补空。 */
export function CraftingGrid({recipe}: {recipe: Recipe}) {
  const rows = recipe.pattern ?? [];
  const cells: (Entry[] | undefined)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      const symbol = rows[row]?.[column] ?? ' ';
      cells.push(symbol === ' ' ? undefined : recipe.key?.[symbol]);
    }
  }
  return (
    <div className={styles.grid}>
      {cells.map((entries, index) => (
        <Cell key={index} entries={entries} />
      ))}
    </div>
  );
}

/** 无序合成 / 熔炼类的材料列表。 */
function IngredientList({recipe}: {recipe: Recipe}) {
  return (
    <div className={styles.shapelessGrid}>
      {(recipe.ingredients ?? []).map((entries, index) => (
        <Cell key={index} entries={entries} />
      ))}
    </div>
  );
}

/** 材料清单：格子里只有图标，这里按去重后的材料列出名称和用量。 */
function IngredientSummary({
  recipe,
  onLookup,
  canLookup = hasRecipeFor,
  activeId,
}: {
  recipe: Recipe;
  onLookup?: (entry: Entry) => void;
  canLookup?: (id: string) => boolean;
  activeId?: string | null;
}) {
  const groups: Entry[][] = [
    ...Object.values(recipe.key ?? {}),
    ...(recipe.ingredients ?? []),
  ];
  // 有序合成里同一符号可能占多格，用量要按 pattern 中出现次数统计。
  const counts = new Map<string, {entry: Entry; count: number}>();
  if (recipe.type === 'shaped') {
    const used = (recipe.pattern ?? []).join('');
    for (const [symbol, entries] of Object.entries(recipe.key ?? {})) {
      const entry = entries[0];
      if (!entry) continue;
      const count = [...used].filter((char) => char === symbol).length;
      if (count > 0) counts.set(entry.id, {entry, count});
    }
  } else {
    for (const entries of groups) {
      const entry = entries[0];
      if (!entry) continue;
      const existing = counts.get(entry.id);
      if (existing) existing.count += 1;
      else counts.set(entry.id, {entry, count: 1});
    }
  }
  if (counts.size === 0) return null;
  return (
    <div className={styles.summary}>
      {[...counts.values()].map(({entry, count}) => {
        const inner = (
          <>
            <ItemIcon id={entry.id} alt={entry.name} size={20} />
            {entry.name}
            {count > 1 ? <span className={styles.summaryCount}>×{count}</span> : null}
          </>
        );
        // 没有配方的原始材料（矿物、野生作物等）保持纯文本，不做成假按钮。
        if (!onLookup || !canLookup(entry.id)) {
          return (
            <span key={entry.id} className={styles.summaryEntry} title={entry.id}>
              {inner}
            </span>
          );
        }
        const active = activeId === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            className={`${styles.summaryEntry} ${styles.summaryLookup} ${
              active ? styles.summaryActive : ''
            }`}
            title={`${entry.id}\n点击${active ? '收起' : '查看'}它的合成`}
            aria-expanded={active}
            onClick={() => onLookup(entry)}
          >
            {inner}
            <span className={styles.lookupMark} aria-hidden="true">
              {active ? '▾' : '›'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TOOL_LABEL: Record<string, string> = {
  knife: '小刀',
  axe: '斧',
  pickaxe: '镐',
  shovel: '锹',
  hoe: '锄',
  sword: '剑',
  shears: '剪刀',
};

/** GUI 视图：真实界面贴图 + 槽位叠加，附带该工作站的机制说明。 */
function GuiView({
  recipe,
  onLookup,
  canLookup = hasRecipeFor,
}: {
  recipe: Recipe;
  onLookup?: (entry: Entry) => void;
  canLookup?: (id: string) => boolean;
}) {
  const mapped = toGuiSlots(recipe as never);
  if (!mapped) return null;
  const overflow = overflowOutputs(recipe as never);
  const liquid =
    recipe.liquidName && recipe.mbPerItem != null
      ? `${recipe.liquidName} ${recipe.mbPerItem} mB`
      : null;
  return (
    <div className={styles.guiWrap}>
      <RecipeGui
        layout={mapped.layout}
        slots={mapped.slots}
        onLookup={onLookup}
        hasRecipe={canLookup}
      >
        {liquid ? <LiquidBar layout={mapped.layout} label={liquid} /> : null}
      </RecipeGui>
      {overflow.length > 0 ? (
        <div className={styles.overflow}>
          <strong>界面外的额外产出：</strong>
          {overflow.map((output) => (
            <span key={output.id} className={styles.altEntry}>
              <ItemIcon id={output.id} alt={output.name} size={18} />
              {output.name}
              {output.count && output.count > 1 ? `×${output.count}` : ''}
              {output.chance != null && output.chance < 1
                ? `（${(output.chance * 100).toFixed(0)}% 概率）`
                : ''}
            </span>
          ))}
          <span className={styles.noteInline}>游戏内界面只有两个产出槽，这些产出同样会掉落</span>
        </div>
      ) : null}
      <div className={styles.guiNotes}>
        {recipe.tool ? (
          <span className={styles.note}>
            所需工具：{TOOL_LABEL[recipe.tool] ?? recipe.tool}（放入界面刀具槽，同类工具均可）
          </span>
        ) : null}
        {recipe.container ? (
          <span className={styles.note}>容器：{recipe.container.name ?? recipe.container.id}</span>
        ) : null}
        {recipe.stompsPerItem != null ? (
          <span className={styles.note}>每个材料需踩踏 {recipe.stompsPerItem} 次</span>
        ) : null}
        {liquid ? <span className={styles.note}>每个材料产出 {liquid}</span> : null}
        {recipe.seconds != null ? <span className={styles.note}>耗时 {recipe.seconds} 秒</span> : null}
      </div>
    </div>
  );
}

/** 捕蟹笼是群系 + 饵料 + 加权随机池，不存在固定输入输出。 */
function CrabTrapMechanics({recipe}: {recipe: Recipe}) {
  if (recipe.type !== 'crab_trap') return null;
  const total = (recipe.outputs ?? []).reduce((sum, output) => sum + (output.weight ?? 0), 0);
  return (
    <div className={styles.mechanics}>
      <div className={styles.mechanicsRow}>
        <strong>饵料：</strong>
        {recipe.bait ? (
          <span className={styles.altEntry}>
            <ItemIcon id={recipe.bait.id} alt={recipe.bait.name ?? recipe.bait.id} size={18} />
            {recipe.bait.name ?? recipe.bait.id}
            <span className={styles.noteInline}>每次收获消耗 1 个</span>
          </span>
        ) : (
          <span className={styles.noteInline}>无需饵料，不消耗物品</span>
        )}
      </div>
      <div className={styles.mechanicsRow}>
        <strong>适用群系：</strong>
        <span className={styles.biomes}>
          {(recipe.biomes ?? []).map((biome) => (
            <code key={biome} className={styles.biome}>
              {biome}
            </code>
          ))}
        </span>
      </div>
      <div className={styles.mechanicsRow}>
        <strong>加权产出池：</strong>
        <span className={styles.noteInline}>
          每次收获从池中按权重随机抽取 1 项，权重合计 {total}
        </span>
      </div>
      <table className={styles.poolTable}>
        <thead>
          <tr>
            <th>产出</th>
            <th>数量</th>
            <th>权重</th>
            <th>概率</th>
          </tr>
        </thead>
        <tbody>
          {(recipe.outputs ?? []).map((output) => (
            <tr key={output.id}>
              <td>
                <span className={styles.altEntry}>
                  <ItemIcon id={output.id} alt={output.name} size={18} />
                  {output.name}
                </span>
              </td>
              <td>{output.count ?? 1}</td>
              <td>{output.weight ?? '-'}</td>
              <td>{output.chance != null ? `${(output.chance * 100).toFixed(1)}%` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecipeCard({recipe}: {recipe: Recipe}) {
  const categoryName = recipe.resultCategory ? CATEGORY_NAME.get(recipe.resultCategory) : null;
  const chain = React.useContext(LookupChain);
  const depth = React.useContext(LookupDepth);
  const [lookup, setLookup] = React.useState<Entry | null>(null);

  // 本卡产出也算在链上：材料里出现自己（如金块↔金锭）时不该再展开一层。
  const selfId = recipe.result?.id ?? null;
  const canExpand = depth < MAX_LOOKUP_DEPTH;
  // 链上已出现的物品直接视为不可追溯，这样它压根不会渲染成按钮。
  const canLookupId = React.useCallback(
    (id: string) => hasRecipeFor(id) && id !== selfId && !chain.includes(id),
    [chain, selfId],
  );
  const onLookup = canExpand
    ? (entry: Entry) => {
        if (!canLookupId(entry.id)) return;
        setLookup((current) => (current?.id === entry.id ? null : entry));
      }
    : undefined;

  const sub = lookup ? recipesFor(lookup.id) : [];
  const nextChain = React.useMemo(() => {
    if (!lookup) return chain;
    const next = [...chain, lookup.id];
    if (selfId && !next.includes(selfId)) next.push(selfId);
    return next;
  }, [chain, lookup, selfId]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {/* 捕蟹笼没有固定产物，标题前不放物品图标，避免出现无意义的占位符。 */}
        {recipe.result ? (
          <ItemIcon
            id={recipe.result.id}
            alt={recipe.resultName ?? recipe.id}
            size={22}
          />
        ) : null}
        <span className={styles.title}>{recipe.resultName ?? recipe.recipeName ?? recipe.id}</span>
        <span className={styles.badge}>{recipe.typeLabel}</span>
        {categoryName ? <span className={styles.badge}>{categoryName}</span> : null}
        <code className={styles.recipeId}>{recipe.id}</code>
      </div>
      <div className={styles.body}>
        <GuiView recipe={recipe} onLookup={onLookup} canLookup={canLookupId} />
      </div>
      <CrabTrapMechanics recipe={recipe} />
      <IngredientSummary
        recipe={recipe}
        onLookup={onLookup}
        canLookup={canLookupId}
        activeId={lookup?.id ?? null}
      />
      <Alternatives recipe={recipe} />
      {recipe.cookingTime != null || recipe.experience != null ? (
        <div className={styles.meta}>
          {recipe.cookingTime != null ? (
            <span>耗时：{recipe.cookingTime} tick（{(recipe.cookingTime / 20).toFixed(1)} 秒）</span>
          ) : null}
          {recipe.experience != null ? <span>经验：{recipe.experience}</span> : null}
        </div>
      ) : null}
      {lookup ? (
        <div className={styles.lookupPanel}>
          <div className={styles.lookupHead}>
            <ItemIcon id={lookup.id} alt={lookup.name} size={18} />
            <span>
              <strong>{lookup.name}</strong> 的合成
              {sub.length > 1 ? `（${sub.length} 种）` : ''}
            </span>
            <button
              type="button"
              className={styles.lookupClose}
              onClick={() => setLookup(null)}
            >
              收起
            </button>
          </div>
          {sub.length === 0 ? (
            <div className={styles.empty}>
              没有找到产出 <code>{lookup.id}</code> 的配方。
            </div>
          ) : (
            <LookupChain.Provider value={nextChain}>
              <LookupDepth.Provider value={depth + 1}>
                {sub.map((child) => (
                  <RecipeCard key={child.id} recipe={child} />
                ))}
              </LookupDepth.Provider>
            </LookupChain.Provider>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 按结果物品 id 精确渲染一条或多条配方，供文档内嵌使用。 */
export function RecipeFor({item}: {item: string}): ReactNode {
  const matched = ALL_RECIPES.filter((recipe) => recipe.result?.id === item);
  if (matched.length === 0) {
    return <div className={styles.empty}>没有找到产出 <code>{item}</code> 的配方。</div>;
  }
  return (
    <>
      {matched.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </>
  );
}

/** 按配方 id 渲染单条配方。 */
export function RecipeById({id}: {id: string}): ReactNode {
  const recipe = ALL_RECIPES.find((entry) => entry.id === id);
  if (!recipe) {
    return <div className={styles.empty}>没有找到配方 <code>{id}</code>。</div>;
  }
  return <RecipeCard recipe={recipe} />;
}

type BrowserProps = {
  /** 只显示指定合成类型，省略则全部。 */
  type?: string;
  /** 只显示产出属于该分类键的配方，省略则全部。 */
  category?: string;
  /** 关闭搜索与筛选工具栏。 */
  plain?: boolean;
};

/** 带搜索与筛选的配方浏览器。 */
export function RecipeBrowser({type, category, plain}: BrowserProps): ReactNode {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(type ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState(category ?? 'all');

  const base = useMemo(
    () =>
      ALL_RECIPES.filter((recipe) => {
        if (type && recipe.type !== type) return false;
        if (category && recipe.resultCategory !== category) return false;
        return true;
      }),
    [type, category],
  );

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return base.filter((recipe) => {
      if (typeFilter !== 'all' && recipe.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && recipe.resultCategory !== categoryFilter) return false;
      if (!keyword) return true;
      const haystack = [
        recipe.id,
        recipe.resultName ?? '',
        recipe.result?.id ?? '',
        ...Object.values(recipe.key ?? {}).flat().flatMap((entry) => [entry.id, entry.name]),
        ...(recipe.ingredients ?? []).flat().flatMap((entry) => [entry.id, entry.name]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [base, query, typeFilter, categoryFilter]);

  const availableTypes = useMemo(
    () => [...new Set(base.map((recipe) => recipe.type))],
    [base],
  );
  const availableCategories = useMemo(
    () => [...new Set(base.map((recipe) => recipe.resultCategory).filter(Boolean))] as string[],
    [base],
  );
  const typeLabel = (value: string) =>
    base.find((recipe) => recipe.type === value)?.typeLabel ?? value;

  return (
    <div>
      {plain ? null : (
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="搜索成品或材料名称、物品 id"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {type || availableTypes.length < 2 ? null : (
            <select
              className={styles.select}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="合成类型"
            >
              <option value="all">全部类型</option>
              {availableTypes.map((value) => (
                <option key={value} value={value}>
                  {typeLabel(value)}
                </option>
              ))}
            </select>
          )}
          {category || availableCategories.length < 2 ? null : (
            <select
              className={styles.select}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="物品分类"
            >
              <option value="all">全部分类</option>
              {availableCategories.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_NAME.get(value) ?? value}
                </option>
              ))}
            </select>
          )}
          <span className={styles.count}>共 {visible.length} 条</span>
        </div>
      )}
      {visible.length === 0 ? (
        <div className={styles.empty}>没有匹配的配方。</div>
      ) : (
        visible.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
      )}
    </div>
  );
}
