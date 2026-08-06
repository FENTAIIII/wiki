# 配置总览

主配置文件是 `config.yml`。布局细节分散在 `first.yml`、`second.yml`、`third-left.yml`、`third-right.yml`、`hologram.yml` 与 `table.yml`，牌皮与语音分别在 `card-skins.yml`、`voice.yml`。

修改配置后可执行：

```text
/ddz reload
```

正在进行中的牌局可能会延迟应用部分配置，建议在低峰期调整关键项。

## 常用开关

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `detailed-log` | `false` | 是否在聊天栏输出叫地主、出牌、提示等详细过程 |
| `tencent-mode` | `false` | 是否使用腾讯斗地主式手牌顺序，最大牌在左 |
| `broadcast-on-join` | `true` | 玩家加入未满牌桌时是否发送全服可点击邀请 |
| `gsit-z-offset` | `true` | 使用 GSit 时对旋转 UI 做中心补偿 |

## 局内玩家与托管

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `player-session.movement-policy` | `LOCKED` | `LOCKED` 锁座只允许转头；`TETHERED` 允许在范围内移动 |
| `player-session.damage-protection` | `true` | 牌局玩家免伤，同时不能主动伤害实体 |
| `player-session.tether-radius` | `5.0` | TETHERED 水平活动半径，也是回桌判定范围 |
| `player-session.vertical-range` | `3.0` | 回桌和活动判定的垂直范围 |
| `player-session.trustee-delay-seconds` | `3` | 托管回合最短决策等待 |
| `player-session.state-cooldown-millis` | `2000` | 托管/回桌状态切换冷却 |
| `player-session.leave-trustee` | `true` | 局内 `/ddz leave` 是否转托管 |

## 牌局流程

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `game.bid-timeout` | `15` | 叫地主倒计时 |
| `game.play-timeout` | `30` | 正常出牌倒计时 |
| `game.no-beat-timeout` | `8` | 无牌可压时给本人保留的操作时间 |
| `game.no-beat-opponent-timeout` | `30` | 对敌方/旁观者显示的伪装倒计时 |
| `game.countdown-warning` | `5` | 倒计时警告阈值 |
| `game.auto-timeout` | `true` | 正常玩家超时是否自动行动 |
| `game.base-score` | `1` | 单桌赌注基础分 |
| `game.broadcast-interval` | `30` | 未满桌邀请广播间隔 |
| `game.broadcast-range` | `-1` | 广播范围；`-1` 通常表示全服 |
| `game.urge-cooldown` | `10` | 催促冷却秒数 |
| `game.spectator-visible` | `true` | 是否允许旁观 |
| `game.spectator-show-all` | `false` | 旁观者是否能看到所有私牌 |

欢乐豆牌桌无论 `spectator-show-all` 如何设置，都不会向旁观者展示私牌。

## 音频

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `audio.radius` | `5.0` | 桌面音频半径 |
| `game.music-gap-seconds` | `5` | 背景音乐间隔 |
| `game.tick-sound` | `BLOCK_NOTE_BLOCK_HAT` | 倒计时音效 |
| `game.urge-sound` | `ENTITY_VILLAGER_NO` | 催促音效 |
| `game.play-sound` | `ENTITY_ITEM_PICKUP` | 出牌音效 |
| `game.bomb-sound` | `ENTITY_GENERIC_EXPLODE` | 炸弹音效 |
| `game.win-sound` | `ENTITY_PLAYER_LEVELUP` | 胜利音效 |

## 牌桌与座位

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `table.material` | `OAK_PLANKS` | 默认中心桌面材质 |
| `table.stair-material` | `OAK_STAIRS` | 默认座位楼梯材质 |
| `table.size` | `3` | 默认牌桌尺寸 |
| `table.stair-layers` | `1` | 座位层数 |
| `table.allow-break` | `false` | 是否允许破坏桌面保护方块 |
| `seats.seat-distance` | `1.2` | 无坐下插件时的备选座位距离 |
| `seats.seat-y` | `0.0` | 备选座位高度 |
| `seats.angles` | `[0.0, 135.0, 225.0]` | 三个座位朝向 |
| `seats.cmi-sit` | `true` | 旧键名，启用坐下集成优先探测 |
| `seats.cmi-persistent` | `false` | 仅 CMI 生效 |

## 消息与催促文案

`messages` 下是聊天消息模板，支持 Bukkit `&` 颜色码。加入广播支持：

- `%player%`
- `%table%`

`urges` 是催促文案列表。`voice.yml` 的 `events.urge` 与该列表按顺序对应，如果调整文案顺序，建议同步调整语音列表。

