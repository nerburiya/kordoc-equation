// kordoc 수식 상자 추정(equationBox) ↔ 한글이 다시 조판한 상자(bench/hangul-eq-refresh.ps1 산출물) 비교
// 사용: npx tsx bench/equation-box-cmp.mts <kordoc.hwpx> <한글재조판.hwpx> [나쁜 순 N=12]
// 추정은 kordoc.hwpx 의 스크립트로(한글은 저장할 때 스크립트를 고쳐 쓴다), 크기는 한글이 정한 baseUnit 으로 잰다.
// 상대 오차 = |추정 - 한글| / 한글. 기준선은 높이 % 의 차.
import JSZip from "jszip"
import { readFileSync } from "node:fs"
import { equationBox } from "../src/hwpx/equation-metrics.ts"

const [est, truth, worstArg] = process.argv.slice(2)
if (!est || !truth) { console.error("사용: npx tsx bench/equation-box-cmp.mts <kordoc.hwpx> <한글재조판.hwpx> [N]"); process.exit(2) }

const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
const attr = (e: string, name: string) => +new RegExp(`\\b${name}="(\\d+)"`).exec(e)![1]
async function eqs(path: string) {
  const zip = await JSZip.loadAsync(readFileSync(path))
  const names = Object.keys(zip.files).filter((n) => /^Contents\/section\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0])
  const out: { w: number; h: number; bl: number; bu: number; s: string }[] = []
  for (const n of names) {
    const x = await zip.file(n)!.async("string")
    for (const [e] of x.matchAll(/<hp:equation\b[\s\S]*?<\/hp:equation>/g)) {
      const sz = /<hp:sz\b[^>]*>/.exec(e)![0]
      out.push({ w: attr(sz, "width"), h: attr(sz, "height"), bl: attr(e, "baseLine"), bu: attr(e, "baseUnit"),
        s: unxml(/<hp:script[^>]*>([\s\S]*?)<\/hp:script>/.exec(e)![1]) })
    }
  }
  return out
}

const a = await eqs(est), b = await eqs(truth)
if (a.length !== b.length) { console.error(`수식 수가 다름: ${a.length} vs ${b.length}`); process.exit(1) }
const rows = a.map((x, i) => {
  const t = b[i], box = equationBox(x.s, t.bu)
  return { s: x.s, bu: t.bu, w: box.width, h: box.height, bl: box.baseline, t,
    ew: Math.abs(box.width - t.w) / t.w, eh: Math.abs(box.height - t.h) / t.h, ebl: Math.abs(box.baseline - t.bl) }
})
const q = (v: number[], p: number) => [...v].sort((x, y) => x - y)[Math.floor(p * (v.length - 1))]
const pct = (v: number) => (v * 100).toFixed(1) + "%"
console.log(`수식 ${rows.length}개 · 크기(baseUnit) ${[...new Set(rows.map((r) => r.bu))].join("·")}`)
for (const [k, label, f] of [["ew", "폭 오차", pct], ["eh", "높이 오차", pct], ["ebl", "기준선 차(%p)", (v: number) => v.toFixed(0)]] as const) {
  const v = rows.map((r) => r[k])
  console.log(`${label}: 중앙값 ${f(q(v, 0.5))} · 상위10% ${f(q(v, 0.9))} · 최대 ${f(Math.max(...v))}`)
}
console.log(`폭 합: 추정 ${Math.round(rows.reduce((s, r) => s + r.w, 0))} · 한글 ${rows.reduce((s, r) => s + r.t.w, 0)}`)
console.log(`나쁜 순 (폭+높이 오차):`)
for (const r of [...rows].sort((x, y) => y.ew + y.eh - (x.ew + x.eh)).slice(0, +(worstArg ?? 12)))
  console.log(`  ${r.bu} w ${Math.round(r.w)}→${r.t.w}  h ${Math.round(r.h)}→${r.t.h}  bl ${Math.round(r.bl)}→${r.t.bl} | ${r.s.slice(0, 80)}`)
