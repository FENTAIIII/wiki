import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '酚酞的桌游宇宙',
  tagline: 'Minecraft 桌游插件的安装、玩法与管理指南',

  future: {
    v4: true,
  },

  url: 'https://fentaiiii.github.io',
  baseUrl: '/wiki/',
  organizationName: 'FENTAIIII',
  projectName: 'wiki',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: 'https://github.com/FENTAIIII/wiki/edit/main/site/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        docsRouteBasePath: '/docs',
        indexBlog: false,
        language: ['zh', 'en'],
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  themeConfig: {
    image: 'og.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '酚酞的桌游宇宙',
      items: [
        {to: '/docs/sanguo', label: '三国杀', position: 'left'},
        {to: '/docs/doudizhu', label: '斗地主', position: 'left'},
        {type: 'docSidebar', sidebarId: 'universeSidebar', label: '全部文档', position: 'left'},
        {type: 'search', position: 'right'},
        {
          href: 'https://github.com/FENTAIIII',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '桌游 Wiki',
          items: [
            {label: 'Sanguo 三国杀', to: '/docs/sanguo'},
            {label: 'doudizhu 斗地主', to: '/docs/doudizhu'},
          ],
        },
        {
          title: '常用入口',
          items: [
            {label: '三国杀安装', to: '/docs/sanguo/installation'},
            {label: '斗地主安装', to: '/docs/doudizhu/Installation'},
            {label: '问题排查', to: '/docs/sanguo/troubleshooting'},
          ],
        },
        {
          title: '项目',
          items: [
            {label: 'FENTAIIII', href: 'https://github.com/FENTAIIII'},
            {label: '本站源码', href: 'https://github.com/FENTAIIII/wiki'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} 酚酞的桌游宇宙`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['yaml', 'java', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
