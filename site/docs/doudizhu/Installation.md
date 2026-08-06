# 安装与依赖

## 基础要求

- Minecraft 服务端：插件声明使用 Bukkit API `1.19`。
- Java 与服务端版本：以你正在运行的 Paper/Spigot/Folia 兼容要求为准。
- 安装文件：购买后获得的 `Doudizhu` 插件 JAR。

安装方式：

1. 停服。
2. 将插件 JAR 放入服务器 `plugins/` 目录。
3. 启动服务器，生成默认配置。
4. 根据需要安装可选依赖。
5. 调整配置后执行 `/ddz reload` 或重启服务器。

## 可选依赖

插件不会强制要求以下依赖存在。没有安装时，核心斗地主玩法仍可运行，相关增强功能会自动降级。

| 依赖 | 用途 | 备注 |
| --- | --- | --- |
| GSit | 玩家坐在座位方块上 | 同时存在 GSit 与 CMI 时优先 GSit |
| CMI | 玩家坐下集成 | 作为 GSit 之后的备选坐下方案 |
| Vault | 欢乐豆、游玩费、赌桌结算 | 还需要一个 Vault Economy 经济插件 |
| PlaceholderAPI | 排行榜与个人统计占位符 | 插件内置 PAPI 扩展，无需下载 eCloud 扩展 |
| CraftEngine | 字体牌皮/资源包牌面 | 没有资源包时会回退到普通文字牌 |

## 数据文件

运行后插件会在自己的数据目录中维护配置与运行数据：

- `config.yml`：全局行为、倒计时、经济基础项、座位、消息文案。
- `tables.yml`：已创建牌桌的位置、玩法类型、单桌欢乐豆状态。
- `first.yml`、`second.yml`、`third-left.yml`、`third-right.yml`、`hologram.yml`、`table.yml`：桌面可视化布局。
- `card-skins.yml`：牌皮配置。
- `voice.yml`：语音包事件配置。
- `stats.yml`：胜负统计。
- `stats.yml.bak`：统计备份。
- `wager-transactions.log`：Vault 交易流水保护日志。

## 安全提示

`stats.yml` 与 `wager-transactions.log` 是运行数据，通常不应公开。`wager-transactions.log` 可能包含玩家 UUID、桌名、交易金额与交易状态，排障时可给管理员核对，但不建议直接发到公开论坛。

