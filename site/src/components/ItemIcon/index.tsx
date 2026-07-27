import React, {useEffect, useState} from 'react';
import itemData from '@site/src/data/items.json';
import styles from './styles.module.css';

/** 层可以是单帧贴图的 URL，也可以是多帧动画贴图。frametime 是每帧停留的游戏刻。 */
type Layer = string | {url: string; frames: number; frametime?: number};

/** MC 一个游戏刻 50ms，贴图动画按 frametime 刻推进一帧。 */
const TICK_MS = 50;

const {icons: ICONS, tags: TAGS} = itemData as {
  icons: Record<string, Layer[]>;
  tags: Record<string, Layer[]>;
};

// 全站共用一个游戏刻计时器，避免每个动画图标各起一个 timer。
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

function subscribeTicks(listener: () => void) {
  tickListeners.add(listener);
  if (!tickTimer) {
    tickTimer = setInterval(() => {
      tickCount += 1;
      tickListeners.forEach((fn) => fn());
    }, TICK_MS);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/** 订阅游戏刻，仅在图标含多帧贴图时才真正走计时器。 */
function useTicks(enabled: boolean) {
  const [ticks, setTicks] = useState(tickCount);
  useEffect(() => {
    if (!enabled) return;
    return subscribeTicks(() => setTicks(tickCount));
  }, [enabled]);
  return ticks;
}

type Props = {
  /** 物品 id，如 default:tomato、minecraft:carrot。物品标签（#开头）没有图标。 */
  id: string;
  /** 边长像素，默认 32。 */
  size?: number;
  /** 无障碍标签，通常传中文名。 */
  alt?: string;
};

/**
 * 单个物品图标。贴图是 16×16 像素图，用 image-rendering: pixelated 放大保持锐利。
 * 银星作物等多层贴图按顺序叠加渲染。
 */
export function ItemIcon({id, size = 32, alt}: Props) {
  // 标签的成员是「任选其一」，逐个轮换展示；物品的多层是叠加，同时显示。
  const members = TAGS[id];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!members || members.length < 2) return;
    const timer = setInterval(() => setFrame((value) => (value + 1) % members.length), 1000);
    return () => clearInterval(timer);
  }, [members]);

  const layers = members ? [members[frame % members.length]] : ICONS[id];
  const label = alt ?? id;
  // 有任一层是多帧贴图才需要按刻推进，静态图标不订阅计时器。
  const animated = !!layers?.some((layer) => typeof layer !== 'string' && layer.frames > 1);
  const ticks = useTicks(animated);

  if (!layers || layers.length === 0) {
    // 物品标签或找不到贴图时退化成首字占位，避免布局塌陷。
    return (
      <span
        className={styles.fallback}
        style={{width: size, height: size, fontSize: size * 0.5}}
        title={label}
        aria-label={label}
        role="img"
      >
        {id.startsWith('#') ? '#' : '?'}
      </span>
    );
  }

  return (
    <span
      className={styles.icon}
      style={{width: size, height: size}}
      title={label}
      aria-label={label}
      role="img"
    >
      {layers.map((layer, index) => {
        const url = typeof layer === 'string' ? layer : layer.url;
        const frames = typeof layer === 'string' ? 1 : layer.frames;
        const frametime = typeof layer === 'string' ? 1 : layer.frametime ?? 1;
        // 动画贴图是竖排帧长图：放大到 frames 倍高度，再按当前帧上移一格露出对应帧。
        const current = frames > 1 ? Math.floor(ticks / Math.max(1, frametime)) % frames : 0;
        return (
          <span
            key={url}
            className={styles.layer}
            style={{
              zIndex: index,
              backgroundImage: `url(${url})`,
              backgroundSize: `${size}px ${size * frames}px`,
              backgroundPosition: `0 ${-current * size}px`,
            }}
          />
        );
      })}
    </span>
  );
}

export default ItemIcon;
