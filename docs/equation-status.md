# kordoc-equation 작업 현황과 남은 문제

이 문서는 개인 수정본 [kordoc-equation](https://github.com/nerburiya/kordoc-equation)의 작업 기록입니다. 원본은 kordoc 4.25.5(커밋 `35573ec1`)입니다.
목표는 LaTeX 수식이 든 Markdown을 HWPX·PDF로 바꿀 때 한컴 한글과 어긋나는 문제를 줄이는 것입니다.

마지막 갱신: 2026-11-24

## 1. 작업 현황

### 커밋

| 커밋 | 내용 |
| --- | --- |
| `c225cb2f` | HWPX 생성 수식: 한글 수식 편집기 호환 (상자 크기·글자 크기·LaTeX 명령) |
| `fb3aa345` | README: 개인 수정본 안내·변경 내용·참고 프로젝트 표기 |
| `6c98cee3` | PDF 렌더: 수식 조판·한글 자간 바로잡기 |
| `3b9d5803` | 쪽 나눔: 본문에 드는 표는 아래 여백으로 넘치지 않게, 수식 위첨자 높이 실측 |
| `ea4ce685` | 이 문서 |
| `f4b3987b` | HWPX 수식 상자 재계산: 한글이 다시 저장한 파일에도 (`fitHwpxEquations`) |
| `fd02c29c` | bench: 한글 대조 수식 측정 도구 (수식 상자·PDF 줄 위치) |
| `28c74d78` | 수식 상자 폭: 이웃 간격 규칙과 첨자 크기 |
| `efba44a3` | 수식 큰 연산자: ∫·∑·lim 상자 8~20pt 실측 표, 첨자 크기 규칙 |

### 해결한 문제

| 영역 | 증상 | 원인 | 수정 위치 |
| --- | --- | --- | --- |
| HWPX 생성 | 수식 앞뒤 여백으로 줄이 벌어지고 글 전체가 흐트러짐 | `over`가 앞 항목 전부를 분자로 묶어 상자 높이를 최대 3배로 잡음 | `src/hwpx/equation-metrics.ts` |
| HWPX 생성 | 자간이 깨지고 수식만 커 보임 | 수식 글자 크기를 12pt로 고정. 글자 폭을 평균 11% 작게 잡음 | `equation-metrics.ts`, `equation-generate.ts`, `generator.ts` |
| HWPX 생성 | 한글 수식 편집기 구문 보기에서 `"dots"`·`"varphi"`가 글자로 보이고 `\{ \}`가 사라짐 | 변환 표에 없는 LaTeX 명령을 글자로 넣음 | `equation-generate.ts`, `equation.ts` |
| PDF 렌더 | 수식이 `E_n`, `(1+2+…)/6`, `ast` 같은 한 줄 글자로 나옴 | 수식을 한 줄 유니코드 글로 눌러 그림 | `equation-metrics.ts`(그릴 조각 출력), `src/render/equation-layout.ts` |
| PDF 렌더 | 본문 한글이 "이 므 로"처럼 벌어짐 | HTML 안 SVG에서 Chromium이 조각 끝 빈칸을 지우고, `textLength`가 남은 폭을 글자 사이에 나눔 | `src/render/html.ts`(`white-space: pre`), `svg-content.ts`(`word-spacing`) |
| PDF 렌더 | 쪽에 걸친 표의 마지막 행이 다음 쪽이 아니라 앞 쪽 아래 여백에 그려짐 | 아래 여백 넘침 여유를 쪽 중간의 작은 표에도 줌 | `src/render/table-pages.ts` |
| HWPX 생성 | 한글이 다시 저장한 HWPX·예전 생성기 HWPX는 수식 상자를 고칠 길이 없음(다시 저장한 파일 463개 중 28개만 맞춰짐) | 한글은 run 을 합쳐 수식이 `<hp:t>` 뒤에 오는데, 정규식이 run 첫 자식인 수식만 찾음 | `equation-generate.ts`(run 을 쌓아 가며 찾고 크기 값만 바꿈), `fitHwpxEquations` 공개 |
| HWPX 생성 | 수식 상자 폭이 평균 1.4%, 많게는 7.7% 어긋나 줄 4개가 한글과 다른 자리에서 나뉨 | 기호 폭에 양옆 간격을 넣어 둬서 앞뒤 항목과 상관없이 같게 잡음. 간격도 글자 격자로 반올림함. 첨자 글자 크기를 0.62배로 잡음 | `equation-metrics.ts`: 항목 종류(이항·관계·괄호·쉼표·분수)별 짝 간격을 실제 크기로, 첨자 크기 규칙은 아래 줄(× 0.68)로 바뀜 |
| HWPX 생성 | ∫·∑·lim 상자가 크기마다 어긋남(10pt ∫ 높이 3.7% 낮음, 폭 7% 넓음). 적분 든 쪽 줄 위치 최대 5.2pt 어긋남 | 큰 연산자를 한 비율로 잡음. 한글은 크기마다 반올림이 따로 놂. ∫ 아래 끝을 폭에 더함(한글은 기호 밑에 넣음). 첨자 안 간격을 뺌 | `equation-metrics.ts`: 8~20pt 실측 표 + 보간, 첨자 크기 = 실제 크기 × 0.68 을 1.5pt 격자로, 첨자 안 간격은 실제 크기 2/3 |
| HWPX 생성 | 수식 든 줄마다 0.5~1.6pt씩 위로 당겨져 쪽 나눔이 어긋남 | 위첨자 높이를 낮게 잡음. `LEFT … RIGHT ) ^{…}`의 첨자를 늘기 전 괄호에 닮 | `equation-metrics.ts` |

### 측정 결과 (예시 문서: 수학 문항 해설, 인라인 수식 463개, 본문 10pt)

| 항목 | 원본 4.25.5 | 현재 |
| --- | --- | --- |
| 수식 글자 크기 | 12pt (본문과 다름) | 10pt (본문과 같음) |
| 상자 높이 오차 상위 10% / 최대 | — / 212% | 0.3% / 2.5% |
| 상자 폭 오차 중앙값 / 상위 10% / 최대 | 11% / 24% / — | 0.0% / 0.0% / 4.1% |
| 깨진 LaTeX 명령 | 6종 | 0 |
| 한글 PDF와 쪽마다 줄 수가 같은 쪽 | — | 11쪽 중 11쪽 |
| 한글 PDF와 줄 나눔까지 같은 쪽 | — | 11쪽 중 11쪽 |
| kordoc PDF 본문 한글 글자 x 위치 차이 (한글 PDF 기준) | 수식 뒤에서 글자당 약 2.5pt 벌어짐 | 중앙값 0.1~0.2pt |

- **측정 방법:** Windows 11 + 한컴오피스 한글의 자동화(COM)로 HWPX를 열었습니다. 수식마다 다시 계산(`EquationModify`, `HEqEdit`)해 한글이 정한 상자 크기를 얻었습니다. PDF는 한글이 내보낸 것과 kordoc이 만든 것을 쪽마다 줄 위치로 비교했습니다. 쓴 도구는 아래 3절에 있습니다.
- **테스트:** 전체 5,236개 중 실패 40건은 원본에서도 똑같이 실패합니다. 선택 의존성(이미지 변환·OCR·QR)을 빼고 설치했거나 Windows 심볼릭 링크를 다루는 테스트입니다.

## 2. 해결해야 할 문제

우선순위는 "사용자가 바로 겪는가"와 "근거가 있는가"로 정했습니다.

### 높음

1. **수식이 없는 문서에서 회귀가 없는지 확인하지 않았음**
   - `table-pages.ts`(표 쪽 나눔 여유)와 `svg-content.ts`(빈칸 `word-spacing`)는 수식이 없는 모든 문서의 PDF 렌더에도 영향을 줍니다.
   - `equation-metrics.ts`는 한글이 저장한 문서의 수식을 렌더러가 그릴 때도 씁니다(그릴 조각).
   - 이 수정본은 단위 테스트와 예시 문서 하나로만 확인했습니다. 원본 저장소의 회귀 게이트(`npm run bench:gate`)는 코퍼스가 없어 돌리지 못했습니다.
   - 할 일: 5절대로 코퍼스 일부를 만들어, 원본(`35573ec1`)과 이 수정본을 같은 파일로 비교합니다.

2. ~~공문서 모드의 인라인 수식~~ — 문제 아님. `kordoc generate --inline-math`(MCP `inline_math`)로 공문서 모드에서도 수식 개체가 됩니다. 기본값이 글자 그대로인 것은 가격 표기 `$`를 수식으로 잘못 읽지 않으려는 의도입니다.

### 중간

4. **큰 연산자 끝(첨자) 높이**
   - ∫·∑·lim 글자 상자는 8~20pt 실측 표로 맞췄습니다(아래 해결 표). 끝을 단 식의 높이는 아직 규칙이 없습니다.
   - `int _{0} ^{a ^{AST}}` 꼴은 2~3% 낮게, 8pt `sum _{k=1} ^{6}` 은 4% 높게 잡습니다. 예시 문서 5쪽 줄 위치가 최대 2.2pt 어긋나는 원인입니다.
   - 할 일: 끝 높이(첨자 크기 0.68 규칙과 같은 반올림인지)를 크기별로 잽니다.

5. **9pt 위첨자 높이**
   - 이번 위첨자 보정(+0.043em)으로 10·12·15pt는 좋아졌지만, 9pt 보정 묶음의 높이 최대 오차는 1.7% → 2.6%로 조금 나빠졌습니다.
   - 할 일: 4번과 함께 크기별 첨자 크기 반올림 규칙을 찾습니다.

6. **남은 상자 폭 오차 (최대 4.1%)**
   - 9·10·12pt 보통 수식과 ∫·∑·lim 은 한글과 2 HWPUNIT 안으로 맞습니다. 남은 것:
   - 프라임 `'`·`''`: 한 글자 반올림 규칙으로 안 맞습니다(8~20pt 실측은 있음 — `a'` − `a` 225·300·300·300·375·375·375·375·450·450·525). `''` 는 둘째 프라임이 더 좁습니다.
   - 10pt `max`(2025 vs 1950)·`LDOTS`(900 vs 825), 15pt 의 `= , [ ]`(0.75pt 더 넓음).
   - 할 일: 프라임을 첨자처럼 붙이는지 확인합니다.

7. **PDF 수식 글자 추출**
   - PDF에서 수식이 글자 조각으로 그려져서, 복사하거나 글을 추출하면 `E n`처럼 나옵니다(원본은 `E_n` 한 줄 글자였음).
   - 할 일: 수식 상자에 보이지 않는 원문 글(ActualText 또는 투명 글)을 함께 넣을지 검토합니다.

### 낮음

8. **적분 기호 모양**
   - Times New Roman의 ∫를 세로로 늘여 그려 한글 PDF보다 가늘게 보입니다.
   - 할 일: 큰 연산자 전용 수학 글꼴(Cambria Math 등)을 우선 쓰거나 경로로 그립니다.

9. **빈칸 폭 가정 (0.3em)**
   - `word-spacing` 계산은 뷰어 글꼴의 빈칸을 0.3em으로 가정합니다(함초롬바탕·돋움 실측 0.3, 바탕 0.33, 맑은 고딕 0.35).
   - 다른 글꼴에서는 남는 오차가 `textLength`로 글자 사이에 조금 남습니다.

10. **HYhwpEQ 외 수식 글꼴은 측정하지 않음**
    - 글자 폭 상수는 한글 기본 수식 글꼴 기준입니다.

11. **"페이지에 걸친 표" 경고**
    - 렌더는 맞게 나뉘지만, 장면(scene) 영역 정보는 아직 시작 쪽 영역만 기록합니다(`svg-render.ts`). PDF 결과물에는 영향이 없습니다.

## 3. 다시 확인하는 방법

```bash
npm install
node --import tsx --test tests/hwpx-equation-generation.test.ts tests/render.test.ts
```

- Markdown → HWPX는 `kordoc generate 문서.md --inline-math` 또는 라이브러리의 `markdownToHwpx(md, { inlineMath: true })`를 씁니다.
- 이미 있는 HWPX(예전 생성기 산출물, 한글이 다시 저장한 파일)는 `fitHwpxEquations(buf)`로 수식 상자만 다시 잴 수 있습니다.

### 한글과 비교 측정 (Windows + 한컴오피스 한글)

```powershell
# 0. 규칙 찾기: 탐침 수식을 여러 크기로 → 한글 재조판 → 크기별 표
npx tsx bench/equation-probe.mts build bench/equation-probes/bigops.txt out/p 800,1000,1200,1500
foreach ($b in 800,1000,1200,1500) { powershell -File bench/hangul-eq-refresh.ps1 -Src out/p-$b.hwpx -Out out/p-$b-ref.hwpx }
npx tsx bench/equation-probe.mts report bench/equation-probes/bigops.txt out/p 800,1000,1200,1500 w --bad

# 1. 수식 상자: 한글이 수식마다 다시 조판한 사본 → kordoc 추정과 비교
powershell -File bench/hangul-eq-refresh.ps1 -Src 문서.hwpx -Out 문서.hancom-eq.hwpx
npx tsx bench/equation-box-cmp.mts 문서.hwpx 문서.hancom-eq.hwpx

# 2. 줄 위치: 한글 PDF ↔ kordoc PDF 쪽별 줄 수·줄 나눔·y 차
powershell -File bench/hangul-com-pdf.ps1 -Src 문서.hwpx -Out 문서.hancom.pdf
npx tsx src/cli.ts render 문서.hwpx --format pdf -o 문서.kordoc.pdf
node bench/pdf-line-drift.mjs 문서.hancom.pdf 문서.kordoc.pdf --lines
```

- `hangul-eq-refresh.ps1`: 한글은 파일을 열 때 수식 상자를 다시 재지 않으므로, 수식마다 `EquationModify`를 한 번씩 실행한 뒤 저장합니다. 이 사본의 `hp:sz`·`baseLine`이 정답입니다.
- `equation-probe.mts`: 수식 스크립트 목록을 여러 글자 크기의 HWPX로 만들고(`build`), 한글이 다시 조판한 결과와 kordoc 추정을 크기별 표로 비교합니다(`report`). 이번에 쓴 탐침 목록은 `bench/equation-probes/`에 있습니다(`basic` 글자·기호, `spacing` 이웃 간격, `bigops` 큰 연산자·프라임).
- `equation-box-cmp.mts`: 원본 스크립트를 한글이 정한 글자 크기로 `equationBox`에 넣어 폭·높이·기준선 오차(중앙값·상위 10%·최대)와 오차가 큰 수식을 찍습니다. 두 파일의 수식 수가 같아야 합니다.
- `pdf-line-drift.mjs`: 한글 글자가 든 조각만 줄로 묶어(수식 첨자는 빼고) 쪽 안에서 순서대로 짝짓습니다. 글자 x 위치(자간)는 재지 않습니다.
- 예시 문서 기준값(2026-11-24): 폭 0.0% / 0.0% / 4.1%, 높이 0.0% / 0.3% / 2.5%, 줄 수 같은 쪽 11/11, 줄 나눔까지 같은 쪽 11/11, y 차 중앙값 0.28pt · 최대 2.2pt.

## 4. 다음에 이어서 할 일

순서대로 하면 됩니다. 각 단계는 한 세션 분량입니다.

1. **코퍼스 일부로 회귀 확인** (위 1번, 5절 참고)
   - rhwp 표본으로 코퍼스를 만들고, 원본 `35573ec1`과 현재 `main`을 같은 파일로 잽니다.
   - 볼 지표: HWPX 렌더 글 위치(±1.5pt) 비율, 쪽 수 일치, reflow. 원본보다 내려간 문서가 있으면 그 문서부터 봅니다.
   - 내려간 원인이 `table-pages.ts`나 `svg-content.ts`면, 수식 문서용 수정과 일반 문서가 충돌하는 경우라 조건을 좁힙니다.
2. **큰 연산자 끝(첨자) 높이** (위 4번)
   - `bench/equation-probes/bigops.txt`의 `int _{0} ^{1} a`, `sum _{k=1} ^{6} a` 높이를 8~20pt로 다시 재고(`equation-probe.mts report … h`), 끝 높이가 첨자 크기 규칙(실제 크기 × 0.68, 1.5pt 격자)을 따르는지 봅니다.
   - 고칠 곳: `src/hwpx/equation-metrics.ts`의 `elem()` 안 `UNDER_OVER`·`int` 분기(`hs()`가 0.62 배 고정).
3. **9pt 위첨자 높이** (위 5번) — 2번과 같은 규칙일 가능성이 큽니다. `a ^{2}` 높이가 8·9pt에서 어긋납니다.
4. **프라임** (위 6번) — `a'`·`D''`를 위첨자로 붙이는지 확인합니다(첨자 크기 표와 견줘 보기).
5. **PDF 수식 글자 추출** (위 7번) — 렌더 쪽 작업이라 위와 독립입니다.

### 작업할 때 지킬 것

- 상수는 한글로 잰 값에서만 정합니다. 한 크기에만 맞는 상수는 넣지 않고, 크기마다 다르면 8~20pt를 재서 표로 둡니다.
- 고친 뒤에는 세 가지를 다시 잽니다: `equation-probe.mts report`(탐침 세 묶음 모두 — 다른 묶음이 나빠지지 않았는지), `equation-box-cmp.mts`(예시 문서), `pdf-line-drift.mjs`(예시 문서 줄 나눔 11/11 유지).
- `npm test` 실패는 40건이 기준입니다(선택 의존성 sharp·OCR·QR 미설치, Windows 심볼릭 링크). 41건 이상이면 새로 깨진 것입니다.
- 예시 문서: `../example/수학_상경_참고3선_최종.md`(저장소 밖). HWPX는 `markdownToHwpx(md, { inlineMath: true })`로 만듭니다.

## 5. 코퍼스 준비

### 코퍼스란

`bench/corpus/`는 원본 kordoc이 회귀 게이트(`npm run bench:gate`)에 쓰는 실제 문서 모음입니다.
HWPX·HWP·PDF 등 수천 개이고, 대부분 같은 문서의 **HWPX(또는 HWP)와 한컴 한글이 내보낸 PDF가 짝**으로 들어 있습니다. 짝 PDF가 "한글이 그린 정답"이라, kordoc 파서 출력과 PDF 렌더 결과를 정답에 견줄 수 있습니다.

- 저장소에는 없습니다(`.gitignore`). 원본 관리자 기기에만 있고, 문서 출처마다 라이선스가 달라 배포하지 않습니다.
- 원본 게이트는 모수 하한이 있습니다(`bench/score.mjs`의 `MIN_POP`: hwpx 2,424·pdf 1,911·hwp쌍 1,130). 일부만 모으면 지표가 좋아도 "모수 하한 미달"로 실패합니다. 그래서 이 수정본에서는 **게이트 통과가 아니라 원본과 같은 파일로 비교**하는 방식을 씁니다.
- 구성과 이력: [corpus.md](corpus.md). 수집 스크립트: `bench/collect-*.mjs`.

### 어디서 모으나

| 묶음 | 내용 | 방법 | 비고 |
| --- | --- | --- | --- |
| `rhwp/` | rhwp 저장소 표본 — hwp·hwpx와 한컴 PDF 짝 약 1,350파일 | `git clone --depth 1 https://github.com/edwardkim/rhwp.git` 후 `node bench/collect-rhwp.mjs <클론 경로>` | **먼저 할 것.** MIT, 네트워크는 clone 한 번, 수집기는 오프라인 |
| `korea-kr-pairs/` | 정책브리핑 보도자료 hwpx·pdf 짝 | `node bench/collect-korea-kr-pairs.mjs 150` | 공개 사이트를 1~1.6초 간격으로 천천히 받음 |
| `licbyl*/` | 법제처 별표·서식 HWP+PDF | `node bench/collect-licbyl.mjs 300 licbyl <OC>` | 국가법령정보 OpenAPI 사용자 ID(OC) 필요 |
| `schift/` | 개인정보 가리기 외부 정답 | `node bench/collect-schift.mjs` | 수식 작업과 무관, 받지 않아도 됨 |

수식 수정본의 영향(표 쪽 나눔·빈칸 간격·수식 그리기)을 보는 데는 `rhwp/` 하나로 충분합니다. 렌더 배치를 재려면 hwpx와 한컴 PDF 짝이 있어야 하는데, rhwp 표본에 다 있습니다.

### 준비 순서 (Windows)

```powershell
# 1. 표본 받기 — 저장소 밖에 둔다
git clone --depth 1 https://github.com/edwardkim/rhwp.git ..\rhwp
node bench/collect-rhwp.mjs ..\rhwp rhwp          # → bench/corpus/rhwp/

# 2. 기준선(원본) 체크아웃을 따로 빌드
git worktree add ..\kordoc-base 35573ec1
cd ..\kordoc-base; npm install; npm run build; cd ..\kordoc
npm run build

# 3. 렌더 배치 비교 — 같은 짝 PDF로 두 판을 잰다 (pymupdf 필요: pip install pymupdf)
python bench/layout/pdf-spans.py out/spans.json (Get-ChildItem bench/corpus/rhwp -Recurse -Filter *.pdf).FullName
npx tsx bench/layout/textpos.mts out/spans.json                 # 현재
cd ..\kordoc-base; npx tsx bench/layout/textpos.mts ..\kordoc\out\spans.json; cd ..\kordoc   # 원본

# 4. 파서·생성 벤치는 문서별 비교기로 (내려간 문서가 있으면 exit 1). 원본 대비 equation.ts(수식 읽기)도 바뀌어 파서 출력이 달라질 수 있다
node bench/suite.mjs run base --root=..\kordoc-base --only=score,text,table,roundtrip,gen
node bench/suite.mjs run cur --only=score,text,table,roundtrip,gen
node bench/suite.mjs cmp base cur
node bench/verify-reflow.mjs      # 조판(줄 나눔) — 관찰 모드, 두 판에서 각각 돌려 비교
```

- `textpos.mts`·`suite.mjs` 인자는 실행 전에 각 파일 머리말 주석으로 한 번 확인하세요. 이 절차는 원본 문서([benchmarks.md](benchmarks.md) 578행 근처, `suite.mjs` 머리말)를 옮긴 것이고, 이 기기에서는 아직 돌려 보지 않았습니다.
- 볼 것: 원본 대비 **내려간 문서 수**. 렌더 글 위치 비율이 원본보다 낮거나, 쪽 수가 새로 어긋난 문서가 생기면 4절 1단계대로 원인을 찾습니다.

