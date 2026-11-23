/**
 * 생성 수식 상자 크기 어림 — 한글 수식 스크립트를 묶음{}·over·위/아래 첨자·sqrt/root·행(#) 구조로 재어 em 단위 폭·위·아래를 낸다.
 * 한글은 문서를 열 때 수식을 다시 조판하지만, 저장된 상자 크기(hp:sz)를 그대로 쓰는 미리보기(kordoc 렌더)·다른 뷰어는 이 값으로 줄을 배치한다.
 * 종전 어림(글자 수 × 700 + 2000, 최소 5,500)은 "a" 한 글자를 19mm 로 잡아 미리보기에 큰 빈칸을 냈다.
 *
 * 상수 근거 — 코퍼스 한글 저장 수식 22,130개(HYhwpEQ, sz 폭·높이 ÷ baseUnit):
 * 한 글자 0.5~0.58em, 단순 식 높이 1.0em·기준선 86%, 위첨자 식 1.167em·88%, 분수 2.3em·66%.
 * 폭 상대오차 중앙값 2.235 → 0.078(p90 8.17 → 0.32), 높이·기준선 오차 중앙값 0
 */

/** 기울임 소문자·대문자 em 폭 — 한글 수식 편집기 재계산 실측(HYhwpEQ, 글자 하나 수식, 9·10·11·12·15pt 반올림 결과를 모두 만족하는 값) */
const LOWER: Record<string, number> = {
  a: .528, b: .442, c: .442, d: .5, e: .467, f: .539, g: .5, h: .584, i: .359, j: .416, k: .5, l: .307, m: .884,
  n: .6, o: .5, p: .5, q: .442, r: .442, s: .472, t: .359, u: .558, v: .5, w: .714, x: .558, y: .5, z: .467,
}
/** 대문자 — 표에 없는 글자 0.762 */
const UPPER: Record<string, number> = {
  B: .714, C: .722, E: .693, F: .641, G: .786, I: .359, J: .5, K: .778, L: .641, M: .916, O: .778, P: .693, Q: .778,
  R: .738, S: .558, T: .722, W: 1.028, Z: .616,
}
const GREEK: Record<string, number> = {
  alpha: .641, beta: .558, gamma: .5, delta: .442, epsilon: .4, varepsilon: .438, theta: .472, vartheta: .562, lambda: .584,
  mu: .6, pi: .558, sigma: .558, phi: .6, varphi: .625, omega: .641, DELTA: .834, SIGMA: .778, OMEGA: .762,
}
const GREEK_NAMES = new Set("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega varphi vartheta varepsilon".split(" "))
/** 로만체 함수 이름 폭(실측) — 표에 없는 이름은 글자당 0.5 + 0.375 */
const FUNCS: Record<string, number> = { sin: 1.375, cos: 1.558, tan: 1.461, log: 1.438, ln: .875, lim: 1.812, max: 1.875, min: 1.714, exp: 1.714 }
const FUNC_NAMES = new Set([...Object.keys(FUNCS), "cot", "sec", "csc", "det", "arg", "gcd", "mod", "sinh", "cosh", "tanh"])
/** 위·아래 끝을 기호 위·아래로 쌓는 큰 연산자(∑·lim)와 옆에 붙이는 적분 */
const UNDER_OVER = new Set(["sum", "prod", "SMALLSUM", "inter", "union", "lim", "Lim", "coprod"])
const BIG_OPS = new Set(["sum", "int", "prod", "SMALLSUM", "dint", "tint", "oint", "inter", "union", "coprod"])
const ACCENTS = /^(?:bar|vec|hat|dot|ddot|tilde|acute|grave|check|dyad|under|arch)$/
const STACKS = /^(?:matrix|pmatrix|bmatrix|dmatrix|cases|eqalign|pile|lpile|rpile)$/
/** 폭 없는 서식·괄호 크기 지시 */
const ZERO_WIDTH = new Set(["rm", "it", "bold"])
/** 기호 폭(양옆 간격 포함, 실측 "a X a" − 2a) */
const SYMBOLS: Record<string, number> = {
  GEQ: 1.42, LEQ: 1.42, geq: 1.42, leq: 1.42, ge: 1.42, le: 1.42, SUBSET: 1.42, CDOTS: 1.42, cdots: 1.42, VDOTS: 1.42, LDOTS: .812,
  APPROX: 1.28, "!=": 1.28, AST: 1.28, SIM: 1.28, CIRC: 1.28, "==": 1.28, "-+": 1.28,
  TIMES: 1.092, times: 1.092, "+-": 1.092, DIVIDE: 1.092, "÷": 1.092,
  cdot: 1, CDOT: 1, "->": 1, rarrow: 1, RARROW: 1, larrow: 1, LARROW: 1, LRARROW: 1, "<->": 1, INF: 1, IN: 1, CUP: 1, SMALLINTER: 1,
  FORALL: 1, EXIST: 1, NABLA: 1, ANGLE: 1, angle: 1, TRIANGLE: 1, triangle: 1, BOT: 1, bot: 1, PROPTO: 1,
  THEREFORE: 1, therefore: 1, BECAUSE: 1, because: 1, DEG: .5, PVER: .938, prime: .312, Partial: .5,
}

