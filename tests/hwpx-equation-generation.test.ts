import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { markdownToHwpx, parseHwpx } from "../src/index.js"
import {
  COMMAND_MAP, ACCENT_COMMANDS,
  generateEquationXml, latexLikeToEqEdit, quoteReservedKeywords,
} from "../src/hwpx/equation-generate.js"
import { hmlToLatex } from "../src/hwpx/equation.js"
import { parseMarkdownToBlocks } from "../src/hwpx/md-runs.js"
import { flatSec } from "./gen-xml.js"

const compact = (value: string) => value.replace(/\s+/g, " ").trim()
const noSpace = (value: string) => value.replace(/\s+/g, "")

describe("latexLikeToEqEdit", () => {
  it("분수, 제곱근, n제곱근을 EqEdit script로 바꾼다", () => {
    assert.equal(latexLikeToEqEdit("\\frac{a}{b}"), "{a} over {b}")
    assert.equal(latexLikeToEqEdit("\\sqrt{x}"), "sqrt{x}")
    assert.equal(latexLikeToEqEdit("\\sqrt[n]{x}"), "root {n} of {x}")
  })

  it("그리스 문자, 적분, 극한, 화살표, 관계 연산자를 제한된 subset으로 바꾼다", () => {
    assert.equal(latexLikeToEqEdit("\\alpha + \\beta = \\gamma"), "alpha + beta = gamma")
    assert.equal(latexLikeToEqEdit("\\int_a^b f(x) dx"), "int _{a} ^{b} f(x) dx")
    assert.equal(latexLikeToEqEdit("\\lim_{x \\to 0} f(x)"), "lim _{x -> 0} f(x)")
    assert.equal(latexLikeToEqEdit("A \\rightarrow B"), "A -> B")
    assert.equal(latexLikeToEqEdit("x \\le y \\ne z \\ge w"), "x LEQ y != z GEQ w")
  })

  it("matrix 환경을 HWP 행렬 구분자로 바꾼다", () => {
    const out = latexLikeToEqEdit("\\begin{matrix} a & b \\\\ c & d \\end{matrix}")
    assert.equal(out, "{matrix{a & b # c & d}}")
  })

  it("\\perp·\\square 는 기호 토큰으로 — 따옴표 폴백 글자(\"perp\")가 아니다 (시험지 수식 생성 왕복)", () => {
    assert.equal(latexLikeToEqEdit("\\overline{CE} \\perp \\overline{AB}"), "bar{CE} BOT bar{AB}")
    assert.equal(latexLikeToEqEdit("\\square ABCD"), "□ ABCD")
    assert.equal(latexLikeToEqEdit("\\boxed{2}"), "BOX{2}")
  })

  it("pmatrix/bmatrix는 EqEdit 네이티브 토큰으로 낸다 (LEFT/RIGHT 합성 금지 — 리뷰 ·4)", () => {
    assert.equal(
      latexLikeToEqEdit("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"),
      "{pmatrix{a & b # c & d}}",
    )
    assert.equal(latexLikeToEqEdit("\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}"), "{bmatrix{1 # 2}}")
  })
})

describe("전 토큰 왕복 정합 (리뷰 ·3) — 쓰기 토큰은 읽기(hmlToLatex)로 같은 명령에 되돌아와야 한다", () => {
  it("COMMAND_MAP 전 항목이 고정점", () => {
    for (const [cmd, tok] of Object.entries(COMMAND_MAP)) {
      const latex = hmlToLatex(tok).trim()
      assert.match(latex, /^\\[A-Za-z]+$/, `\\${cmd} → "${tok}" → "${latex}" — 읽기 미인식`)
      assert.equal(
        COMMAND_MAP[latex.slice(1)], tok,
        `\\${cmd} → "${tok}" → "${latex}" — 재작성 시 다른 토큰`,
      )
    }
  })

  it("ACCENT_COMMANDS 전 항목이 고정점", () => {
    for (const [cmd, tok] of Object.entries(ACCENT_COMMANDS)) {
      const latex = hmlToLatex(`${tok} {x}`).trim()
      const m = /^\\([A-Za-z]+)/.exec(latex)
      assert.ok(m, `\\${cmd} → "${tok}{x}" → "${latex}" — 읽기 미인식`)
      assert.equal(
        ACCENT_COMMANDS[m![1]], tok,
        `\\${cmd} → "${tok}" → "\\${m![1]}" — 재작성 시 다른 토큰`,
      )
    }
  })

  it("\\pm·\\cdot·\\ast·\\leftarrow 왕복 (리뷰 ·3 실측 케이스)", () => {
    const script = latexLikeToEqEdit("a \\pm b \\cdot c \\ast d \\leftarrow e")
    assert.equal(script, "a +- b cdot c AST d larrow e")
    assert.equal(noSpace(hmlToLatex(script)), "a\\pmb\\cdotc\\astd\\leftarrowe")
  })
})

