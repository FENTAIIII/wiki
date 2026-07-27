import MDXComponents from '@theme-original/MDXComponents';
import {RecipeBrowser, RecipeCard, RecipeFor, RecipeById, CraftingGrid} from '@site/src/components/Recipe';
import {ItemCatalog} from '@site/src/components/ItemCatalog';

// 注册为全局 MDX 组件，文档里无需 import 即可使用。
export default {
  ...MDXComponents,
  RecipeBrowser,
  RecipeCard,
  RecipeFor,
  RecipeById,
  CraftingGrid,
  ItemCatalog,
};
