import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import multilingualPrerender from './scripts/multilingual-prerender.mjs';

export default defineConfig({
  site: 'https://www.zhuangwendi.vercel.app',  // apex 는 www 로 308 리다이렉트됨
  integrations: [
    // 관리자 페이지는 검색엔진에 올릴 이유가 없다.
    sitemap({ filter: (page) => !page.includes('/admin') }),
    // 한글/영문 글자 감싸기를 빌드 때 끝낸다(브라우저에서 하면 글자가 한 번 튄다)
    multilingualPrerender(),
  ],
});
