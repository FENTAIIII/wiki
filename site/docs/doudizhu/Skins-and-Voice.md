# 牌皮与语音包

## 牌皮系统

配置文件：

```text
card-skins.yml
```

总开关：

```yaml
enabled: AUTO
default-skin: default
```

可选值：

- `AUTO`：检测到 CraftEngine 时启用。
- `TRUE`：尝试启用，但仍要求 CraftEngine 存在。
- `FALSE`：彻底关闭。

如果未安装 CraftEngine 或客户端没有资源包，插件会回退到普通文字牌，避免显示方框字符。

## 玩家切换牌皮

```text
/ddz skin
/ddz skin <牌皮ID>
/ddz skin reset
```

## 牌皮权限

每套牌皮可配置独立权限：

```yaml
skins:
  premium:
    display-name: "&6高级牌皮"
    permission: "doudizhu.skin.premium"
    enabled: true
```

`permission` 留空表示所有玩家可用。付费牌皮可以交给权限插件、商城插件或礼包系统发放。

## 牌面匹配规则

`match` 支持：

- `red-joker`
- `black-joker`
- `spade-A`
- `heart-2`
- `club-A`
- `diamond-10`
- `rank-2`
- `laizi-3`
- `laizi-*`

牌皮可以只覆盖部分牌，其他牌继承父牌皮或回退普通文字。

示例：

```yaml
premium:
  display-name: "&6高级牌皮"
  permission: "doudizhu.skin.premium"
  inherits: default
  enabled: true
  glyph-defaults:
    font: "your_namespace:cards"
    offset: {x: 0.0, y: 0.0, z: 0.02}
    scale: 1.25
  glyphs:
    all-twos:
      match: rank-2
      codepoint: 58033
    any-laizi:
      match: laizi-*
      codepoint: 58034
```

## 语音包

配置文件：

```text
voice.yml
```

语音资源可由 CraftEngine、Oraxen、ItemsAdder 或原版服务器资源包提供。插件本身不依赖这些资源包插件；客户端没有对应声音时会安静跳过。

## 听众范围

默认：

```yaml
audience: TABLE
```

可选：

- `TABLE`：牌桌附近玩家，使用主配置 `audio.radius`。
- `ACTOR`：仅操作者。
- `NEARBY`：使用 `voice.yml` 中的 `radius`。
- `WORLD`：同世界。
- `SERVER`：全服。

每个事件可以单独覆盖听众、音量、音调、概率等。

## 常见事件

| 事件 | 说明 |
| --- | --- |
| `bid-call` | 叫地主 |
| `bid-grab` | 抢地主 |
| `bid-pass` | 不叫 |
| `manual-pass` | 主动不出 |
| `no-beat` | 要不起随机台词 |
| `play-beat` | 管上 |
| `combo-three-with-one` | 三带一 |
| `combo-bomb` | 炸弹 |
| `urge` | 催促，按 `config.yml` 的催促文案顺序对应 |

## 防刷与叠音

```yaml
cooldown-millis: 250
stop-previous: true
```

- `cooldown-millis` 防止连点语音叠在一起。
- `stop-previous` 会停止本插件上一次播放的声音 ID。