describe("괄호 구분자 왕복 (리뷰 ·4/·7)", () => {
  it("\\left( \\right)는 공백 분리 토큰으로 나가 왕복이 닫힌다", () => {
    const script = latexLikeToEqEdit("\\left( x \\right)")
    assert.equal(script, "LEFT ( x RIGHT )")
    assert.equal(noSpace(hmlToLatex(script)), "\\left(x\\right)")
  })

  it("\\left\\{ \\right\\}는 백슬래시 잔재 없이 균형 잡힌다", () => {
    const script = latexLikeToEqEdit("\\left\\{ x + y \\right\\}")
    assert.equal(script, "LEFT { x + y RIGHT }")
    assert.equal(noSpace(hmlToLatex(script)), "\\left\\{x+y\\right\\}")
  })

  it("pmatrix 왕복이 환경을 보존한다", () => {
    const script = latexLikeToEqEdit("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}")
    assert.equal(noSpace(hmlToLatex(script)), "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}")
  })
})

describe("첨자 예약어 보호 (리뷰 ·8)", () => {
  it("EqEdit 어휘와 충돌하는 리터럴 첨자만 따옴표로 보호한다", () => {
    assert.equal(quoteReservedKeywords("T_{int} + x_{rel}"), 'T_{"int"} + x_{rel}')
    assert.equal(latexLikeToEqEdit("T_{int}"), 'T _{"int"}')
    assert.equal(latexLikeToEqEdit("x_{rel}"), "x _{rel}")
  })

  it("변환 산출물(\\pi→pi)은 재따옴표하지 않는다", () => {
    assert.equal(latexLikeToEqEdit("x_{\\pi}"), "x _{pi}")
  })

  it("\\text/\\mathrm 리터럴은 따옴표로 나가고 \\text로 되돌아온다", () => {
    assert.equal(latexLikeToEqEdit("\\text{int}"), '"int"')
    assert.equal(noSpace(hmlToLatex('T _{"int"}')), "T_{\\text{int}}")
  })

  it("따옴표가 재파싱 LaTeX로 누수되지 않는다 (실측 재현)", async () => {
    const buf = await markdownToHwpx("$$T_{int}$$")
    const parsed = await parseHwpx(buf)
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.ok(!parsed.markdown.includes('"'), parsed.markdown)
      assert.ok(noSpace(parsed.markdown).includes("\\text{int}"), parsed.markdown)
    }
  })
})

describe("예약어 왕복 파괴 방지 (리뷰 #7)", () => {
  it("\\frac{a}{b}+x_{over} 왕복이 frac을 보존한다 (실측 재현)", () => {
    const script = latexLikeToEqEdit("\\frac{a}{b}+x_{over}")
    const back = noSpace(hmlToLatex(script))
    assert.equal(back, "\\frac{a}{b}+x_{\\text{over}}")
  })

  it("\\sqrt[n]{x}+y_{of} 왕복이 root를 보존한다", () => {
    const script = latexLikeToEqEdit("\\sqrt[n]{x}+y_{of}")
    const back = noSpace(hmlToLatex(script))
    assert.equal(back, "\\sqrt[n]{x}+y_{\\text{of}}")
  })

  it("\\text{over} 리터럴 뒤 frac도 안전하다", () => {
    const script = latexLikeToEqEdit("\\text{over} + \\frac{1}{2}")
    const back = noSpace(hmlToLatex(script))
    assert.equal(back, "\\text{over}+\\frac{1}{2}")
  })
})

describe("LaTeX 공백 매크로 (리뷰 #8)", () => {
  it("\\, \\; \\: \\! 가 리터럴 구두점으로 주입되지 않는다", () => {
    const script = latexLikeToEqEdit("\\int_a^b f(x)\\,dx")
    assert.ok(!script.includes(","), script)
    assert.ok(!noSpace(hmlToLatex(script)).includes(","), script)
    for (const [macro, ch] of [["\\;", ";"], ["\\:", ":"], ["\\!", "!"]] as const) {
      const s = latexLikeToEqEdit(`a${macro}b`)
      assert.ok(!s.includes(ch), `${macro} → ${s}`)
    }
  })

  it("\\, 는 EqEdit 얇은 공백(백틱)으로 나간다", () => {
    assert.equal(latexLikeToEqEdit("f(x)\\,dx"), "f(x) ` dx")
  })
})

describe("악성/기형 입력 가드 (리뷰 ·2)", () => {
  it("중괄호 폭탄에 스택 오버플로 없이 리터럴 폴백한다", () => {
    const out = latexLikeToEqEdit("{".repeat(5000))
    assert.equal(typeof out, "string")
  })

  it("수식 소스 길이 상한 초과는 변환 없이 통과한다", () => {
    const long = "x + ".repeat(4000)
    const out = latexLikeToEqEdit(long)
    assert.equal(typeof out, "string")
  })

  it("markdownToHwpx 경유 중괄호 폭탄도 크래시 없다 (실측 재현)", async () => {
    const buf = await markdownToHwpx("$$" + "{".repeat(30000))
    assert.ok(buf.byteLength > 0)
    const closed = await markdownToHwpx("$$\n" + "{".repeat(30000) + "\n$$")
    assert.ok(closed.byteLength > 0)
  })
})

