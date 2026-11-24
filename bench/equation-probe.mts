// 수식 탐침 — 한글 수식 스크립트 목록을 여러 글자 크기의 HWPX 로 만들고, 한글 재조판 결과와 kordoc 추정(equationBox)을 표로 비교
// 1) npx tsx bench/equation-probe.mts build probes.txt out/p 900,1000,1200,1500   → out/p-900.hwpx …
// 2) 크기마다: powershell -File bench/hangul-eq-refresh.ps1 -Src out/p-900.hwpx -Out out/p-900-ref.hwpx
// 3) npx tsx bench/equation-probe.mts report probes.txt out/p 900,1000,1200,1500 [w|h|bl] [--bad]
// probes.txt: 한 줄에 한글 수식 스크립트 하나(LaTeX 아님, 예: "a _{1} +b", "{1} over {2}"). 표 칸은 "한글값/추정"(2 HWPUNIT 넘게 다를 때만 추정 표시).
import { readFileSync, writeFileSync } from "node:fs"
import JSZip from "jszip"
import { markdownToHwpx } from "../src/index.ts"
import { equationBox } from "../src/hwpx/equation-metrics.ts"

const [cmd, probesPath, base, sizesArg, what = "w"] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
if (!cmd || !probesPath || !base || !sizesArg) {
  console.error("사용: npx tsx bench/equation-probe.mts build|report <probes.txt> <출력 접두> <크기,…> [w|h|bl] [--bad]"); process.exit(2)
}
const probes = readFileSync(probesPath, "utf8").split(/\r?\n/).filter((l) => l.trim())
const sizes = sizesArg.split(",").map(Number)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

if (cmd === "build") {
  // 빈 수식 문단을 만들고 스크립트·크기만 바꾼다 — 상자 크기는 한글이 재조판에서 정한다
  const buf = await markdownToHwpx("# probe\n\n" + probes.map(() => "$a$").join("\n\n") + "\n", { inlineMath: true })
  for (const bu of sizes) {
    const zip = await JSZip.loadAsync(buf)
    let k = 0
    const x = (await zip.file("Contents/section0.xml")!.async("string"))
      .replace(/baseUnit="\d+"/g, `baseUnit="${bu}"`)
      .replace(/<hp:script>[\s\S]*?<\/hp:script>/g, () => `<hp:script>${esc(probes[k++])}</hp:script>`)
    if (k !== probes.length) throw new Error(`수식 수 ${k} vs 탐침 ${probes.length}`)
    zip.file("Contents/section0.xml", x)
    writeFileSync(`${base}-${bu}.hwpx`, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))
    console.log(`${base}-${bu}.hwpx`)
  }
} else if (cmd === "report") {
  const read = async (p: string) => {
    const x = await (await JSZip.loadAsync(readFileSync(p))).file("Contents/section0.xml")!.async("string")
    return [...x.matchAll(/<hp:equation\b[\s\S]*?<\/hp:equation>/g)].map(([e]) => ({
      w: +/<hp:sz\b[^>]*\bwidth="(\d+)"/.exec(e)![1], h: +/<hp:sz\b[^>]*\bheight="(\d+)"/.exec(e)![1], bl: +/\bbaseLine="(\d+)"/.exec(e)![1],
    }))
  }
  const ref = await Promise.all(sizes.map((b) => read(`${base}-${b}-ref.hwpx`)))
  const key = what as "w" | "h" | "bl"
  let off = 0
  console.log(`[${key}] 한글/추정`.padEnd(26) + sizes.map((s) => String(s).padEnd(11)).join(""))
  probes.forEach((s, i) => {
    const cells = sizes.map((b, j) => {
      const t = ref[j][i][key], box = equationBox(s, b)
      const m = Math.round(key === "w" ? box.width : key === "h" ? box.height : box.baseline)
      const bad = Math.abs(m - t) > (key === "bl" ? 1 : 2)
      if (bad) off++
      return (bad ? `${t}/${m}` : `${t}`).padEnd(11)
    })
    if (!process.argv.includes("--bad") || cells.some((c) => c.includes("/"))) console.log(s.padEnd(26) + cells.join(""))
  })
  console.log(`어긋난 칸 ${off} / ${probes.length * sizes.length}`)
} else {
  console.error(`모르는 명령: ${cmd}`); process.exit(2)
}
