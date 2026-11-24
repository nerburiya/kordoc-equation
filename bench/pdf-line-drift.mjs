// 한글 PDF ↔ kordoc PDF 쪽별 줄 대조 — 줄 수, 줄 나눔(같은 글로 끝나는가), 줄 높이 어긋남
// 사용: node bench/pdf-line-drift.mjs <한글.pdf> <kordoc.pdf> [--lines]
//   한글 PDF: powershell -File bench/hangul-com-pdf.ps1 -Src 문서.hwpx -Out 문서.hancom.pdf
//   kordoc PDF: npx tsx src/cli.ts render 문서.hwpx --format pdf -o 문서.kordoc.pdf
// 줄은 한글 글자가 든 조각만으로 묶는다(y 2pt 안) — 수식 첨자 조각이 따로 줄로 잡히지 않게. 쪽 안에서 줄을 순서대로 짝짓는다.
// y 는 쪽 위에서부터 pt. --lines 는 어긋난 줄을 하나씩 찍는다.
import { readFile } from "node:fs/promises";
import { openPdf } from "./lib/pdf-engine.mjs";

const [aPath, bPath] = process.argv.slice(2).filter((s) => !s.startsWith("--"));
const showLines = process.argv.includes("--lines");
if (!aPath || !bPath) { console.error("사용: node bench/pdf-line-drift.mjs <한글.pdf> <kordoc.pdf> [--lines]"); process.exit(2); }

const HANGUL = /[가-힣]/;
async function pages(path) {
  const doc = await openPdf(await readFile(path));
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = doc.page(p), top = pg.view[3];
    const items = pg.items.filter((i) => HANGUL.test(i.str)).map((i) => ({ y: top - i.transform[5], x: i.transform[4], s: i.str }));
    const lines = [];
    for (const it of items.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x))) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) <= 2) last.t += it.s;
      else lines.push({ y: it.y, t: it.s });
    }
    // 줄 끝 대조는 한글 글자만 — 한글 PDF 는 문장부호를 따로 조각에 담아 위에서 걸러진다
    out.push(lines.map((l) => ({ y: l.y, t: l.t.replace(/[^가-힣]/g, "") })));
  }
  doc.close();
  return out;
}

const [A, B] = [await pages(aPath), await pages(bPath)];
const med = (v) => (v.length ? [...v].sort((x, y) => x - y)[Math.floor((v.length - 1) / 2)] : 0);
let sameCount = 0, sameBreaks = 0, allDy = [];
console.log(`쪽 수: 한글 ${A.length} · kordoc ${B.length}`);
console.log("쪽 | 줄 수 한글/kordoc | 줄 끝 다른 줄 | y 차 중앙값/최대(pt)");
for (let p = 0; p < Math.max(A.length, B.length); p++) {
  const a = A[p] ?? [], b = B[p] ?? [], n = Math.min(a.length, b.length);
  const dy = [], diff = [];
  for (let i = 0; i < n; i++) {
    dy.push(Math.abs(b[i].y - a[i].y));
    if (a[i].t.slice(-3) !== b[i].t.slice(-3)) diff.push(i);
  }
  allDy.push(...dy);
  if (a.length === b.length) sameCount++;
  if (a.length === b.length && !diff.length) sameBreaks++;
  console.log(`${String(p + 1).padStart(2)} | ${a.length}/${b.length} | ${diff.length} | ${med(dy).toFixed(1)}/${(dy.length ? Math.max(...dy) : 0).toFixed(1)}`);
  if (showLines) {
    for (let i = 0; i < n; i++) if (diff.includes(i) || Math.abs(b[i].y - a[i].y) > 2)
      console.log(`     ${i + 1}줄 y ${a[i].y.toFixed(1)}→${b[i].y.toFixed(1)} | ${a[i].t.slice(-15)} ⟂ ${b[i].t.slice(-15)}`);
  }
}
const pc = Math.max(A.length, B.length);
console.log(`줄 수 같은 쪽 ${sameCount}/${pc} · 줄 나눔까지 같은 쪽 ${sameBreaks}/${pc} · y 차 중앙값 ${med(allDy).toFixed(2)}pt 최대 ${Math.max(0, ...allDy).toFixed(1)}pt`);