describe("parseMarkdownToBlocks — display math", () => {
  it("single-line display math를 equation block으로 파싱한다", () => {
    const blocks = parseMarkdownToBlocks("$$a+b$$")
    assert.deepEqual(blocks, [{ type: "equation", text: "a+b" }])
  })

  it("multi-line display math를 equation block으로 파싱한다", () => {
    const blocks = parseMarkdownToBlocks("앞\n\n$$\na+b\n$$\n\n뒤")
    assert.equal(blocks[0].type, "paragraph")
    assert.equal(blocks[1].type, "equation")
    assert.equal(blocks[1].text, "a+b")
    assert.equal(blocks[2].type, "paragraph")
  })

  it("닫히지 않은 $$는 문서를 삼키지 않고 일반 문단으로 폴백한다 (리뷰 ·1 실측 재현)", () => {
    const blocks = parseMarkdownToBlocks("$$100만원 예산 내역\n\n항목1\n\n항목2")
    assert.deepEqual(blocks.map(b => b.type), ["paragraph", "paragraph", "paragraph"])
    assert.ok(blocks[0].text!.includes("100만원"))
  })

  it("같은 줄 닫는 $$ 뒤 텍스트를 문단으로 보존한다 (리뷰 ·1)", () => {
    const blocks = parseMarkdownToBlocks("$$a+b$$ 이다.")
    assert.deepEqual(blocks, [
      { type: "equation", text: "a+b" },
      { type: "paragraph", text: "이다." },
    ])
  })

  it("닫는 줄의 $$ 뒤 텍스트를 무음 소실하지 않는다 (리뷰 ·6 실측 재현)", () => {
    const blocks = parseMarkdownToBlocks("$$\nx = 1\n$$ 따라서 성립한다.")
    assert.deepEqual(blocks, [
      { type: "equation", text: "x = 1" },
      { type: "paragraph", text: "따라서 성립한다." },
    ])
  })

  it("빈 줄/코드펜스 경계에서 멀티라인 수집을 멈춘다", () => {
    const blocks = parseMarkdownToBlocks("$$\na+b\n\n문단입니다\n\n$$x$$")
    assert.deepEqual(blocks.map(b => b.type), ["paragraph", "paragraph", "paragraph", "equation"])
    const fenced = parseMarkdownToBlocks("$$\n```\ncode\n```")
    assert.equal(fenced.some(b => b.type === "equation"), false)
  })

  it("이스케이프된 \\$$ 는 수식 여닫이로 세지 않는다 (escapeGfm 접점)", () => {
    const blocks = parseMarkdownToBlocks("\\$\\$a+b\\$\\$")
    assert.deepEqual(blocks.map(b => b.type), ["paragraph"])
  })
})

describe("generateEquationXml", () => {
  it("<hp:equation>과 <hp:script>를 생성한다", () => {
    const xml = generateEquationXml("{a} over {b}", 3)
    assert.ok(xml.includes('<hp:equation id="2000000004" zOrder="3" numberingType="EQUATION"'))
    assert.ok(xml.includes('version="Equation Version 60"'))
    assert.ok(xml.includes('font="HYhwpEQ"'))
    assert.ok(xml.includes("<hp:shapeComment>수식입니다.</hp:shapeComment>"))
    assert.ok(xml.includes("<hp:script>{a} over {b}</hp:script>"))
  })

  it("<hp:script> 내용을 XML-safe하게 escape한다", () => {
    const xml = generateEquationXml("x < y & z > w")
    assert.ok(xml.includes("<hp:script>x &lt; y &amp; z &gt; w</hp:script>"))
  })
})