/** em 폭 — 글자는 표, 연산자·문장부호는 양옆 간격을 넣은 실측("a+a" − 2a) */
function charWidth(c: string): number {
  if (c in LOWER) return LOWER[c]
  if (/[A-Z]/.test(c)) return UPPER[c] ?? 0.762
  if (/[0-9]/.test(c)) return 0.5
  if (/[가-힣ℝℕℤℚℂ]/.test(c)) return 1
  if (/[+-]/.test(c)) return 1.03
  if (c === "=") return 1.17
  if (/[<>]/.test(c)) return 1.295
  if (/[()]/.test(c)) return 0.445
  if (/[[\]]/.test(c)) return 0.32
  if (c === "|") return 0.188
  if (c === ",") return 0.32
  if (c === ":") return 0.67
  if (c === "/") return 0.5
  if (c === "'") return 0.312
  if (c === "." || c === "!") return 0.25
  if (c === "`" || c === " ") return 0.125
  if (c === "~") return 0.5
  if (c === "*") return 0.47
  return 0.8
}

/** q: 글자 하나 폭을 한글 조판 격자로 반올림 (measureEquation 이 크기별로 넘긴다) */
function wordWidth(x: string, q: (em: number) => number = em => em): number {
  if (x[0] === '"') return [...x.slice(1, -1)].reduce((s, c) => s + q(charWidth(c)), 0)
  if (x in GREEK) return q(GREEK[x])
  if (GREEK_NAMES.has(x.toLowerCase())) return q(0.56)
  if (x in FUNCS) return q(FUNCS[x])
  if (FUNC_NAMES.has(x)) return q(x.length * 0.5 + 0.375)
  if (x === "int" || x === "oint") return q(1.31)
  if (BIG_OPS.has(x)) return q(1.25)
  if (x in SYMBOLS) return q(SYMBOLS[x])
  return [...x].reduce((s, c) => s + q(charWidth(c)), 0)
}

interface Box { w: number; a: number; d: number }
const ATOM = (w: number): Box => ({ w, a: 0.86, d: 0.14 })
const SCRIPT_SCALE = 0.62

/** 한글은 수식 글자 폭을 75 HWPUNIT(0.75pt) 격자로 반올림한다 — 같은 "a"(0.5em)가 12pt 600·10pt 525·9pt 450 (9·10·11·12·15pt 실측) */
const GLYPH_GRID = 75

