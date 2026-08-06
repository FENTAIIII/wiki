# 命令与权限

主命令：

```text
/doudizhu
/ddz
```

## 玩家命令

需要权限：`doudizhu.play`

| 命令 | 说明 |
| --- | --- |
| `/ddz join [桌名]` | 加入指定牌桌；不填桌名则加入附近牌桌 |
| `/ddz leave` | 离开当前牌桌；局内按配置转托管或判负 |
| `/ddz trustee` | 主动托管本局 |
| `/ddz return` | 回到牌桌范围后取消托管 |
| `/ddz urge` | 催促当前行动玩家 |
| `/ddz skin` | 查看当前牌皮和可用牌皮 |
| `/ddz skin 〈牌皮ID〉` | 切换个人牌皮 |
| `/ddz skin reset` | 恢复默认牌皮 |

## 管理员命令

需要权限：`doudizhu.admin`

| 命令 | 说明 |
| --- | --- |
| `/ddz create 〈classic|laizi〉 〈桌名〉` | 对准中心方块创建牌桌 |
| `/ddz economy 〈桌名〉 〈on|off〉 [倍率]` | 开关单桌欢乐豆赌局，并设置倍率 |
| `/ddz stop 〈桌名〉` | 强制取消指定桌当前牌局 |
| `/ddz remove 〈桌名〉` | 移除指定牌桌 |
| `/ddz list` | 列出所有牌桌、位置、玩法、人数、状态 |
| `/ddz reload` | 重载配置 |
| `/ddz preview 〈on|off〉` | 开关静态布局调参预览 |
| `/ddz second 〈cards|buttons|pass〉` | 切换第二视角区域调试形态 |
| `/ddz third 〈left|right〉 〈cards|pass〉` | 切换左右第三视角区域调试形态 |
| `/ddz holo 〈info|join|effect〉 [文字]` | 切换全息区域调试形态 |

`second`、`third`、`holo` 更适合作者、调参人员或高级管理员使用。普通服主通常只需要 `preview`、`create`、`remove`、`reload`。

## 权限节点

| 权限 | 默认 | 说明 |
| --- | --- | --- |
| `doudizhu.play` | 所有玩家 | 普通游玩权限 |
| `doudizhu.admin` | OP | 管理牌桌、经济、强停、重载、调参 |
| `doudizhu.*` | OP | 包含全部权限 |

## 桌名规则

桌名必须为 1 到 32 个字符，可包含：

- 中文
- 英文
- 数字
- 下划线
- 短横线

不能是空字符串。

