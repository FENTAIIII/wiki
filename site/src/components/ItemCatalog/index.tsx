import React, {useMemo, useState, type ReactNode} from 'react';
import data from '@site/src/data/recipes.json';
import ItemIcon from '@site/src/components/ItemIcon';
import styles from './styles.module.css';

type Category = {
  key: string;
  name: string;
  icon: string | null;
  hidden: boolean;
  children: string[];
  items: string[];
};

const CATEGORIES = data.categories as Category[];
const CATEGORY_BY_KEY = new Map(CATEGORIES.map((category) => [category.key, category]));

/** 物品 id -> 中文名。以语言文件导出的全量名称为底，再用配方数据补齐。 */
const ITEM_NAMES = new Map<string, string>(
  Object.entries((data as {itemNames?: Record<string, string>}).itemNames ?? {}),
);
for (const recipe of data.recipes as any[]) {
  if (recipe.result?.id && recipe.resultName) ITEM_NAMES.set(recipe.result.id, recipe.resultName);
  for (const list of Object.values(recipe.key ?? {}) as any[][]) {
    for (const entry of list) ITEM_NAMES.set(entry.id, entry.name);
  }
  for (const list of (recipe.ingredients ?? []) as any[][]) {
    for (const entry of list) ITEM_NAMES.set(entry.id, entry.name);
  }
}

/** 产出该物品的配方数量，用来标注「可合成」。 */
const CRAFTABLE = new Set(
  (data.recipes as any[]).map((recipe) => recipe.result?.id).filter(Boolean) as string[],
);

function itemLabel(id: string): string {
  return ITEM_NAMES.get(id) ?? id.split(':').pop() ?? id;
}

/** 渲染一个顶层分类（如「农夫乐事」）下的全部子分类与物品。 */
export function ItemCatalog({root}: {root: string}): ReactNode {
  const [query, setQuery] = useState('');
  const rootCategory = CATEGORY_BY_KEY.get(root);

  const groups = useMemo(() => {
    if (!rootCategory) return [];
    const children = rootCategory.children
      .map((key) => CATEGORY_BY_KEY.get(key))
      .filter(Boolean) as Category[];
    // 末地乐事这类扁平分类没有子分类，物品直接挂在根上，把根自身当成唯一一组。
    if (children.length === 0 && rootCategory.items.length > 0) return [rootCategory];
    return children;
  }, [rootCategory]);

  const keyword = query.trim().toLowerCase();
  const filtered = groups
    .map((group) => ({
      group,
      items: group.items.filter((id) => {
        if (!keyword) return true;
        return id.toLowerCase().includes(keyword) || itemLabel(id).toLowerCase().includes(keyword);
      }),
    }))
    .filter((entry) => entry.items.length > 0);

  if (!rootCategory) {
    return <div className={styles.empty}>没有找到分类 <code>{root}</code>。</div>;
  }

  const total = filtered.reduce((sum, entry) => sum + entry.items.length, 0);

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="搜索物品名称或 id"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className={styles.count}>共 {total} 项</span>
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>没有匹配的物品。</div>
      ) : (
        filtered.map(({group, items}) => (
          <section key={group.key} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {group.name}
              <span className={styles.groupCount}>{items.length}</span>
            </h3>
            <div className={styles.itemGrid}>
              {items.map((id) => (
                <div key={id} className={styles.item} title={id}>
                  <ItemIcon id={id} alt={itemLabel(id)} size={36} />
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{itemLabel(id)}</span>
                    <code className={styles.itemId}>{id}</code>
                    {CRAFTABLE.has(id) ? <span className={styles.craftable}>可合成</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default ItemCatalog;
