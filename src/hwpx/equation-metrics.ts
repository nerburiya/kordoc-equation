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
/**
 * 기호 글자 폭. 관계·이항 기호(SYMBOL_CLASS)는 글자만 — 양옆 간격은 combine 이 붙인다(9·10·12·15pt 실측: LEQ·CDOTS 1, TIMES 0.8).
 * 나머지는 양옆 간격을 넣은 실측("a X a" − 2a)
 */
const SYMBOLS: Record<string, number> = {
  GEQ: 1, LEQ: 1, geq: 1, leq: 1, ge: 1, le: 1, SUBSET: 1, CDOTS: 1, cdots: 1, VDOTS: 1.42, LDOTS: .812,
  APPROX: .86, "!=": .86, AST: 1, SIM: .86, CIRC: 1, "==": .86, "-+": 1,
  TIMES: .8, times: .8, "+-": .8, DIVIDE: .8, "÷": .8,
  cdot: 1, CDOT: 1, "->": 1, rarrow: 1, RARROW: 1, larrow: 1, LARROW: 1, LRARROW: 1, "<->": 1, INF: 1, inf: 1, IN: 1, CUP: 1, SMALLINTER: 1,
  FORALL: 1, EXIST: 1, NABLA: 1, ANGLE: 1, angle: 1, TRIANGLE: 1, triangle: 1, BOT: 1, bot: 1, PROPTO: 1,
  THEREFORE: 1, therefore: 1, BECAUSE: 1, because: 1, DEG: .5, PVER: .938, prime: .312, Partial: .5,
}

/** 항목 종류 — 이웃 사이 간격을 정한다(TeX 식 짝 표). inner 는 분수·LEFT…RIGHT 묶음 */
type SpaceClass = "ord" | "bin" | "rel" | "open" | "close" | "punct" | "inner"
const SYMBOL_CLASS: Record<string, SpaceClass> = {
  GEQ: "rel", LEQ: "rel", geq: "rel", leq: "rel", ge: "rel", le: "rel", SUBSET: "rel", CDOTS: "rel", cdots: "rel",
  APPROX: "rel", "!=": "rel", SIM: "rel", "==": "rel",
  AST: "bin", CIRC: "bin", "-+": "bin", TIMES: "bin", times: "bin", "+-": "bin", DIVIDE: "bin", "÷": "bin",
}
function spaceClass(c: string): SpaceClass {
  if (c === "+" || c === "-") return "bin"
  if (c === "=" || c === "<" || c === ">" || c === ":") return "rel"
  if (c === "(" || c === "[") return "open"
  if (c === ")" || c === "]") return "close"
  if (c === ",") return "punct"
  return "ord"
}
/**
 * 이웃 항목 사이 간격(em, 실제 글자 크기 기준 — 격자 반올림 없음). 한글 재계산 실측(9·10·12·15pt):
 * 이항(+ − ×) 0.14·관계(= < ≤ ⋯ :) 0.21 씩 글자 쪽에, 쉼표 뒤 0.07, 글자 뒤 여는·닫는 괄호 0.07.
 * 분수·LEFT…RIGHT 묶음 뒤는 0, 이항·관계 기호끼리 0. 첨자 단 항목 뒤 간격은 10/7 배(a_1 + b 0.20, a_1 = b 0.30)
 */
function gap(l: SpaceClass, r: SpaceClass): number {
  if (l === "inner") return 0
  const atom = (c: SpaceClass) => c === "ord" || c === "close"
  const after = (c: SpaceClass) => c === "ord" || c === "open" || c === "inner"
  if (r === "bin") return atom(l) ? 0.14 : 0
  if (r === "rel") return atom(l) ? 0.21 : 0
  if (l === "bin") return after(r) ? 0.14 : 0
  if (l === "rel") return after(r) ? 0.21 : 0
  if (l === "punct") return 0.07
  if (r === "open" || r === "close") return l === "ord" || (r === "close" && l === "close") ? 0.07 : 0
  return 0
}

