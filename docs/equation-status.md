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
| HWPX 생성 | 수식 상자 폭이 평균 1.4%, 많게는 7.7% 어긋나 줄 4개가 한글과 다른 자리에서 나뉨 | 기호 폭에 양옆 간격을 넣어 둬서 앞뒤 항목과 상관없이 같게 잡음. 간격도 글자 격자로 반올림함. 첨자 글자 크기를 0.62배로 잡음 | `equation-metrics.ts`: 항목 종류(이항·관계·괄호·쉼표·분수)별 짝 간격을 실제 크기로, 첨자 크기는 2/3를 1.5pt 격자로 |
| HWPX 생성 | 수식 든 줄마다 0.5~1.6pt씩 위로 당겨져 쪽 나눔이 어긋남 | 위첨자 높이를 낮게 잡음. `LEFT … RIGHT ) ^{…}`의 첨자를 늘기 전 괄호에 닮 | `equation-metrics.ts` |

### 측정 결과 (예시 문서: 수학 문항 해설, 인라인 수식 463개, 본문 10pt)

| 항목 | 원본 4.25.5 | 현재 |
| --- | --- | --- |
| 수식 글자 크기 | 12pt (본문과 다름) | 10pt (본문과 같음) |
| 상자 높이 오차 상위 10% / 최대 | — / 212% | 0.3% / 4.9% |
| 상자 폭 오차 중앙값 / 상위 10% / 최대 | 11% / 24% / — | 0.0% / 0.2% / 4.6% |
| 깨진 LaTeX 명령 | 6종 | 0 |
| 한글 PDF와 쪽마다 줄 수가 같은 쪽 | — | 11쪽 중 11쪽 |
| 한글 PDF와 줄 나눔까지 같은 쪽 | — | 11쪽 중 11쪽 |
| kordoc PDF 본문 한글 글자 x 위치 차이 (한글 PDF 기준) | 수식 뒤에서 글자당 약 2.5pt 벌어짐 | 중앙값 0.1~0.2pt |

- **측정 방법:** Windows 11 + 한컴오피스 한글의 자동화(COM)로 HWPX를 열었습니다. 수식마다 다시 계산(`EquationModify`, `HEqEdit`)해 한글이 정한 상자 크기를 얻었습니다. PDF는 한글이 내보낸 것과 kordoc이 만든 것을 쪽마다 줄 위치로 비교했습니다. 쓴 도구는 아래 3절에 있습니다.
- **테스트:** 전체 5,231개 중 실패 40건은 원본에서도 똑같이 실패합니다. 선택 의존성(이미지 변환·OCR·QR)을 빼고 설치했거나 Windows 심볼릭 링크를 다루는 테스트입니다.

## 2. 해결해야 할 문제

우선순위는 "사용자가 바로 겪는가"와 "근거가 있는가"로 정했습니다.

### 높음

1. **벤치 게이트를 돌리지 않았음**
   - `table-pages.ts`(표 쪽 나눔 여유)와 `svg-content.ts`(빈칸 `word-spacing`)는 수식 문서가 아닌 모든 문서의 렌더에 영향을 줍니다.
   - 이 수정본은 단위 테스트만 통과했고, 회귀 게이트(`npm run bench:gate`, 특히 HWPX 렌더 배치·reflow)는 코퍼스(`bench/corpus/`)가 없어 돌리지 못했습니다.
   - 할 일: 코퍼스가 있는 환경에서 `npm run build && npm run bench:gate`를 돌려 원본과 비교합니다. "HWPX 렌더 배치" 글 위치 정확도가 원본(95.9%)보다 떨어지면 원인을 찾습니다.

2. **공문서 모드의 인라인 수식은 `--inline-math`를 켜야 함 (의도된 기본값)**
   - `kordoc generate`는 기본으로 `$…$`를 글자 그대로 둡니다(가격 표기 `$`를 수식으로 잘못 읽지 않으려는 것).
   - `--inline-math`(MCP `inline_math`)를 주면 공문서 모드에서도 한글 수식 개체로 바뀝니다(확인함).
   - 할 일 없음. 수식 문서는 `--inline-math`를 씁니다.

