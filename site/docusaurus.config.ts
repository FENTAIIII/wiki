import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '农夫乐事 Wiki',
  tagline: '农夫乐事 / 暖风丰年 / 末地乐事 整合内容指南',
  favicon: 'img/favicon.ico',

  // Docusaurus v4 未来标记，参见 https://docusaurus.io/blog/releases/3.10
  future: {
    v4: true,
  },

  url: 'https://q761070659.github.io',
  baseUrl: '/NSG/',

  organizationName: 'q761070659',
  projectName: 'NSG',

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
          routeBasePath: '/',
          // 文档结构较小，不显示"编辑此页"
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '农夫乐事 Wiki',
      items: [
        {type: 'docSidebar', sidebarId: 'wikiSidebar', position: 'left', label: '文档'},
        {to: '/recipes/crafting', label: '合成表', position: 'left'},
        {to: '/stations/overview', label: '设备使用', position: 'left'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '玩法',
          items: [
            {label: '快速上手', to: '/'},
            {label: '合成表总览', to: '/recipes/crafting'},
            {label: '设备使用', to: '/stations/overview'},
          ],
        },
        {
          title: '参考',
          items: [
            {label: '物品图鉴', to: '/items/catalog'},
            {label: '成就一览', to: '/advancements'},
            {label: '管理员指南', to: '/admin/commands'},
          ],
        },
      ],
      copyright: '农夫乐事 Wiki · 数据来自 CraftEngine 配置与 NongStoveIgniter 插件源码',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['yaml', 'java'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
