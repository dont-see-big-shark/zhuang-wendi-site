import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import multilingualPrerender from './scripts/multilingual-prerender.mjs';

export default defineConfig({
  site: 'https://zhuang-wendi-site.vercel.app',  // apex 域名会 308 重定向到 www（如后续绑定自定义域名再调整）
  integrations: [
    // 后台页面没有理由让搜索引擎收录。
    sitemap({ filter: (page) => !page.includes('/admin') }),
    // 文字分段包裹在构建期完成（放浏览器里做会让文字跳一下）
    multilingualPrerender(),
  ],
});