/** 스크립트 → em 상자 (폭·기준선 위·아래). unit 은 수식 글자 크기(baseUnit, HWPUNIT) — 글자 폭 반올림에 쓴다 */
export function measureEquation(script: string, unit = 1200): Box {
  let cur = unit
  const q = (em: number): number => (Math.round((em * cur) / GLYPH_GRID) * GLYPH_GRID) / cur
  // 중괄호 폭탄 같은 기형 입력은 구조를 재지 않고 글자 폭 합으로 (재귀 깊이 상한)
  let depth = 0, deepest = 0
  for (const c of script) if (c === "{") deepest = Math.max(deepest, ++depth); else if (c === "}") depth--
  if (deepest > 64) return ATOM([...script.replace(/[{}\s]/g, "")].reduce((s, c) => s + charWidth(c), 0))
  const t = [...script.matchAll(/"[^"]*"|[A-Za-z]+|\d+(?:\.\d+)?|<->|->|<=|>=|!=|==|\+-|-\+|[{}^_#&`~]|[가-힣]+|\S/gu)].map(m => m[0])
  let i = 0
  const combine = (items: Array<Box | null>): Box => {
    if (items.includes(null)) {
      // 행(#)으로 쌓은 묶음 — 행마다 높이에 간격 0.2em
      const rows: Box[][] = [[]]
      for (const x of items) x ? rows[rows.length - 1].push(x) : rows.push([])
      const rs = rows.map(r => combine(r)), H = rs.reduce((s, r) => s + r.a + r.d + 0.2, 0)
      return { w: Math.max(...rs.map(r => r.w)), a: H / 2 + 0.25, d: H / 2 - 0.25 }
    }
    const bs = items as Box[]
    return bs.length ? { w: bs.reduce((s, x) => s + x.w, 0), a: Math.max(...bs.map(x => x.a)), d: Math.max(...bs.map(x => x.d)) } : ATOM(0)
  }
  const seq = (stop?: string): Box => {
    const items: Array<Box | null> = []
    while (i < t.length && t[i] !== stop) {
      if (t[i] === "over") {
        i++
        // 분자는 바로 앞 항목 하나(한글 편집기·읽기 경로 elemStart 와 같은 결합) — 앞 전체를 묶으면 "a= {1} over {2} + {3} over {4}" 의 분수가 겹겹이 쌓여 높이가 3배가 됐다
        const prev = items.length && items[items.length - 1] ? items.pop()! : ATOM(0.5)
        const num = prev, den = elem() ?? ATOM(0.5)
        // 분자 위·분모 아래 — 수식 축(분수선)이 기준선 위 0.22em
        items.push({ w: Math.max(num.w, den.w) + 0.5, a: num.a + num.d + 0.52, d: den.a + den.d - 0.22 })
      } else if (t[i] === "#") { i++; items.push(null) }
      else if (t[i] === "&") { i++; items.push(ATOM(0.6)) }
      else { const e = elem(); if (e) items.push(e) }
    }
    return combine(items)
  }
  const base = (): Box | null => {
    const x = t[i]
    if (x === undefined) return null
    i++
    if (x === "{") { const g = seq("}"); if (t[i] === "}") i++; return g }
    if (x === "}") return null
    if (ZERO_WIDTH.has(x)) return ATOM(0)
    // 늘이는 괄호 — 다음 토큰이 괄호 글자("{" 도 묶음이 아니라 글자). 실측 ( ) 0.375em, { } | 0.5em, "." 은 안 보이는 쪽
    if (x === "LEFT" || x === "RIGHT" || x === "left" || x === "right") {
      const d = t[i++] ?? "."
      return ATOM(d === "." ? 0 : d === "(" || d === ")" ? 0.375 : 0.5)
    }
    if (x === "lim" || x === "Lim") return { w: 1.812, a: 0.95, d: 0.237 }
    if (x === "sqrt") { const arg = base() ?? ATOM(0.5); return { w: arg.w + 1.17, a: arg.a + 0.15, d: arg.d } }
    if (x === "root") {
      const n = base()
      if (t[i] !== "of") return { w: (n?.w ?? 0.5) + 1.17, a: (n?.a ?? 0.86) + 0.15, d: n?.d ?? 0.14 }
      i++
      const arg = base() ?? ATOM(0.5)
      return { w: arg.w + 1.17, a: arg.a + 0.15, d: arg.d }
    }
    if (ACCENTS.test(x)) { const arg = base() ?? ATOM(0.5); return { w: arg.w + 0.1, a: arg.a + 0.2, d: arg.d } }
    if (STACKS.test(x)) {
      const arg = base() ?? ATOM(1)
      return { w: arg.w + (x === "cases" ? 0.6 : /^[pbd]matrix$/.test(x) ? 0.8 : 0), a: arg.a, d: arg.d }
    }
    // 큰 연산자 실측: ∫ 1.31em·높이 1.887·기준선 66%, ∑ 1.25em·1.359·76%
    if (x === "int" || x === "oint" || x === "dint" || x === "tint") return { w: wordWidth(x, q), a: 1.245, d: 0.642 }
    if (BIG_OPS.has(x)) return { w: 1.25, a: 1.033, d: 0.326 }
    return ATOM(wordWidth(x, q))
  }
  // 원자 + 위·아래 첨자 사슬 (첨자는 0.62 배). 실측: 옆 첨자 위 a 1.045·아래 d 0.35(1.208em·71%),
  // ∑·lim 은 끝을 기호 위·아래로 쌓고(∑_{k=1}^{n} 2.734em·63%), ∫ 은 옆에 높게 붙인다(∫_0^1 2.574em·62%)
  const elem = (): Box | null => {
    const head = t[i]
    let b = base()
    if (!b) return null
    const stacked = UNDER_OVER.has(head), integral = /^(?:int|oint|dint|tint)$/.test(head)
    const baseW = b.w
    while (t[i] === "^" || t[i] === "_") {
      const sup = t[i] === "^"
      i++
      const outer = cur
      cur = outer * SCRIPT_SCALE
      const s = base() ?? { w: 0, a: 0, d: 0 }
      cur = outer
      const h = (s.a + s.d) * SCRIPT_SCALE, sw = s.w * SCRIPT_SCALE
      if (stacked) b = { w: Math.max(b.w, Math.max(baseW, sw) + 0.06), a: sup ? b.a + h + 0.07 : b.a, d: sup ? b.d : b.d + h + 0.07 }
      else if (integral) b = { w: Math.max(b.w, baseW + sw), a: sup ? b.a + h * 0.55 : b.a, d: sup ? b.d : b.d + h * 0.55 }
      // 위·아래 첨자를 함께 달면 폭은 넓은 쪽만
      else b = sup ? { w: Math.max(b.w, baseW + sw), a: Math.max(b.a, b.a * 0.45 + h), d: b.d } : { w: Math.max(b.w, baseW + sw), a: b.a, d: Math.max(b.d, h - 0.27) }
    }
    return b
  }
  return seq()
}

/**
 * 수식 상자 HWPUNIT (폭·높이·기준선 %). 한글은 수식 크기를 화면 격자에 맞춘다(9·10·11·12·15pt 실측):
 * 높이는 글자 크기를 0.75pt 로, 글자 폭은 1.5pt 로 반올림한 크기에서 잰다 — 10pt 와 11pt 수식의 글자 폭이 같다.
 */
export function equationBox(script: string, unit: number): { width: number; height: number; baseline: number } {
  const hUnit = Math.max(GLYPH_GRID, Math.round(unit / GLYPH_GRID) * GLYPH_GRID)
  const wUnit = Math.max(2 * GLYPH_GRID, Math.round(unit / (2 * GLYPH_GRID)) * 2 * GLYPH_GRID)
  const { w, a, d } = measureEquation(script, wUnit)
  return { width: w * wUnit, height: (a + d) * hUnit, baseline: (100 * a) / (a + d) }
}
