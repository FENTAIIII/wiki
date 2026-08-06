# 牌桌布局与调参

## 牌桌数据

牌桌由管理员命令创建：

```text
/ddz create <classic|laizi> <桌名>
```

插件会把牌桌写入 `tables.yml`，包括：

- 桌名
- 世界
- 中心坐标
- 玩法类型
- 单桌经济开关
- 单桌倍率

旧版 `tables.yml` 中没有写玩法类型时，会按经典模式处理。没有写经济字段时，会按休闲桌处理。

## 牌桌方块保护

默认配置：

```yaml
table:
  material: OAK_PLANKS
  stair-material: OAK_STAIRS
  size: 3
  stair-layers: 1
  allow-break: false
```

`allow-break: false` 时会保护牌桌中心所在 Y 层的 3×3 方块，避免玩家破坏牌桌核心区域。

## 座位

默认三座位朝向：

```yaml
seats:
  angles: [0.0, 135.0, 225.0]
```

插件会优先使用 GSit，其次 CMI。两者都不可用时，玩家仍可正常游戏，只是不会由坐下插件接管座位姿态。

## 玩家移动策略

```yaml
player-session:
  movement-policy: LOCKED
```

可选：

- `LOCKED`：锁定座位，只允许转头。适合强沉浸实体桌。
- `TETHERED`：允许在牌桌范围内站立、走动、调整视角。适合活动服或不想强制坐下的服务器。

## 旁观

```yaml
game:
  spectator-visible: true
  spectator-show-all: false
```

- `spectator-visible` 控制是否允许旁观。
- `spectator-show-all` 控制旁观者是否能看到所有私牌。
- 欢乐豆牌桌始终不会向旁观者展示私牌，避免影响公平性。

## 布局文件

| 文件 | 用途 |
| --- | --- |
| `first.yml` | 第一视角/当前玩家区域 |
| `second.yml` | 第二视角区域 |
| `third-left.yml` | 左侧第三视角区域 |
| `third-right.yml` | 右侧第三视角区域 |
| `hologram.yml` | 全息信息、加入按钮、效果文本 |
| `table.yml` | 整体偏移、旋转与三座位副本 |

## 预览与调试命令

开启预览：

```text
/ddz preview on
```

关闭预览：

```text
/ddz preview off
```

调试不同区域：

```text
/ddz second <cards|buttons|pass>
/ddz third <left|right> <cards|pass>
/ddz holo <info|join|effect> [文字]
```

推荐调参流程：

1. 对准牌桌中心方块，开启 `/ddz preview on`。
2. 调整布局 yml。
3. 执行 `/ddz reload`。
4. 检查不同座位朝向下的牌面、按钮、全息文本。
5. 关闭预览。

