// 在构建出的 HTML 里，预先把 .multilingual 区域的文字分段包裹。
//
// 这本来是浏览器里 jquery.multilingual 做的事。但它会给韩文/英文/数字
// 分别套用不同的字号和字重（如 16px/600 → 20px/800），如果等页面绘制完成
// 再执行，文字会跳一下。内容是静态的，把同样的结果提前到构建期完成，
// 跳动就消失了。
//
// 分段规则与插件保持一致（jquery.multilingual.min.js 的 regexs）。

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 包裹顺序 = 运行时调用顺序 ['ko', 'en', 'num', 'punct']
const GROUPS = [
  ['ml-ko', '[ㄱ-ㅎ가-힣ㅏ-ㅣ]+'],
  ['ml-en', '[A-Za-z]+'],
  ['ml-num', '[0-9]+'],
  ['ml-punct', '[（）().&,;:-<>@%*，、。」–《》『』]+'],
];
const TOKEN = new RegExp(GROUPS.map(([, re]) => '(' + re + ')').join('|'), 'gm');

// HTML 实体（&amp; 等）内部不能改动，先切出来，只处理其余部分。
const ENTITY = /(&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/;

function wrapText(text) {
  return text
    .split(ENTITY)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(TOKEN, (...args) => {
            const idx = args.slice(1, 1 + GROUPS.length).findIndex((g) => g !== undefined);
            return `<span class='${GROUPS[idx][0]}'>${args[idx + 1]}</span>`;
          })
    )
    .join('');
}

// 标签保持原样，只处理文本
function wrapRegion(html) {
  return html.replace(/<[^>]*>|[^<]+/g, (seg) => (seg[0] === '<' ? seg : wrapText(seg)));
}

// 从开标签位置找到配对闭标签的结束位置。
function findEnd(html, tag, from) {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi');
  re.lastIndex = from;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      if (--depth === 0) return m.index + m[0].length;
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return -1;
}

export function prerenderMultilingual(html) {
  const open = /<([a-z][\w-]*)\b[^>]*\bclass\s*=\s*"[^"]*\bmultilingual\b[^"]*"[^>]*>/gi;
  let out = '';
  let cursor = 0;
  let count = 0;
  let m;
  while ((m = open.exec(html))) {
    if (m.index < cursor) continue; // 已处理区域内部（嵌套）直接跳过
    const end = findEnd(html, m[1], m.index);
    if (end === -1) continue;
    const region = html.slice(m.index, end);
    out += html.slice(cursor, m.index);
    // 含脚本的区域不做处理，交给运行时
    out += /<script\b/i.test(region) ? region : wrapRegion(region);
    cursor = end;
    count++;
  }
  return { html: out + html.slice(cursor), count };
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

/** @type {() => import('astro').AstroIntegration} */
export default function multilingualPrerender() {
  return {
    name: 'multilingual-prerender',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let files = 0;
        let regions = 0;
        for await (const file of htmlFiles(fileURLToPath(dir))) {
          const src = await readFile(file, 'utf8');
          const { html, count } = prerenderMultilingual(src);
          if (!count) continue;
          await writeFile(file, html);
          files++;
          regions += count;
        }
        logger.info(`文字包裹完成: ${files} 个文件，${regions} 个区域`);
      },
    },
  };
}
