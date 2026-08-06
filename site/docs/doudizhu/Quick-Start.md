# 快速开始

## 创建第一张牌桌

1. 在服务器里搭好一个牌桌中心方块。默认中心材质建议使用 `OAK_PLANKS`，座位默认使用 `OAK_STAIRS`。
2. 管理员站在牌桌附近，对准中心方块。
3. 创建经典桌：

```text
/ddz create classic test
```

4. 或创建天地癞子桌：

```text
/ddz create laizi test_laizi
```

5. 玩家加入：

```text
/ddz join test
```

不填写桌名时，插件会尝试加入附近 12 格内最近的牌桌。

## 开始一局

三名玩家入座后自动开局：

1. 系统洗牌，每人 17 张，桌面保留 3 张底牌。
2. 随机一名玩家先叫地主。
3. 三名玩家依次选择叫/抢或不叫。
4. 最后一名叫/抢的玩家成为地主并获得底牌。
5. 地主先出牌，按顺时针轮流出牌或不出。
6. 任意玩家手牌出完即结束。

## 常用玩家命令

```text
/ddz join [桌名]
/ddz leave
/ddz trustee
/ddz return
/ddz urge
/ddz skin [牌皮ID|reset]
```

## 常用管理员命令

```text
/ddz create <classic|laizi> <桌名>
/ddz economy <桌名> <on|off> [倍率]
/ddz stop <桌名>
/ddz remove <桌名>
/ddz list
/ddz reload
/ddz preview <on|off>
```

## 新服推荐配置顺序

1. 先不启用 Vault 赌桌，只测试休闲玩法。
2. 创建一张经典桌和一张癞子桌。
3. 测试加入、叫地主、出牌、不出、托管、回桌、强停。
4. 安装 PlaceholderAPI 后测试排行榜占位符。
5. 如果要做欢乐豆赌桌，再安装 Vault 与经济插件。
6. 确认 `wager-transactions.log` 能正常写入磁盘后，再对玩家开放赌桌。

