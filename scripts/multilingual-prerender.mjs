// 빌드된 HTML 안에서 .multilingual 영역의 글자를 미리 감싼다.
//
// 원래는 브라우저가 jquery.multilingual 로 하던 일이다. 그런데 그 변환은
// 한글/영문/숫자마다 글자 크기·굵기를 바꾸기 때문에(예: 16px/600 → 20px/800),
// 화면이 이미 그려진 뒤에 실행되면 글자가 한 번 튄다. 콘텐츠가 정적이니
// 같은 결과를 빌드 때 만들어 두면 튐이 사라진다.
//
// 규칙은 플러그인과 동일하게 맞춘다(jquery.multilingual.min.js 의 regexs).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 감쌀 순서 = 런타임 호출 순서 ['ko', 'en', 'num', 'punct']
const GROUPS = [
  ['ml-ko', '[ㄱ-ㅎ가-힣ㅏ-ㅣ]+'],
  ['ml-en', '[A-Za-z]+'],
  ['ml-num', '[0-9]+'],
  ['ml-punct', '[（）().&,;:-<>@%*，、。」–《》『』]+'],
];
const TOKEN = new RegExp(GROUPS.map(([, re]) => '(' + re + ')').join('|'), 'gm');

// 엔티티(&amp; 등) 안쪽은 건드리면 안 되므로 잘라 두고 나머지에만 적용한다.
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

// 태그는 그대로 두고 텍스트에만 적용
function wrapRegion(html) {
  return html.replace(/<[^>]*>|[^<]+/g, (seg) => (seg[0] === '<' ? seg : wrapText(seg)));
}

// 여는 태그 위치에서 짝이 맞는 닫는 태그의 끝 위치를 찾는다.
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
    if (m.index < cursor) continue; // 이미 처리한 영역 안쪽(중첩)은 건너뛴다
    const end = findEnd(html, m[1], m.index);
    if (end === -1) continue;
    const region = html.slice(m.index, end);
    out += html.slice(cursor, m.index);
    // 스크립트가 섞인 영역은 손대지 않고 런타임에 맡긴다
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
        logger.info(`글자 감싸기 완료: ${files}개 파일, ${regions}개 영역`);
      },
    },
  };
}