### 중간

4. **10pt 적분 기호 높이**
   - 한글은 10pt에서만 `int`를 3.7% 더 크게 잡습니다(`int` 하나: 실측 1911, 추정 1840). 9·12·15pt는 일치합니다.
   - 적분이 많은 쪽에서 kordoc PDF 줄 위치가 최대 6pt 어긋납니다(쪽 나눔은 같음). `lim`도 10pt에서 1200 vs 1157로 비슷합니다.
   - 할 일: 큰 연산자 글리프의 크기별 반올림 규칙을 더 많은 크기(8~20pt)에서 재서 규칙을 찾습니다. 크기 하나만 맞추는 상수는 넣지 않습니다.

5. **9pt 위첨자 높이**
   - 이번 위첨자 보정(+0.043em)으로 10·12·15pt는 좋아졌지만, 9pt 보정 묶음의 높이 최대 오차는 1.7% → 2.6%로 조금 나빠졌습니다.
   - 할 일: 4번과 함께 크기별 첨자 크기 반올림 규칙을 찾습니다.

6. **남은 상자 폭 오차 (최대 4.6%)**
   - 이웃 간격 규칙을 넣은 뒤 9·10·12pt 보통 수식은 한글과 2 HWPUNIT 안으로 맞습니다. 남은 것:
   - ∑·∫ 이 든 식(4번과 같은 10pt 큰 연산자 문제), 프라임 `''`(실측 없음), 10pt `max`(2025 vs 1950)·`LDOTS`(900 vs 825).
   - 15pt 에서는 `= , [ ]` 같은 기호 글자가 0.75pt 더 넓습니다(9·10·12pt 규칙으로 안 맞음).
   - 할 일: 큰 연산자·프라임·15pt 를 `bench/hangul-eq-refresh.ps1` 로 더 재서 규칙을 찾습니다.

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
# 1. 수식 상자: 한글이 수식마다 다시 조판한 사본 → kordoc 추정과 비교
powershell -File bench/hangul-eq-refresh.ps1 -Src 문서.hwpx -Out 문서.hancom-eq.hwpx
npx tsx bench/equation-box-cmp.mts 문서.hwpx 문서.hancom-eq.hwpx

# 2. 줄 위치: 한글 PDF ↔ kordoc PDF 쪽별 줄 수·줄 나눔·y 차
powershell -File bench/hangul-com-pdf.ps1 -Src 문서.hwpx -Out 문서.hancom.pdf
npx tsx src/cli.ts render 문서.hwpx --format pdf -o 문서.kordoc.pdf
node bench/pdf-line-drift.mjs 문서.hancom.pdf 문서.kordoc.pdf --lines
```

- `hangul-eq-refresh.ps1`: 한글은 파일을 열 때 수식 상자를 다시 재지 않으므로, 수식마다 `EquationModify`를 한 번씩 실행한 뒤 저장합니다. 이 사본의 `hp:sz`·`baseLine`이 정답입니다.
- `equation-box-cmp.mts`: 원본 스크립트를 한글이 정한 글자 크기로 `equationBox`에 넣어 폭·높이·기준선 오차(중앙값·상위 10%·최대)와 오차가 큰 수식을 찍습니다. 두 파일의 수식 수가 같아야 합니다.
- `pdf-line-drift.mjs`: 한글 글자가 든 조각만 줄로 묶어(수식 첨자는 빼고) 쪽 안에서 순서대로 짝짓습니다. 글자 x 위치(자간)는 재지 않습니다.
- 예시 문서 기준값(2026-11-24): 폭 0.0% / 0.2% / 4.6%, 높이 0.0% / 0.3% / 4.9%, 줄 수 같은 쪽 11/11, 줄 나눔까지 같은 쪽 11/11, y 차 중앙값 0.45pt · 최대 5.2pt.
