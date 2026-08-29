import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 把 CMS 留空的可选字段（'' / null）规范化为 undefined。
const optString = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().optional(),
);

// 后台曾用 `works` 作为图片字段名，这里兼容旧写法，避免老条目的图片悄悄消失。
const imagesField = z.preprocess(
  (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Record<string, unknown>;
      if (raw.photos == null && Array.isArray(raw.works)) {
        return { ...raw, photos: raw.works };
      }
    }
    return v;
  },
  z.object({
    title: z.string(),
    year: optString,
    order: z.number().default(0), // 显示顺序
    photos: z.array(z.string()).default([]), // 有序图片路径
    hidden: z.boolean().default(false),
  }),
);

// 作品（首页拼图和 Works 页共用）
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: imagesField,
});

export const collections = { works };
