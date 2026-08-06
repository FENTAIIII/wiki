# 排行榜与 PlaceholderAPI

插件内置 PlaceholderAPI 扩展，标识符为：

```text
doudizhu
```

安装 PlaceholderAPI 后无需额外下载 eCloud 扩展。

## 统计范围

支持三个范围：

- 总榜：不加前缀。
- 经典榜：使用 `classic_` 前缀。
- 癞子榜：使用 `laizi_` 前缀。

统计项包括：

- games：总局数
- wins：胜场
- losses：负场
- win_rate：胜率
- rank：排名

## 玩家个人占位符

| 占位符 | 说明 |
| --- | --- |
| `%doudizhu_games%` | 当前玩家总局数 |
| `%doudizhu_wins%` | 当前玩家总胜场 |
| `%doudizhu_losses%` | 当前玩家总负场 |
| `%doudizhu_win_rate%` | 当前玩家总胜率 |
| `%doudizhu_rank%` | 当前玩家总榜排名 |
| `%doudizhu_classic_games%` | 当前玩家经典局数 |
| `%doudizhu_classic_wins%` | 当前玩家经典胜场 |
| `%doudizhu_classic_losses%` | 当前玩家经典负场 |
| `%doudizhu_classic_win_rate%` | 当前玩家经典胜率 |
| `%doudizhu_classic_rank%` | 当前玩家经典榜排名 |
| `%doudizhu_laizi_games%` | 当前玩家癞子局数 |
| `%doudizhu_laizi_wins%` | 当前玩家癞子胜场 |
| `%doudizhu_laizi_losses%` | 当前玩家癞子负场 |
| `%doudizhu_laizi_win_rate%` | 当前玩家癞子胜率 |
| `%doudizhu_laizi_rank%` | 当前玩家癞子榜排名 |

## TOP 排行榜占位符

格式：

```text
%doudizhu_top_<名次>_<字段>%
%doudizhu_classic_top_<名次>_<字段>%
%doudizhu_laizi_top_<名次>_<字段>%
```

字段可用：

- `name`
- `wins`
- `games`
- `losses`
- `win_rate`

示例：

```text
%doudizhu_top_1_name%
%doudizhu_top_1_wins%
%doudizhu_classic_top_3_win_rate%
%doudizhu_laizi_top_10_games%
```

## 空位显示

配置：

```yaml
leaderboard:
  max-position: 100
  empty-name: "-"
```

- `max-position` 控制允许查询的最大名次。
- 超出最大名次或没有对应玩家时，名称返回 `empty-name`，数值返回 `0`，胜率返回 `0.0%`。

## 数据保存

统计文件：

```text
stats.yml
```

备份文件：

```text
stats.yml.bak
```

插件会在内存中维护排行榜快照，并由单线程异步保存到磁盘。如果 `stats.yml` 损坏，会尝试从 `stats.yml.bak` 恢复。为保护数据，如果主文件和备份都无法读取，本次运行会停用排行榜写盘，但牌局本身不受影响。

