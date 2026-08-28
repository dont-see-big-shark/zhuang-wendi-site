import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// CMS가 비운 옵션 필드('' / null)를 undefined로 정규화.
const optString = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().optional(),
);

// 사진 작업 (홈 모자이크 + works PHOTOS 섹션 공용)
const photos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/photos' }),
  schema: z.object({
    title: z.string(),
    year: optString,
    order: z.number().default(0), // 표출 순서
    description: optString, // 작가노트 (Phase 3에서 채움)
    photos: z.array(z.string()).default([]), // 순서 있는 이미지 경로
    hidden: z.boolean().default(false),
  }),
});

// 출판 (works BOOKS 섹션)
const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    year: optString,
    order: z.number().default(0),
    buyLink: optString, // 구매 링크 (선택)
    description: optString,
    photos: z.array(z.string()).default([]),
    hidden: z.boolean().default(false),
  }),
});

export const collections = { photos, books };
