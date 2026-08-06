import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const games = [
  {
    eyebrow: 'SANGUO',
    glyph: '将',
    title: '三国杀',
    description: '真实 Noname 规则引擎、三/五/八人模式、实体牌桌与完整语音。',
    href: '/docs/sanguo',
    install: '/docs/sanguo/installation',
    accent: 'red',
  },
  {
    eyebrow: 'DOUDIZHU',
    glyph: '王',
    title: '斗地主',
    description: '经典与天地癞子玩法、经济系统、排行榜、牌桌与管理员文档。',
    href: '/docs/doudizhu',
    install: '/docs/doudizhu/Installation',
    accent: 'blue',
  },
] as const;

export default function Home() {
  return (
    <Layout
      title="首页"
      description="酚酞的桌游宇宙：Sanguo 与 doudizhu Minecraft 插件 Wiki">
      <main>
        <section className={styles.hero}>
          <div className={styles.orbit} aria-hidden="true">
            <span className={styles.orbitCore}>酚</span>
            <span className={styles.orbitDotOne}>将</span>
            <span className={styles.orbitDotTwo}>王</span>
          </div>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>FENTAI'S TABLETOP UNIVERSE</span>
            <Heading as="h1">酚酞的桌游宇宙</Heading>
            <p>
              把复杂插件讲成人话。安装时照着放文件，开服后照着输指令，
              遇到问题按现象排查。
            </p>
            <div className={styles.heroActions}>
              <Link className="button button--primary button--lg" to="/docs/sanguo/installation">
                安装三国杀
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/doudizhu">
                浏览全部 Wiki
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.library}>
          <div className={styles.sectionHeading}>
            <span>NOW PLAYING</span>
            <Heading as="h2">选择一张桌子</Heading>
            <p>这里是桌游插件的总入口，后续新游戏会继续加入。</p>
          </div>
          <div className={styles.gameGrid}>
            {games.map((game) => (
              <article className={`${styles.gameCard} ${styles[game.accent]}`} key={game.title}>
                <div className={styles.cardTop}>
                  <span className={styles.eyebrow}>{game.eyebrow}</span>
                  <span className={styles.glyph} aria-hidden="true">{game.glyph}</span>
                </div>
                <Heading as="h3">{game.title}</Heading>
                <p>{game.description}</p>
                <div className={styles.cardLinks}>
                  <Link to={game.href}>进入 Wiki <span aria-hidden="true">→</span></Link>
                  <Link to={game.install}>安装教程</Link>
                </div>
              </article>
            ))}
            <article className={`${styles.gameCard} ${styles.future}`}>
              <div className={styles.cardTop}>
                <span className={styles.eyebrow}>NEXT TABLE</span>
                <span className={styles.glyph} aria-hidden="true">＋</span>
              </div>
              <Heading as="h3">下一款桌游</Heading>
              <p>站点结构已经为新的桌游插件预留位置。</p>
              <div className={styles.cardLinks}>
                <span>敬请期待</span>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.promise}>
          <div>
            <span className={styles.promiseNumber}>01</span>
            <strong>固定目录</strong>
            <p>告诉你文件放哪，不让你猜路径。</p>
          </div>
          <div>
            <span className={styles.promiseNumber}>02</span>
            <strong>玩家和服主分开写</strong>
            <p>只看自己需要的那一页。</p>
          </div>
          <div>
            <span className={styles.promiseNumber}>03</span>
            <strong>先给答案</strong>
            <p>排障按现象走，不从源码讲起。</p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
