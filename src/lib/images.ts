import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

// src/assets 里的原图，构建时会被转换并缩放为 webp。
const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{webp,jpg,jpeg,png,avif,gif}',
  { eager: true },
);

export interface Photo {
  /** 网格用小图 */
  thumb: string;
  /** 轮播等中等尺寸 */
  mid: string;
  /** 放大查看用的大图 */
  full: string;
  /** 让浏览器按显示尺寸自行选择 */
  srcset: string;
  /** 原始比例，用于在图片加载前占位 */
  w: number;
  h: number;
}

const WIDTHS = { small: 240, thumb: 400, mid: 800, full: 1600 } as const;

/**
 * 把后台保存的图片路径列表转换成页面可用的 URL 组合。
 *
 * 每张图会生成多个尺寸，按显示尺寸取用。
 * 如果直接把 1600px 原图塞进网格，访问者要下载比可见面积大十倍的文件。
 *
 * 这里还兜底处理后台容易犯的两个错误：
 *  - 外部 URL：无法优化，但原样展示（避免照片悄悄消失）。
 *  - 找不到文件：在构建日志里留下警告。
 */
export async function resolvePhotos(paths: string[] = []): Promise<Photo[]> {
  const out: Photo[] = [];

  for (const path of paths) {
    if (!path) continue;

    if (/^https?:\/\//i.test(path)) {
      console.warn(`[图片提示] 外部 URL 无法优化，将原样使用: ${path}`);
      out.push({ thumb: path, mid: path, full: path, srcset: '', w: 0, h: 0 });
      continue;
    }

    const mod = assets[path];
    if (!mod) {
      console.warn(
        `[图片缺失] ${path} —— 文件不存在或格式不支持。 ` +
          `请在后台上传目录中重新上传该图片。（支持: webp, jpg, png, avif, gif）`,
      );
      continue;
    }

    const src = mod.default;
    // 不放大超过原始尺寸
    const cap = (w: number) => Math.min(w, src.width || w);
    const [small, thumb, mid, full] = await Promise.all([
      getImage({ src, width: cap(WIDTHS.small), format: 'webp' }),
      getImage({ src, width: cap(WIDTHS.thumb), format: 'webp' }),
      getImage({ src, width: cap(WIDTHS.mid), format: 'webp' }),
      getImage({ src, width: cap(WIDTHS.full), format: 'webp' }),
    ]);

    out.push({
      thumb: small.src,
      mid: mid.src,
      full: full.src,
      // 网格可选的候选尺寸。手机窄列会命中 240w，大幅降低下载与
      // 解码内存（照片数量多，内存直接决定稳定性）。
      srcset: [
        `${small.src} ${cap(WIDTHS.small)}w`,
        `${thumb.src} ${cap(WIDTHS.thumb)}w`,
        `${mid.src} ${cap(WIDTHS.mid)}w`,
      ].join(', '),
      w: src.width,
      h: src.height,
    });
  }

  return out;
}
