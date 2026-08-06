import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  universeSidebar: [
    {
      type: 'category',
      label: 'Sanguo · 三国杀',
      collapsed: false,
      link: {type: 'doc', id: 'sanguo/index'},
      items: [
        'sanguo/installation',
        'sanguo/quick-start',
        'sanguo/player-guide',
        'sanguo/modes-and-rules',
        'sanguo/commands-and-permissions',
        'sanguo/configuration',
        'sanguo/economy-and-placeholders',
        'sanguo/resources-and-audio',
        'sanguo/troubleshooting',
        'sanguo/faq',
      ],
    },
    {
      type: 'category',
      label: 'doudizhu · 斗地主',
      collapsed: true,
      link: {type: 'doc', id: 'doudizhu/index'},
      items: [
        'doudizhu/Installation',
        'doudizhu/Quick-Start',
        'doudizhu/Player-Guide',
        'doudizhu/Classic-Mode',
        'doudizhu/Laizi-Mode',
        'doudizhu/Commands-and-Permissions',
        'doudizhu/Configuration',
        'doudizhu/Economy-and-Vault',
        'doudizhu/Placeholders-and-Leaderboards',
        'doudizhu/Skins-and-Voice',
        'doudizhu/Tables-and-UI',
        'doudizhu/Troubleshooting',
        'doudizhu/FAQ',
      ],
    },
  ],
};

export default sidebars;
