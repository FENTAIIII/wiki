import React, {useEffect, useState, type ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ItemIcon from '@site/src/components/ItemIcon';
import layouts from '@site/src/data/gui-layouts.json';
import styles from './styles.module.css';

export type Entry = {id: string; name: string};
export type Slot = {x: number; y: number};

export type Layout = {
  /** 有容器界面的工作站用贴图；营火这类没有 GUI 的用 layout 标记场景化渲染。 */
  image?: string;
  layout?: 'campfire';
  /** 场景化布局里作为底座的方块，例如营火。 */
  block?: {id: string; x: number; y: number; size: number};
  width: number;
  height: number;
  inputs?: Slot[];
  inputGrid?: {cols: number; rows: number};
  result?: Slot;
  outputs?: Slot[];
  container?: Slot;
  fuel?: Slot;
  bait?: Slot;
  /** 砧板的刀具槽，游戏内是独立槽位。 */
  tool?: Slot;
  liquid?: {x: number; y: number; width: number; height: number};
  /**
   * 与配方无关的固定装饰物品，例如小木桶界面的气泡与灯。
   * 插件配方浏览用 createVisualItem 构建（setHideTooltip(true)），默认不显示 tooltip；
   * 配了 title 的装饰额外提供说明（如灯槽的光照速率），文案取自插件运行态定义。
   */
  decorations?: {slot: number; item: string; x: number; y: number; title?: string}[];
};

const LAYOUTS = layouts as unknown as Record<string, Layout>;

/** GUI 贴图按整数倍放大，保持像素锐利。 */
const SCALE = 2;
/** 槽位内物品的原始边长（Minecraft 物品是 16×16）。 */
const ITEM = 16;

export function getLayout(name: string): Layout | undefined {
  return LAYOUTS[name];
}

/** 多候选材料轮播，与旧组件保持一致的 1.2 秒节奏。 */
function useCycle(length: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % length), 1200);
    return () => clearInterval(timer);
  }, [length]);
  return length < 2 ? 0 : index % length;
}

type SlotItemProps = {
  slot: Slot;
  entries: Entry[];
  count?: number;
  /** 额外标注，例如「工具」「容器」「饵料」。 */
  role?: string;
  /** 标记为材料槽，配合 onLookup 变成可点击的配方追溯入口。 */
  lookup?: boolean;
};

type SlotItemExtra = {
  /** 点击材料槽时回调当前轮播到的物品，由上层决定展开哪条配方。 */
  onLookup?: (entry: Entry) => void;
  /** 已经能查到配方的物品 id 集合，只有命中的槽才显示为可点。 */
  hasRecipe?: (id: string) => boolean;
};

/** 把一个物品叠加到背景图的真实槽位上。 */
function SlotItem({slot, entries, count, role, lookup, onLookup, hasRecipe}: SlotItemProps & SlotItemExtra) {
  const index = useCycle(entries.length);
  if (entries.length === 0) return null;
  const current = entries[index];
  const names = entries.map((entry) => `${entry.name}（${entry.id}）`).join(' 或 ');
  const base = role ? `${role}：${names}` : names;
  // 只有材料槽、且该物品确实有配方时才可点，避免点了没反应。
  const clickable = Boolean(lookup && onLookup && hasRecipe?.(current.id));
  const title = clickable ? `${base}\n点击查看它的合成` : base;
  const style = {
    left: slot.x * SCALE,
    top: slot.y * SCALE,
    width: ITEM * SCALE,
    height: ITEM * SCALE,
  };
  const inner = (
    <>
      <ItemIcon id={current.id} alt={current.name} size={ITEM * SCALE} />
      {count != null && count > 1 ? <span className={styles.count}>{count}</span> : null}
      {entries.length > 1 ? <span className={styles.alt}>{entries.length}</span> : null}
    </>
  );

  if (!clickable) {
    return (
      <div className={styles.slot} style={style} title={title}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.slot} ${styles.slotLookup}`}
      style={style}
      title={title}
      aria-label={`查看 ${current.name} 的合成`}
      onClick={() => onLookup!(current)}
    >
      {inner}
    </button>
  );
}

export type GuiSlotSpec = SlotItemProps;
export type LookupEntry = Entry;

type RecipeGuiProps = {
  /** gui-layouts.json 中的布局键，例如 crafting_table、cooking_pot。 */
  layout: string;
  /** 已解析好坐标的槽位内容。 */
  slots: GuiSlotSpec[];
  /** 叠加在背景上的自定义节点，例如木盆液体条。 */
  children?: ReactNode;
  /** 点击材料槽的回调，用于就地展开该材料的配方。 */
  onLookup?: (entry: Entry) => void;
  /** 判断某个物品是否有配方可查。 */
  hasRecipe?: (id: string) => boolean;
};

/** 工作站 GUI：真实界面贴图作背景，物品按实测坐标绝对定位叠加。 */
export default function RecipeGui({layout, slots, children, onLookup, hasRecipe}: RecipeGuiProps): ReactNode {
  const config = LAYOUTS[layout];
  const imageUrl = useBaseUrl(config?.image ?? '');
  if (!config) {
    return <div className={styles.missing}>缺少 GUI 布局：<code>{layout}</code></div>;
  }
  const scene = config.layout === 'campfire';
  return (
    <div
      className={scene ? styles.scene : styles.gui}
      style={{
        width: config.width * SCALE,
        height: config.height * SCALE,
        ...(config.image
          ? {
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${config.width * SCALE}px ${config.height * SCALE}px`,
            }
          : null),
      }}
    >
      {config.block ? (
        <div
          className={styles.block}
          style={{
            left: config.block.x * SCALE,
            top: config.block.y * SCALE,
            width: config.block.size * SCALE,
            height: config.block.size * SCALE,
          }}
          title="点燃的营火"
        >
          <ItemIcon id={config.block.id} alt="营火" size={config.block.size * SCALE} />
        </div>
      ) : null}
      {scene ? <span className={styles.sceneArrow}>→</span> : null}
      {config.decorations?.map((decoration) => (
        <div
          key={decoration.slot}
          className={decoration.title ? styles.decorationHint : styles.decoration}
          style={{
            left: decoration.x * SCALE,
            top: decoration.y * SCALE,
            width: ITEM * SCALE,
            height: ITEM * SCALE,
          }}
          {...(decoration.title
            ? {title: decoration.title}
            : {'aria-hidden': 'true' as const})}
        >
          <ItemIcon
            id={decoration.item}
            alt={decoration.title ? decoration.title.split('\n')[0] : ''}
            size={ITEM * SCALE}
          />
        </div>
      ))}
      {slots.map((slot, index) => (
        <SlotItem key={index} {...slot} onLookup={onLookup} hasRecipe={hasRecipe} />
      ))}
      {children}
    </div>
  );
}

/** 木盆液体槽：不是物品槽，用文字条展示液体名与容量。 */
export function LiquidBar({layout, label}: {layout: string; label: string}): ReactNode {
  const config = LAYOUTS[layout];
  if (!config?.liquid) return null;
  const {x, y, width, height} = config.liquid;
  return (
    <div
      className={styles.liquid}
      style={{
        left: x * SCALE,
        top: y * SCALE,
        width: width * SCALE,
        height: height * SCALE,
      }}
      title={label}
    >
      {label}
    </div>
  );
}

export {SCALE as GUI_SCALE};
