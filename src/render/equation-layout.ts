/**
 * 수식 개체 → SVG 조각. 생성기가 상자 크기(hp:sz)를 재는 구조 해석(equation-metrics measureEquation)이 낸 조각을 그린다 —
 * 분수는 안쪽까지 분자·가로선·분모로 쌓고, 첨자는 올리고 내리며, ∑·lim 끝은 위아래로, LEFT/RIGHT 괄호는 사이 높이로 늘이고,
 * 근호는 꺾은선으로, 행렬·경우는 행을 쌓는다. 변수는 기울임, 숫자·기호·함수 이름은 바로 선 글자.
 * 종전엔 수식 전체를 한 줄 유니코드 글(a/b, a_n)로 상자 폭에 눌러 그려 PDF·미리보기에서 수식이 깨졌다.
 */

import { measureEquation, type EquationOp, type GlyphClass } from "../hwpx/equation-metrics.js"
import { hwpEquationToLatex } from "../hwp5/equation.js"
import { latexToPlain } from "./equation-text.js"

const MATH_FONT = "'Times New Roman','Cambria Math','STIX Two Math',serif"
const TEXT_FONT = "'HCR Batang','함초롬바탕','Noto Serif KR','Batang',serif"

/** LaTeX 경로가 유니코드로 못 바꾸는 이름 — 그대로 두면 "ast"·"bot" 같은 글자가 그려진다 */
const GLYPHS: Record<string, string> = {
  AST: "*", leq: "≤", le: "≤", geq: "≥", ge: "≥", cdots: "⋯", BOT: "⊥", bot: "⊥", PROPTO: "∝", DEG: "°",
  dint: "∬", tint: "∭", inter: "⋂", union: "⋃", coprod: "∐",
}
const glyphCache = new Map<string, string>(Object.entries(GLYPHS))
/** 스크립트 토큰 → 그릴 글자. 한 글자는 그대로(빼기는 − ), 이름 토큰(GEQ·alpha·sum…)은 LaTeX 를 거쳐 유니코드로 */
function glyphOf(tok: string, cls: GlyphClass): string {
  if (cls === "text" || cls === "var" || cls === "num") return tok
  if (tok === "-") return "−"
  if (tok.length === 1) return tok
  let g = glyphCache.get(tok)
  if (g === undefined) {
    g = latexToPlain(hwpEquationToLatex(tok)).trim() || tok
    glyphCache.set(tok, g)
  }
  return g
}

const f = (n: number): string => String(Math.round(n * 100) / 100)
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export interface EquationBoxGeom {
  /** 상자 왼쪽 위(HWPUNIT 계 좌표 — 호출 측 pt() 로 바꾸기 전 값) */
  x: number
  y: number
  width: number
  height: number
  /** 기준선 위치 — 높이 % (hp:equation baseLine) */
  baseLine: number
  /** 수식 글자 크기 HWPUNIT (hp:equation baseUnit) */
  baseUnit: number
  /** 글자색 — 검정이면 null */
  color: string | null
}

/**
 * 수식 상자에 그릴 SVG 조각. pt 는 호출 측 좌표 변환(HWPUNIT → 출력 단위). 그릴 조각이 없으면(기형 입력) null — 호출 측이 한 줄 글로.
 * 크기는 상자 폭·높이에 맞춘다(배율은 둘 가운데 작은 쪽, 글자 크기의 0.5~1.5 배) — 생성 상자는 같은 해석으로 쟀으니 배율이 1 에 가깝다.
 */
export function equationSvg(script: string, g: EquationBoxGeom, pt: (n: number) => string): { svg: string; texts: number } | null {
  if (!script.trim() || g.width <= 0 || g.height <= 0) return null
  const lay = measureEquation(script, g.baseUnit)
  if (!lay.ops.length || lay.w <= 0) return null
  const k = Math.min(g.width / (lay.w * g.baseUnit), g.height / ((lay.a + lay.d) * g.baseUnit))
  const em = g.baseUnit * Math.max(0.5, Math.min(1.5, k))
  const bl = Number.isFinite(g.baseLine) && g.baseLine > 0 ? g.baseLine / 100 : lay.a / (lay.a + lay.d)
  const by = g.y + g.height * bl
  const x0 = g.x + Math.max(0, (g.width - lay.w * em) / 2)
  const ink = g.color ?? "#000"
  const out: string[] = []
  let texts = 0
  const strokeW = (size: number) => pt(Math.max(em * 0.05 * size, 8))
  for (const o of lay.ops as EquationOp[]) {
    if (o.k === "r") {
      out.push(`<line x1="${pt(x0 + o.x * em)}" y1="${pt(by - o.y * em)}" x2="${pt(x0 + (o.x + o.w) * em)}" y2="${pt(by - o.y * em)}" stroke="${ink}" stroke-width="${strokeW(o.size)}"/>`)
    } else if (o.k === "p") {
      const pts = o.pts.map(([px, py]) => `${pt(x0 + px * em)},${pt(by - py * em)}`).join(" ")
      out.push(`<polyline points="${pts}" fill="none" stroke="${ink}" stroke-width="${strokeW(o.size)}" stroke-linejoin="round"/>`)
    } else {
      const text = glyphOf(o.tok, o.cls)
      if (!text) continue
      const cx = x0 + (o.x + o.w / 2) * em, cy = by - o.y * em, fs = em * o.size
      const font = o.cls === "text" ? TEXT_FONT : MATH_FONT
      const style = o.cls === "var" ? ` font-style="italic"` : ""
      const fill = g.color ? ` fill="${g.color}"` : ""
      if (o.sy && o.sy !== 1) {
        // 늘인 괄호 — 기준선에서 세로로만 늘린다
        out.push(`<text x="0" y="0" transform="translate(${pt(cx)} ${pt(cy)}) scale(1 ${f(o.sy)})" text-anchor="middle" font-size="${pt(fs)}" font-family="${font}"${fill}>${esc(text)}</text>`)
      } else {
        out.push(`<text x="${pt(cx)}" y="${pt(cy)}" text-anchor="middle" font-size="${pt(fs)}" font-family="${font}"${style}${fill}>${esc(text)}</text>`)
      }
      texts++
    }
  }
  return { svg: out.join(""), texts }
}