describe("markdownToHwpx equation generation", () => {
  it("display math block을 section0.xml의 native equation으로 렌더링한다", async () => {
    const buf = await markdownToHwpx("피타고라스\n\n$$\na^2 + b^2 = c^2\n$$")
    const zip = await JSZip.loadAsync(buf)
    const section = await zip.file("Contents/section0.xml")!.async("text").then(flatSec)

    assert.ok(section.includes("<hp:equation"), "equation 요소 생성")
    assert.ok(section.includes("<hp:script>a ^{2} + b ^{2} = c ^{2}</hp:script>"), "script 생성")
    assert.equal((section.match(/<hp:secPr/g) ?? []).length, 1, "secPr는 1회만 생성")
  })

  it("수식 문단은 다른 생성 문단과 같은 최소 셸 — lineseg/고정 id 없음", async () => {
    const buf = await markdownToHwpx("$$a+b$$")
    const zip = await JSZip.loadAsync(buf)
    const section = await zip.file("Contents/section0.xml")!.async("text").then(flatSec)
    assert.ok(!section.includes("<hp:linesegarray"), "lineseg는 한컴 재계산에 맡긴다")
  })

  it("수식이 첫 블록이면 secPr 전용 더미 문단 뒤에 equation 문단을 둔다", async () => {
    const buf = await markdownToHwpx("$$\\frac{a}{b}$$")
    const zip = await JSZip.loadAsync(buf)
    const section = await zip.file("Contents/section0.xml")!.async("text").then(flatSec)
    const secPrIdx = section.indexOf("<hp:secPr")
    const equationIdx = section.indexOf("<hp:equation")

    assert.ok(secPrIdx >= 0)
    assert.ok(equationIdx > secPrIdx, "equation은 secPr 뒤에 위치")
    assert.ok(section.includes("<hp:script>{a} over {b}</hp:script>"))
  })

  it("생성된 HWPX를 다시 파싱하면 수식이 Markdown math로 돌아온다", async () => {
    const buf = await markdownToHwpx("식:\n\n$$\\frac{a}{b}$$\n\n끝")
    const parsed = await parseHwpx(buf)

    assert.equal(parsed.success, true)
    if (parsed.success) {
      const markdown = compact(parsed.markdown)
      const mathCompact = noSpace(parsed.markdown)
      assert.ok(markdown.includes("식:"), markdown)
      assert.ok(mathCompact.includes("$\\frac{a}{b}$"), parsed.markdown)
      assert.ok(markdown.includes("끝"), markdown)
    }
  })

  it("여러 수식 block은 서로 다른 equation id를 가진다", async () => {
    const buf = await markdownToHwpx("$$x$$\n\n본문\n\n$$y$$")
    const zip = await JSZip.loadAsync(buf)
    const section = await zip.file("Contents/section0.xml")!.async("text").then(flatSec)
    const ids = [...section.matchAll(/<hp:equation id="(\d+)"/g)].map(m => m[1])

    assert.deepEqual(ids, ["2000000001", "2000000003"])
  })

  it("공문 모드에서 수식이 항목 번호 run을 끊지 않는다 (리뷰 ·5 실측 재현)", async () => {
    const md = "1. 첫째 항목\n\n$$a+b$$\n\n2. 둘째 항목\n\n3. 셋째 항목"
    const buf = await markdownToHwpx(md, { gongmun: { preset: "기안문" } })
    const zip = await JSZip.loadAsync(buf)
    const section = await zip.file("Contents/section0.xml")!.async("text").then(flatSec)

    assert.ok(section.includes("1. 첫째 항목"), "1번 유지 (단일형제 생략 미발동)")
    assert.ok(section.includes("2. 둘째 항목"), "수식 뒤 번호 연속")
    assert.ok(section.includes("3. 셋째 항목"), "run 전체 연속")
    assert.ok(section.includes("<hp:equation"), "수식도 생성됨")
  })
})