/** em 글자 폭(9·10·12·15pt 반올림 결과를 만족하는 값). 이항·관계·괄호·쉼표 간격은 gap 이 따로 붙인다 */
function charWidth(c: string): number {
  if (c in LOWER) return LOWER[c]
  if (/[A-Z]/.test(c)) return UPPER[c] ?? 0.762
  if (/[0-9]/.test(c)) return 0.5
  if (/[가-힣ℝℕℤℚℂ]/.test(c)) return 1
  if (/[+=-]/.test(c)) return 0.75
  if (/[<>]/.test(c)) return 0.85
  if (/[()]/.test(c)) return 0.375
  if (/[[\]]/.test(c)) return 0.25
  if (c === "|") return 0.188
  if (c === "," || c === ":") return 0.25
  if (c === "/") return 0.5
  if (c === "'") return 0.312
  if (c === "." || c === "!") return 0.25
  if (c === "`" || c === " ") return 0.125
  if (c === "~") return 0.5
  if (c === "*") return 0.5
  return 0.8
}
/** 빈칸 글자 — 글자 격자에 맞추지 않고 실제 크기 그대로 더한다 */
const SPACE_CHARS = new Set([" ", "`", "~"])

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

/** 글자 종류 — 그릴 때 글꼴·기울임을 고른다(var 기울임, text 본문 글꼴, 나머지 바로 선 수식 글꼴) */
export type GlyphClass = "var" | "num" | "op" | "fn" | "text" | "big" | "delim"
/**
 * 그릴 조각 — 원점은 수식 기준선 왼쪽, y 는 위가 +, 단위 em(크기 1 기준). 상자를 재는 구조 해석이 그대로 낸다.
 * t: 글자(tok 은 스크립트 토큰 — [x, x+w] 칸 가운데에, sy 는 늘인 괄호의 세로 배율), r: 가로줄(분수선·윗줄), p: 꺾은선(근호)
 */
export type EquationOp =
  | { k: "t"; x: number; y: number; w: number; size: number; tok: string; cls: GlyphClass; sy?: number }
  | { k: "r"; x: number; y: number; w: number; size: number }
  | { k: "p"; pts: Array<[number, number]>; size: number }
export interface EquationLayout { w: number; a: number; d: number; ops: EquationOp[] }
interface Box extends EquationLayout { delim?: "L" | "R"; cls?: SpaceClass; scripted?: boolean }

const ATOM = (w: number, ops: EquationOp[] = []): Box => ({ w, a: 0.86, d: 0.14, ops })
const SCRIPT_SCALE = 0.62

/**
 * 큰 연산자 글자 상자(HWPUNIT) — 한글 재계산 실측 8·9·10·11·12·13·14·15·16·18·20pt, 사이 크기는 선형 보간.
 * 크기마다 반올림이 따로 놀아(10pt ∫ 1260 인데 9pt 1179·11pt 1416) 한 비율로 안 맞는다 — 실측 표로 둔다.
 * a: 기준선 위 몫(실측 ∫ 66%·∑ 76%·lim 80%, 크기와 무관)
 */
const BIG_UNITS = [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1800, 2000]
const SUM_H = [1069, 1238, 1350, 1463, 1631, 1744, 1913, 2025, 2138, 2419, 2700]
const BIG_GLYPHS: Record<string, { w: number[]; h: number[]; a: number }> = {
  int: { w: [1098, 1179, 1260, 1416, 1572, 1653, 1809, 1965, 2046, 2358, 2595], h: [1484, 1698, 1911, 2050, 2264, 2477, 2616, 2830, 3043, 3396, 3748], a: 0.66 },
  sum: { w: [1050, 1200, 1275, 1425, 1500, 1725, 1875, 1950, 2025, 2400, 2625], h: SUM_H, a: 0.76 },
  prod: { w: [1125, 1275, 1350, 1500, 1575, 1800, 1950, 2025, 2175, 2475, 2700], h: SUM_H, a: 0.76 },
  lim: { w: [1200, 1500, 1725, 1875, 2175, 2175, 2250, 2550, 2850, 2925, 3375], h: [974, 1050, 1200, 1350, 1424, 1574, 1650, 1800, 1950, 2174, 2400], a: 0.8 },
}
/** 표 값 보간 — 범위 밖은 가까운 끝 값을 크기 비례로 */
function bigAt(v: number[], size: number): number {
  const n = BIG_UNITS.length
  if (size <= BIG_UNITS[0]) return (v[0] * size) / BIG_UNITS[0]
  if (size >= BIG_UNITS[n - 1]) return (v[n - 1] * size) / BIG_UNITS[n - 1]
  const k = BIG_UNITS.findIndex((u) => u >= size)
  const [u0, u1] = [BIG_UNITS[k - 1], BIG_UNITS[k]]
  return v[k - 1] + ((v[k] - v[k - 1]) * (size - u0)) / (u1 - u0)
}

