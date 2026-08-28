import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 把 CMS 留空的可选字段（'' / null）规范化为 undefined。
const optString = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().optional(),
);

// 摄影作品（首页拼图和 Works 的 PHOTOS 区共用）
const photos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/photos' }),
  schema: z.object({
    title: z.string(),
    year: optString,
    order: z.number().default(0), // 显示顺序
    description: optString, // 创作说明（可选）
    photos: z.array(z.string()).default([]), // 有序图片路径
    hidden: z.boolean().default(false),
  }),
});

// 出版（Works 的 BOOKS 区）
const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    year: optString,
    order: z.number().default(0),
    buyLink: optString, // 购买链接（可选）
    description: optString,
    photos: z.array(z.string()).default([]),
    hidden: z.boolean().default(false),
  }),
});

export const collections = { photos, books };