describe("미지원 LaTeX 누출 봉합 (v4.0.6 회귀) — 맨 알파벳 누출 0", () => {
  it("읽기맵(CONVERT_MAP) 전 단일 명령이 쓰기에서 읽기 어휘 토큰으로 나간다", async () => {
    const { CONVERT_MAP, MIDDLE_CONVERT_MAP } = await import("../src/hwpx/equation.js")
    const names = new Set<string>()
    for (const latex of Object.values(CONVERT_MAP)) {
      const m = /^\\([A-Za-z]+)$/.exec(latex)
      if (m) names.add(m[1])
    }
    assert.ok(names.size >= 100, `모수 확인: 단일 명령 ${names.size}개`)
    for (const name of names) {
      const tok = latexLikeToEqEdit(`\\${name}`).trim()
      // 구조 분기(sqrt·left 등)가 감싼 출력은 왕복 어서션으로 검증 (아래 케이스들)
      if (/[{"]/.test(tok)) continue
      assert.ok(
        tok in CONVERT_MAP || tok in MIDDLE_CONVERT_MAP,
        `\\${name} → "${tok}" — 읽기 어휘 밖(맨 알파벳 누출)`,
      )
    }
  })

  it("종전 누출 명령이 정확한 LaTeX로 왕복한다 (실측 목록)", () => {
    for (const cmd of ["div", "approx", "therefore", "because", "oplus", "uparrow", "propto", "cong", "equiv", "sim", "angle", "mapsto", "ll", "gg", "dagger", "models", "coprod"]) {
      const back = hmlToLatex(latexLikeToEqEdit(`a \\${cmd} b`)).replace(/\s+/g, " ").trim()
      assert.equal(back, `a \\${cmd} b`, `\\${cmd} 왕복`)
    }
  })

  it("미지원 명령은 맨 알파벳 대신 리터럴 따옴표로 보호 (\\text 되읽기)", () => {
    assert.equal(latexLikeToEqEdit("\\mathfrak{g} A").trim(), '"mathfrak" {g} A')
    // \operatorname 은 이름만 로만체 글자로 (종전엔 "operatorname" 글자가 찍혔다)
    assert.equal(latexLikeToEqEdit("\\operatorname{rank} A").trim(), '"rank" A')
    // EqEdit 함수 키워드는 따옴표 없이 identity 통과 (로만체 함수 렌더 유지)
    assert.equal(latexLikeToEqEdit("\\sin x").trim(), "sin x")
  })

  it("cases/vmatrix 환경은 EqEdit 네이티브 토큰 고정점, Bmatrix/align은 내용 보존", () => {
    const rt = (s: string) => hmlToLatex(latexLikeToEqEdit(s)).replace(/\s+/g, "").trim()
    assert.equal(rt("\\begin{cases} a & b \\\\ c & d \\end{cases}"), "\\begin{cases}a&b\\\\c&d\\end{cases}")
    assert.equal(rt("\\begin{vmatrix} a \\\\ b \\end{vmatrix}"), "\\begin{vmatrix}a\\\\b\\end{vmatrix}")
    assert.equal(rt("\\begin{Bmatrix} a \\\\ b \\end{Bmatrix}"), "\\left\\{\\begin{matrix}a\\\\b\\end{matrix}\\right\\}")
    assert.ok(rt("\\begin{align} a &= b \\\\ c &= d \\end{align}").includes("eqalign"), "align→eqalign 렌더 보존")
  })
})

describe("인라인 수식 opt-in (#150 — inlineMath)", () => {
  const ISSUE_MD = "본문 $x^2+1$ 끝\n\n| 식 | 값 |\n| --- | --- |\n| $x^2+1$ | 2 |\n\n$$x^2+1$$"
  const sectionOf = async (buf: ArrayBuffer | Uint8Array) =>
    (await JSZip.loadAsync(buf)).file("Contents/section0.xml")!.async("text").then(flatSec)
  const eqCount = (section: string) => (section.match(/<hp:equation /g) ?? []).length
  const scripts = (section: string) => [...section.matchAll(/<hp:script>([^<]*)<\/hp:script>/g)].map(m => m[1])

  it("이슈 재현 — 본문 인라인 1·표 셀 인라인 1·블록 1, 수식 객체 3개가 제자리에", async () => {
    const section = await sectionOf(await markdownToHwpx(ISSUE_MD, { inlineMath: true }))
    assert.equal(eqCount(section), 3, section)
    assert.deepEqual(scripts(section), ["x ^{2}+1", "x ^{2}+1", "x ^{2}+1"])
    // 본문: 같은 문단 안 글 run 사이에 treatAsChar 수식
    assert.match(section, /<hp:t>본문 <\/hp:t><\/hp:run><hp:run charPrIDRef="\d+"><hp:equation [^>]*>(?:(?!<\/hp:equation>)[\s\S])*?<hp:pos treatAsChar="1"[\s\S]*?<\/hp:equation><\/hp:run><hp:run charPrIDRef="\d+"><hp:t> 끝<\/hp:t>/)
    // 표 셀 안
    assert.ok([...section.matchAll(/<hp:tc[\s\S]*?<\/hp:tc>/g)].some(m => m[0].includes("<hp:equation ")), "표 셀 안 수식")
    assert.ok(!section.includes("$"), "달러 기호가 글로 남지 않는다")
    const ids = [...section.matchAll(/<hp:equation id="(\d+)"/g)].map(m => m[1])
    assert.equal(new Set(ids).size, 3, `equation id 중복 없음: ${ids}`)
  })

  it("기본(꺼짐)은 종전과 바이트 동일 — 인라인 $…$ 는 글자 유지", async () => {
    const base = await sectionOf(await markdownToHwpx(ISSUE_MD))
    assert.equal(await sectionOf(await markdownToHwpx(ISSUE_MD, { inlineMath: false })), base)
    assert.equal(eqCount(base), 1, "블록 수식만")
    assert.ok(base.includes("<hp:t>본문 $x^2+1$ 끝</hp:t>"), base)
  })

  it("보수 판정 — 이스케이프·공백 경계·닫는 $ 뒤 숫자·인라인 코드·$$ 는 수식 아님", async () => {
    for (const md of [
      "가격은 $5 이고 할인가는 $10 이다",
      "이스케이프 \\$x\\$ 는 글자",
      "공백 경계 $ 5 $ 는 글자",
      "앞 공백 $ x$ 뒤 공백 $x $ 는 글자",
      "닫는 뒤 숫자 $x$5 는 글자",
      "코드 `$x$` 는 글자",
      "본문 중간 $$x$$ 는 글자",
      "US$ 100",
    ]) {
      const section = await sectionOf(await markdownToHwpx(md, { inlineMath: true }))
      assert.equal(eqCount(section), 0, `${md} → ${section}`)
      assert.equal(section, await sectionOf(await markdownToHwpx(md)), `켜도 꺼짐과 동일: ${md}`)
    }
  })

  it("수식 안 _·* 와 백슬래시 명령은 강조·이스케이프에 먹히지 않는다", async () => {
    const section = await sectionOf(await markdownToHwpx(
      "값 $x_1 * y_1$ 그리고 **굵게 $a \\le b$** 와 $\\frac{1}{2}$ 끝", { inlineMath: true }))
    assert.deepEqual(scripts(section), ["x _{1} * y _{1}", "a LEQ b", "{1} over {2}"])
  })

  it("이스케이프 문자 뒤 'm숫자'·링크 대상 안 $ 는 수식 센티널로 오인하지 않는다", async () => {
    const a = await sectionOf(await markdownToHwpx("면적 $a^2$ (단위 \\[m2\\])", { inlineMath: true }))
    assert.deepEqual(scripts(a), ["a ^{2}"])
    assert.ok(a.includes("(단위 [m2])"), a)
    const b = await sectionOf(await markdownToHwpx("$x$ 와 \\*m0\\*", { inlineMath: true }))
    assert.deepEqual(scripts(b), ["x"])
    assert.ok(b.includes(" 와 *m0*"), b)
    const c = await sectionOf(await markdownToHwpx("[사이트 $a$](http://x.com/$a$b)", { inlineMath: true }))
    assert.deepEqual(scripts(c), ["a"], "앵커 안 수식만")
    assert.ok(c.includes("http://x.com/$a$b"), c)
  })

  it("공문서 v5 제목처럼 평문으로 쓰는 자리는 $…$ 를 글자로 보존 (LaTeX 원문만 남지 않게)", async () => {
    const md = "# 제목\n\n## 소제목 $y$\n\n- 본문"
    const on = await sectionOf(await markdownToHwpx(md, { gongmun: { preset: "보고서" }, inlineMath: true }))
    assert.ok(on.includes("소제목 $y$"), on)
  })

  it("왕복 — 생성 HWPX 를 다시 파싱하면 인라인 수식이 $…$ 로 돌아온다 (\\$ 아님)", async () => {
    const parsed = await parseHwpx(await markdownToHwpx(ISSUE_MD, { inlineMath: true }))
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    const md = parsed.markdown
    assert.ok(!md.includes("\\$"), md)
    // 되읽은 LaTeX 의 토큰 사이 공백은 블록 수식 왕복과 같은 규약(hmlToLatex) — 공백을 걷고 비교
    const body = /^본문 \$([^$]+)\$ 끝$/.exec(compact(md.split("\n").find(l => l.includes("본문"))!))
    assert.ok(body, md)
    assert.equal(noSpace(body![1]), "x^{2}+1")
    const row = md.split("\n").find(l => /\|\s*2\s*\|/.test(l))!
    assert.equal(noSpace(row), "|$x^{2}+1$|2|", row)
  })

  it("공문서 v5 경로(보고서)도 같은 옵션으로 인라인 수식을 만든다", async () => {
    const section = await sectionOf(await markdownToHwpx("# 제목\n\n## 개요\n\n- 산식 $a+b$ 적용", { gongmun: { preset: "보고서" }, inlineMath: true }))
    assert.deepEqual(scripts(section), ["a+b"])
  })

  it("CLI generate --inline-math", async () => {
    const { spawnSync } = await import("node:child_process")
    const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { fileURLToPath } = await import("node:url")
    const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url))
    const dir = mkdtempSync(join(tmpdir(), "kordoc-inline-math-"))
    try {
      const md = join(dir, "식.md")
      writeFileSync(md, ISSUE_MD)
      const run = (out: string, extra: string[]) => {
        const r = spawnSync(process.execPath, ["--import", "tsx", CLI, "generate", md, "-o", out, "--plain", "--silent", ...extra], { encoding: "utf-8", timeout: 60000 })
        assert.equal(r.status, 0, r.stderr)
      }
      run(join(dir, "on.hwpx"), ["--inline-math"])
      run(join(dir, "off.hwpx"), [])
      assert.equal(eqCount(await sectionOf(readFileSync(join(dir, "on.hwpx")))), 3)
      assert.equal(eqCount(await sectionOf(readFileSync(join(dir, "off.hwpx")))), 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("MCP generate_document inline_math", async () => {
    const { mkdtemp, readFile, rm } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { registerGenerateTools } = await import("../src/mcp/tools-generate.js")
    const dir = await mkdtemp(join(tmpdir(), "kordoc-mcp-inline-math-"))
    const previousRoot = process.env.KORDOC_ROOT
    try {
      process.env.KORDOC_ROOT = dir
      let callback: any
      registerGenerateTools({ tool(name: string, ...args: any[]) {
        if (name === "generate_document") callback = args.at(-1)
      } } as any)
      for (const [inline_math, want] of [[true, 3], [undefined, 1]] as const) {
        const output = join(dir, `out-${want}.hwpx`)
        const result = await callback({ markdown: ISSUE_MD, output_path: output, ...(inline_math ? { inline_math } : {}) })
        assert.ok(!result.isError, JSON.stringify(result))
        assert.equal(eqCount(await sectionOf(await readFile(output))), want)
      }
    } finally {
      if (previousRoot === undefined) delete process.env.KORDOC_ROOT
      else process.env.KORDOC_ROOT = previousRoot
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("한글 수식 편집기 호환 — 구문 깨짐·상자 크기·글자 크기", () => {
  it("자주 쓰는 LaTeX 명령이 글자(\"dots\")가 아니라 한글 수식 기호로 나간다", () => {
    const eq = (s: string) => latexLikeToEqEdit(s).replace(/\s+/g, " ").trim()
    assert.equal(eq("k\\in\\{1,2,\\dots,N\\}"), "k IN LEFT { 1,2, LDOTS ,N RIGHT }")
    assert.equal(eq("\\frac1{\\varphi^2}"), "{1} over {varphi ^{2}}")
    assert.equal(eq("a\\iff b"), "a LRARROW b")
    assert.equal(eq("\\max\\big(a,b\\big)"), "max (a,b )")
    assert.equal(eq("a\\qquad b"), "a ~~~~ b")
    assert.equal(eq("\\dfrac{a}{b}"), "{a} over {b}")
    assert.equal(eq("\\binom{n}{k}"), "LEFT ( {matrix{n # k}} RIGHT )")
    assert.equal(eq("\\mathbf{v}+\\mathbb{R}"), "bold{v} + ℝ")
    assert.equal(eq("\\displaystyle a \\lt b"), "a < b")
    // 짝 없는 \{ 는 안 보이는 "." 으로 닫아 LEFT/RIGHT 짝을 맞춘다
    assert.equal(eq("\\{x"), "LEFT { x RIGHT .")
    for (const s of ["\\dots", "\\varphi", "\\iff", "\\big(", "\\qquad", "\\dfrac{a}{b}", "\\binom{n}{k}", "\\mathbf{v}", "\\displaystyle a"]) {
      assert.ok(!/"[A-Za-z]+"/.test(latexLikeToEqEdit(s)), `${s} → 글자 누출`)
    }
  })

  it("되읽기 — 새 토큰이 같은 LaTeX 로 돌아온다", () => {
    const rt = (s: string) => hmlToLatex(latexLikeToEqEdit(s)).replace(/\s+/g, "")
    assert.equal(rt("\\varphi"), "\\varphi")
    assert.equal(rt("\\{1,\\dots,N\\}"), "\\left\\{1,\\ldots,N\\right\\}")
    assert.equal(rt("\\mathbf{v}"), "{v}")
  })

  it("상자 크기 — 한글 재계산 실측(baseUnit 1200, HWPUNIT)과 맞는다", () => {
    const sz = (latex: string) => {
      const x = generateEquationXml(latexLikeToEqEdit(latex))
      const m = /width="(\d+)"[^>]*height="(\d+)"/.exec(x)!
      return { w: +m[1], h: +m[2], bl: +/baseLine="(\d+)"/.exec(x)![1] }
    }
    const near = (got: number, want: number, tol: number, what: string) =>
      assert.ok(Math.abs(got - want) <= want * tol, `${what}: ${got} vs 한글 ${want}`)
    // 분수 여럿이 이어진 식 — 종전엔 앞 분수를 모두 분자로 쌓아 높이 8083(한글 2760)
    const f = sz("E_2=\\frac{4+5+6}{6}+\\frac{3}{6}\\cdot\\frac{7}{2}=\\frac{17}{4}")
    near(f.h, 2760, 0.05, "분수 이어진 식 높이")
    near(f.w, 15204, 0.08, "분수 이어진 식 폭")
    near(sz("n=2").w, 2754, 0.03, "n=2 폭")
    const sub = sz("x_{n}")
    near(sub.h, 1450, 0.03, "아래첨자 높이")
    assert.equal(sub.bl, 71)
    near(sz("\\sum_{k=1}^{n}").h, 3281, 0.05, "∑ 위아래 끝 높이")
    near(sz("\\int_0^1").h, 3089, 0.05, "∫ 끝 높이")
    near(sz("\\{1,\\dots,x\\}").w, 4218, 0.12, "중괄호 집합 폭")
  })

  it("수식 글자 크기는 놓인 run 의 글자 크기를 따른다 (10pt 본문에 12pt 수식 금지)", async () => {
    const buf = await markdownToHwpx("본문 $\\frac{a}{b}$ 끝", { inlineMath: true })
    const zip = await JSZip.loadAsync(buf)
    const sec = await zip.file("Contents/section0.xml")!.async("string")
    const hdr = await zip.file("Contents/header.xml")!.async("string")
    const m = /<hp:run charPrIDRef="(\d+)"[^>]*><hp:equation [^>]*baseUnit="(\d+)"[\s\S]*?<hp:sz width="(\d+)"[^>]*height="(\d+)"/.exec(sec)!
    const height = +new RegExp(`<hh:charPr\\b[^>]*?\\bid="${m[1]}"[^>]*?\\bheight="(\\d+)"`).exec(hdr)![1]
    assert.equal(+m[2], height)
    // 한글 실측 분수 높이 — 10pt 2250, 12pt 2760 (크기에 정비례하지 않고 0.75pt 격자로 맞춘다)
    const want = ({ 1000: 2250, 1200: 2760 } as Record<number, number>)[height]
    assert.ok(want && Math.abs(+m[4] - want) <= want * 0.02, `분수 높이 ${m[4]} vs 한글 ${want} (${height})`)
  })

  it("한글이 다시 저장한 모양 — 합친 run 의 <hp:t> 뒤 수식, 표 run 뒤 바깥 run 수식도 맞춘다 (나머지 속성은 그대로)", async () => {
    const { fitEquationsToRunSize } = await import("../src/hwpx/equation-generate.js")
    const hdr = `<hh:charPr id="0" height="1000" textColor="#000000"/><hh:charPr id="5" height="900"/>`
    const eq = (s: string) => `<hp:equation zOrder="0" id="7" textColor="#123456" baseLine="86" baseUnit="1200"><hp:sz width="1" widthRelTo="ABSOLUTE" height="1" heightRelTo="ABSOLUTE"/><hp:script>${s}</hp:script></hp:equation>`
    const sec = `<hp:run charPrIDRef="0"><hp:t>값 </hp:t>${eq("a")}<hp:tbl><hp:run charPrIDRef="5">${eq("b")}</hp:run></hp:tbl>${eq("c")}</hp:run>`
    const out = fitEquationsToRunSize(sec, hdr)
    assert.deepEqual([...out.matchAll(/baseUnit="(\d+)"/g)].map((m) => m[1]), ["1000", "900", "1000"])
    assert.equal(out.match(/textColor="#123456"/g)?.length, 3)
    assert.ok(!/ (width|height)="1"/.test(out), "hp:sz 다시 잼")
    assert.match(out, /widthRelTo="ABSOLUTE"/)
  })
})

describe("수식 상자 높이 — 위첨자 (한글 실측)", () => {
  it("LEFT … RIGHT 는 한 덩어리 — 뒤 위첨자가 늘인 괄호 높이에 붙는다", async () => {
    const { equationBox } = await import("../src/hwpx/equation-metrics.js")
    // 한글 10pt 실측: 높이 2417 · 기준선 68% (종전 2243 — 위첨자를 늘기 전 괄호에 달았다)
    const b = equationBox("LEFT ( {5} over {6} RIGHT ) ^{n-5}", 1000)
    assert.ok(Math.abs(b.height - 2417) <= 2417 * 0.02, `높이 ${b.height}`)
  })
  it("상자 폭 — 이웃 간격(이항·관계·쉼표·괄호)·첨자 크기·분수 여백, 9·10·12pt 한글 재계산 실측과 같다", async () => {
    const { equationBox } = await import("../src/hwpx/equation-metrics.js")
    const cases: Array<[string, number, number, number]> = [
      ["1,1,1,1", 2664, 3210, 3552], ["[0,1]", 1701, 2090, 2268], ["-1", 1251, 1490, 1668], ["a=a", 1953, 2295, 2604],
      ["a<b", 1953, 2295, 2679], ["a LEQ a", 2178, 2520, 2904], ["a TIMES b", 1827, 2080, 2436], ["1+2+ CDOTS +6", 4779, 5660, 6372],
      ["f(x)=1", 3354, 3860, 4422], ["E _{n}", 975, 1200, 1275], ["a ^{2} (b)", 2028, 2270, 2604], ["(E _{n} -6)", 3219, 3710, 4167],
      ["a ^{AST}", 1050, 1275, 1350], ["{1} over {2} = {1} over {2}", 2664, 3085, 3552], ["6- {47} over {54}", 2727, 3180, 3636],
      ["LEFT ( {5} over {6} RIGHT )", 1650, 1775, 2100], ['"또는 "', 1912, 2225, 2550], ["a ~ b", 1275, 1475, 1725],
    ]
    for (const [s, ...want] of cases) {
      [900, 1000, 1200].forEach((unit, k) => {
        const w = equationBox(s, unit).width
        assert.ok(Math.abs(w - want[k]) <= 2, `${s} @${unit}: ${w} vs 한글 ${want[k]}`)
      })
    }
  })
  it("보통 글자 위 첨자 — 9·10·12·15pt 실측 높이 ±2%", async () => {
    const { equationBox } = await import("../src/hwpx/equation-metrics.js")
    for (const [unit, want] of [[900, 1050], [1000, 1163], [1200, 1425], [1500, 1800]]) {
      const h = equationBox("a ^{2}", unit).height
      assert.ok(Math.abs(h - want) <= want * 0.02, `${unit}: ${h} vs ${want}`)
    }
  })
})