/** 조각들을 (dx, dy) 로 옮기고 s 배 — 첨자는 0.62 배로 줄여 붙인다 */
function moveOps(ops: EquationOp[], dx: number, dy: number, s = 1): EquationOp[] {
  return ops.map((o): EquationOp => o.k === "p"
    ? { ...o, pts: o.pts.map(([x, y]): [number, number] => [x * s + dx, y * s + dy]), size: o.size * s }
    : { ...o, x: o.x * s + dx, y: o.y * s + dy, w: o.w * s, size: o.size * s })
}

/** 한글은 수식 글자 폭을 75 HWPUNIT(0.75pt) 격자로 반올림한다 — 같은 "a"(0.5em)가 12pt 600·10pt 525·9pt 450 (9·10·11·12·15pt 실측) */
const GLYPH_GRID = 75

/** 한 글자의 종류 — 라틴 글자 기울임, 숫자·소수점 바로, 더하기·관계 기호는 연산자, 나머지(괄호·문장부호·한글) 글 */
function charClass(c: string): GlyphClass {
  if (/[A-Za-z]/.test(c)) return "var"
  if (/[0-9.]/.test(c)) return "num"
  if (/[+\-=<>]/.test(c)) return "op"
  return "text"
}

/**
 * 스크립트 → em 상자 (폭·기준선 위·아래)와 그릴 조각. unit 은 수식 글자 크기(baseUnit, HWPUNIT) — 글자 폭 반올림에 쓴다.
 * 생성기는 상자 크기(hp:sz)를, 렌더러는 같은 해석의 조각을 쓴다 — 둘이 어긋나지 않게 한 곳에서 낸다.
 */
export function measureEquation(script: string, unit = 1200, real = unit, hUnit = unit): EquationLayout {
  // cur: 글자 폭을 반올림하는 크기(격자), rs: 실제 글자 크기 — 간격·빈칸·분수 여백·큰 연산자는 실제 크기로 잰다.
  // real·hUnit 은 equationBox 가 넘긴다(맨 바깥 실제 크기, 높이 격자 크기). 렌더러는 셋 다 unit
  let cur = unit, rs = real
  const sp = (): number => rs / cur
  const q = (em: number): number => (Math.round((em * cur) / GLYPH_GRID) * GLYPH_GRID) / cur
  // 중괄호 폭탄 같은 기형 입력은 구조를 재지 않고 글자 폭 합으로 (재귀 깊이 상한, 조각 없음 — 렌더러는 한 줄 글로)
  let depth = 0, deepest = 0
  for (const c of script) if (c === "{") deepest = Math.max(deepest, ++depth); else if (c === "}") depth--
  if (deepest > 64) return ATOM([...script.replace(/[{}\s]/g, "")].reduce((s, c) => s + charWidth(c), 0))
  const t = [...script.matchAll(/"[^"]*"|[A-Za-z]+|\d+(?:\.\d+)?|<->|->|<=|>=|!=|==|\+-|-\+|[{}^_#&`~]|[가-힣]+|\S/gu)].map(m => m[0])
  let i = 0
  /** 행 정렬 — cases·eqalign·lpile 은 왼쪽, rpile 오른쪽, 나머지 가운데 */
  let rowAlign: "left" | "center" | "right" = "center"

  /** 낱말 토큰 → 상자. 표에 있는 이름(그리스·함수·기호)은 한 조각, 나머지는 글자마다 */
  const word = (x: string): Box => {
    const one = (w: number, cls: GlyphClass): Box => ATOM(w, [{ k: "t", x: 0, y: 0, w, size: 1, tok: x, cls }])
    if (x in GREEK || GREEK_NAMES.has(x.toLowerCase())) return one(wordWidth(x, q), x === x.toLowerCase() ? "var" : "num")
    if (FUNC_NAMES.has(x)) return one(wordWidth(x, q), "fn")
    if (x in SYMBOLS) return { ...one(wordWidth(x, q), "op"), cls: SYMBOL_CLASS[x] ?? "ord" }
    const quoted = x[0] === '"'
    const ops: EquationOp[] = []
    let w = 0
    for (const c of quoted ? [...x.slice(1, -1)] : [...x]) {
      const space = SPACE_CHARS.has(c), cw = space ? charWidth(c) * sp() : q(charWidth(c))
      if (!space) ops.push({ k: "t", x: w, y: 0, w: cw, size: 1, tok: c, cls: quoted ? "text" : charClass(c) })
      w += cw
    }
    return { ...ATOM(w, ops), cls: !quoted && x.length === 1 ? spaceClass(x) : "ord" }
  }

  /** 늘이는 괄호 — 사이 항목 높이에 맞춘다(괄호 글자 높이 1em, 가운데 0.25em 기준) */
  const stretch = (b: Box, a: number, d: number): void => {
    b.a = a
    b.d = d
    const H = a + d
    for (const o of b.ops) if (o.k === "t" && H > 1.15) { o.sy = H / 1.05; o.y = (a - d) / 2 - 0.3 * o.sy }
  }

  const combine = (items: Array<Box | null>): Box => {
    if (items.includes(null)) {
      // 행(#)으로 쌓은 묶음 — 행마다 높이에 간격 0.2em
      const rows: Box[][] = [[]]
      for (const x of items) x ? rows[rows.length - 1].push(x) : rows.push([])
      const rs = rows.map(r => combine(r)), H = rs.reduce((s, r) => s + r.a + r.d + 0.2, 0)
      const w = Math.max(...rs.map(r => r.w)), a = H / 2 + 0.25
      const ops: EquationOp[] = []
      let top = a
      for (const r of rs) {
        const yb = top - r.a, dx = rowAlign === "left" ? 0 : rowAlign === "right" ? w - r.w : (w - r.w) / 2
        ops.push(...moveOps(r.ops, dx, yb))
        top = yb - r.d - 0.2
      }
      return { w, a, d: H / 2 - 0.25, ops }
    }
    const bs = items as Box[]
    if (!bs.length) return ATOM(0)
    // 이웃 간격 — 첨자 안도 첨자 실제 크기(2/3)로 띄운다(∑ 아래 k=1 실측)
    const gaps = bs.map((b, k) => k ? gap(bs[k - 1].cls ?? "ord", b.cls ?? "ord") * (bs[k - 1].scripted ? 10 / 7 : 1) * sp() : 0)
    // LEFT … RIGHT 짝마다 사이 높이로 괄호를 늘인다. 짝 없는 쪽은 줄 전체 높이로
    const open: number[] = []
    const span = (from: number, to: number): [number, number] => {
      let a = 0.86, d = 0.14
      for (let k = from; k < to; k++) if (!bs[k].delim) { a = Math.max(a, bs[k].a); d = Math.max(d, bs[k].d) }
      return [a, d]
    }
    bs.forEach((b, k) => {
      if (b.delim === "L") open.push(k)
      else if (b.delim === "R") {
        const j = open.pop() ?? -1
        const [a, d] = span(j + 1, k)
        stretch(b, a, d)
        if (j >= 0) stretch(bs[j], a, d)
      }
    })
    for (const j of open) { const [a, d] = span(j + 1, bs.length); stretch(bs[j], a, d) }
    const ops: EquationOp[] = []
    let x = 0
    bs.forEach((b, k) => { x += gaps[k]; ops.push(...moveOps(b.ops, x, 0)); x += b.w })
    return { w: x, a: Math.max(...bs.map(b => b.a)), d: Math.max(...bs.map(b => b.d)), ops }
  }

  const seq = (stop?: string): Box => {
    const items: Array<Box | null> = []
    while (i < t.length && t[i] !== stop && !(stop === "RIGHT" && t[i] === "right")) {
      if (t[i] === "over") {
        i++
        // 분자는 바로 앞 항목 하나(한글 편집기·읽기 경로 elemStart 와 같은 결합) — 앞 전체를 묶으면 "a= {1} over {2} + {3} over {4}" 의 분수가 겹겹이 쌓여 높이가 3배가 됐다
        const num = items.length && items[items.length - 1] ? items.pop()! : ATOM(0.5), den = elem() ?? ATOM(0.5)
        // 분자 밑 0.52em·분모 위 0.22em, 분수선은 그 사이 0.37em(수식 축)
        const w = Math.max(num.w, den.w) + 0.5 * sp()
        items.push({
          w, cls: "inner", a: num.a + num.d + 0.52, d: den.a + den.d - 0.22,
          ops: [...moveOps(num.ops, (w - num.w) / 2, num.d + 0.52), ...moveOps(den.ops, (w - den.w) / 2, 0.22 - den.a), { k: "r", x: 0.12, y: 0.37, w: w - 0.24, size: 1 }],
        })
      } else if (t[i] === "#") { i++; items.push(null) }
      else if (t[i] === "&") { i++; items.push(ATOM(0.6)) }
      else { const e = elem(); if (e) items.push(e) }
    }
    return combine(items)
  }

  /** 근호 — 왼쪽 0.85em 에 꺾은선, 본문 위로 윗줄 */
  const radical = (arg: Box, index: Box | null): Box => {
    const top = arg.a + 0.1, bot = -arg.d, mid = bot + (top - bot) * 0.45, w = arg.w + 1.17
    const ops: EquationOp[] = [
      { k: "p", pts: [[0.08, mid], [0.22, mid + 0.07], [0.45, bot], [0.78, top], [w - 0.12, top]], size: 1 },
      ...moveOps(arg.ops, 0.85, 0),
    ]
    if (index) ops.push(...moveOps(index.ops, 0.02, mid + 0.12, SCRIPT_SCALE))
    return { w, a: arg.a + 0.15, d: arg.d, ops }
  }

  const ACCENT_GLYPH: Record<string, string> = { vec: "→", dyad: "↔", hat: "^", check: "ˇ", tilde: "~", dot: "˙", ddot: "¨", acute: "´", grave: "`", arch: "⌒" }

  const base = (): Box | null => {
    const x = t[i]
    if (x === undefined) return null
    i++
    if (x === "{") { const g = seq("}"); if (t[i] === "}") i++; return g }
    if (x === "}") return null
    // ponytail: 글꼴 지시(rm·it·bold)는 폭만 0 — 그릴 때 글꼴을 바꾸지 않는다
    if (ZERO_WIDTH.has(x)) return ATOM(0)
    // 늘이는 괄호 — 다음 토큰이 괄호 글자("{" 도 묶음이 아니라 글자). 실측 ( ) 0.375em, { } | 0.5em, "." 은 안 보이는 쪽
    const delimAtom = (side: "L" | "R"): Box => {
      const d = t[i++] ?? "."
      const w = d === "." ? 0 : q(d === "(" || d === ")" ? 0.375 : 0.5)
      const b = ATOM(w, d === "." ? [] : [{ k: "t", x: 0, y: 0, w, size: 1, tok: d, cls: "delim" }])
      b.delim = side
      return b
    }
    // LEFT … RIGHT 는 한 덩어리 — 뒤 첨자·over 가 덩어리 전체에 붙는다(한글 수식 편집기). 종전엔 RIGHT 괄호 글자 하나에 붙어
    // "LEFT ( {5} over {6} RIGHT ) ^{n-5}" 의 위첨자를 늘기 전 괄호(0.86em) 높이에 달아 상자 위를 1.6pt 낮게 잡았다
    if (x === "LEFT" || x === "left") {
      const L = delimAtom("L"), inner = seq("RIGHT")
      if (t[i] !== "RIGHT" && t[i] !== "right") return { ...combine([L, inner]), cls: "inner" }
      i++
      return { ...combine([L, inner, delimAtom("R")]), cls: "inner" }
    }
    if (x === "RIGHT" || x === "right") return delimAtom("R")
    // 큰 연산자 글자 상자 — 실측 표(폭은 cur, 높이는 높이 격자 em 으로)
    const bigBox = (key: string): { w: number; a: number; d: number } => {
      const g = BIG_GLYPHS[key], h = bigAt(g.h, rs) / (hUnit * rs / real)
      return { w: bigAt(g.w, rs) / cur, a: h * g.a, d: h * (1 - g.a) }
    }
    if (x === "lim" || x === "Lim") { const g = bigBox("lim"); return { ...g, ops: [{ k: "t", x: 0, y: 0, w: g.w, size: 1, tok: "lim", cls: "fn" }] } }
    if (x === "sqrt") return radical(base() ?? ATOM(0.5), null)
    if (x === "root") {
      const n = base()
      if (t[i] !== "of") return radical(n ?? ATOM(0.5), null)
      i++
      return radical(base() ?? ATOM(0.5), n)
    }
    if (ACCENTS.test(x)) {
      const arg = base() ?? ATOM(0.5), w = arg.w + 0.1
      const ops = moveOps(arg.ops, 0.05, 0)
      if (x === "bar") ops.push({ k: "r", x: 0.05, y: arg.a + 0.1, w: arg.w, size: 1 })
      else if (x === "under") ops.push({ k: "r", x: 0.05, y: -arg.d - 0.08, w: arg.w, size: 1 })
      else ops.push({ k: "t", x: 0.05, y: arg.a - 0.55, w: arg.w, size: 0.8, tok: ACCENT_GLYPH[x] ?? "", cls: "op" })
      return { w, a: arg.a + 0.2, d: arg.d, ops }
    }
    if (STACKS.test(x)) {
      const outer = rowAlign
      rowAlign = /^(?:cases|eqalign|lpile)$/.test(x) ? "left" : x === "rpile" ? "right" : "center"
      const arg = base() ?? ATOM(1)
      rowAlign = outer
      const pair: Record<string, [string, string]> = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], dmatrix: ["|", "|"] }
      if (x === "cases") {
        const brace = ATOM(0.6, [{ k: "t", x: 0, y: 0, w: 0.5, size: 1, tok: "{", cls: "delim" }])
        stretch(brace, arg.a, arg.d)
        return { w: arg.w + 0.6, a: arg.a, d: arg.d, ops: [...brace.ops, ...moveOps(arg.ops, 0.6, 0)] }
      }
      if (pair[x]) {
        const [l, r] = pair[x], L = ATOM(0.4, [{ k: "t", x: 0, y: 0, w: 0.4, size: 1, tok: l, cls: "delim" }]), R = ATOM(0.4, [{ k: "t", x: 0, y: 0, w: 0.4, size: 1, tok: r, cls: "delim" }])
        stretch(L, arg.a, arg.d)
        stretch(R, arg.a, arg.d)
        return { w: arg.w + 0.8, a: arg.a, d: arg.d, ops: [...L.ops, ...moveOps(arg.ops, 0.4, 0), ...moveOps(R.ops, arg.w + 0.4, 0)] }
      }
      return arg
    }
    // 큰 연산자 실측: ∫ 1.31em·높이 1.887·기준선 66%, ∑ 1.25em·1.359·76%. 글자는 수식 축(0.25em)에 가운데로 키워 그린다
    if (x === "int" || x === "oint" || x === "dint" || x === "tint") {
      // 적분 기호는 상자 높이(1.887em)로 세로로 늘인다 — 키운 글자는 폭까지 커져 옆 첨자와 겹친다
      const b: Box = { ...bigBox("int"), ops: [] }
      b.ops.push({ k: "t", x: 0, y: 0, w: b.w, size: 1, tok: x, cls: "big" })
      stretch(b, b.a, b.d)
      return b
    }
    if (BIG_OPS.has(x)) { const g = bigBox(x === "prod" || x === "coprod" ? "prod" : "sum"); return { ...g, ops: [{ k: "t", x: 0, y: -0.22, w: g.w, size: 1.3, tok: x, cls: "big" }] } }
    return word(x)
  }

  // 원자 + 위·아래 첨자 (첨자는 0.62 배). 실측: 옆 첨자 위 a 1.045·아래 d 0.35(1.208em·71%),
  // ∑·lim 은 끝을 기호 위·아래로 쌓고(∑_{k=1}^{n} 2.734em·63%), ∫ 은 옆에 높게 붙인다(∫_0^1 2.574em·62%)
  const elem = (): Box | null => {
    const head = t[i]
    const b = base()
    if (!b) return null
    let sup: Box | null = null, sub: Box | null = null, sw = SCRIPT_SCALE
    while (t[i] === "^" || t[i] === "_") {
      const isSup = t[i] === "^"
      i++
      // 첨자 글자 폭은 실제 크기 × 0.68 을 1.5pt 격자로 반올림한 크기에서 잰다(8~20pt 11개 크기 실측: 8·9pt 600·10~12pt 750·13·14pt 900 …
      // — 첨자 AST 가 꼭 1em). 간격은 실제 크기 2/3 로
      const outer = cur, outerReal = rs
      cur = Math.max(2 * GLYPH_GRID, Math.round((outerReal * 0.68) / (2 * GLYPH_GRID)) * 2 * GLYPH_GRID)
      rs = (outerReal * 2) / 3
      const s = base() ?? { w: 0, a: 0, d: 0, ops: [] }
      sw = cur / outer
      cur = outer
      rs = outerReal
      if (isSup) sup = s; else sub = s
    }
    if (!sup && !sub) return b
    // 높이는 0.62 배(실측), 폭은 첨자 크기 비(sw)
    const S = SCRIPT_SCALE, hs = (s: Box | null) => (s ? (s.a + s.d) * S : 0), ws = (s: Box | null) => (s ? s.w * sw : 0)
    if (UNDER_OVER.has(head)) {
      const w = Math.max(b.w, ws(sup), ws(sub))
      const ops = moveOps(b.ops, (w - b.w) / 2, 0)
      if (sup) ops.push(...moveOps(sup.ops, (w - ws(sup)) / 2, b.a + 0.07 + sup.d * S, S))
      if (sub) ops.push(...moveOps(sub.ops, (w - ws(sub)) / 2, -(b.d + 0.07 + sub.a * S), S))
      return { w, a: sup ? b.a + hs(sup) + 0.07 : b.a, d: sub ? b.d + hs(sub) + 0.07 : b.d, ops }
    }
    const ops = [...b.ops]
    if (/^(?:int|oint|dint|tint)$/.test(head)) {
      const a = b.a + hs(sup) * 0.55, d = b.d + hs(sub) * 0.55
      if (sup) ops.push(...moveOps(sup.ops, b.w, a - sup.a * S, S))
      if (sub) ops.push(...moveOps(sub.ops, b.w - 0.15, -d + sub.d * S, S))
      // 아래 끝은 기호 밑으로 들어가 폭을 더하지 않는다(실측: int _{0} a 와 int a 폭이 같다)
      return { w: b.w + ws(sup), a, d, ops }
    }
    // 위·아래 첨자를 함께 달면 폭은 넓은 쪽만
    let a = b.a, d = b.d
    // 위첨자 기준선: 보통 글자는 0.45·바탕 높이 근처, 키 큰 바탕(괄호 친 분수)은 바탕 위 끝 − 0.4em
    // (한글 실측: LEFT ( {5} over {6} RIGHT ) ^{n-5} 위 1.644em — 종전 식은 바탕 1.52em 아래라 첨자 몫을 0 으로 잡았다)
    // 보통 글자 위 첨자는 9·10·11·12·15pt 실측(a^2 − a: 150·188·188·225·300)이 종전 식보다 0.04em 높다
    if (sup) { const top = Math.max(b.a * 0.45 + hs(sup) + 0.043, b.a - 0.4 + sup.a * S); a = Math.max(a, top); ops.push(...moveOps(sup.ops, b.w, top - sup.a * S, S)) }
    if (sub) { const bot = hs(sub) - 0.27; d = Math.max(d, bot); ops.push(...moveOps(sub.ops, b.w, -bot + sub.d * S, S)) }
    return { w: b.w + Math.max(ws(sup), ws(sub)), a, d, ops, cls: b.cls, scripted: true }
  }
  const r = seq()
  return { w: r.w, a: r.a, d: r.d, ops: r.ops }
}

/**
 * 수식 상자 HWPUNIT (폭·높이·기준선 %). 한글은 수식 크기를 화면 격자에 맞춘다(9·10·11·12·15pt 실측):
 * 높이는 글자 크기를 0.75pt 로, 글자 폭은 1.5pt 로 반올림한 크기에서 잰다 — 10pt 와 11pt 수식의 글자 폭이 같다.
 */
export function equationBox(script: string, unit: number): { width: number; height: number; baseline: number } {
  const hUnit = Math.max(GLYPH_GRID, Math.round(unit / GLYPH_GRID) * GLYPH_GRID)
  const wUnit = Math.max(2 * GLYPH_GRID, Math.round(unit / (2 * GLYPH_GRID)) * 2 * GLYPH_GRID)
  const { w, a, d } = measureEquation(script, wUnit, unit, hUnit)
  return { width: w * wUnit, height: (a + d) * hUnit, baseline: (100 * a) / (a + d) }
}
