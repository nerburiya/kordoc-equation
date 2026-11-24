# 한글이 수식마다 다시 조판(EquationModify)한 HWPX 를 저장 — 수식 상자 크기(hp:sz·baseLine)의 정답
# 사용: powershell -File bench/hangul-eq-refresh.ps1 -Src 문서.hwpx -Out 문서.hancom-eq.hwpx
# 뒤이어: npx tsx bench/equation-box-cmp.mts 문서.hwpx 문서.hancom-eq.hwpx
# Windows + 한컴오피스 한글 전용. 한글은 열 때 수식 상자를 다시 재지 않는다 — 수식 편집을 한 번씩 거쳐야 한다.
param(
  [Parameter(Mandatory=$true)][string]$Src,
  [Parameter(Mandatory=$true)][string]$Out
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$tmpDir = Join-Path $env:TEMP ('hwp-eq-' + [guid]::NewGuid().ToString('N'))
$hwp = $null
try {
  [void](New-Item -ItemType Directory -Path $tmpDir -Force)
  $tmpFile = Join-Path $tmpDir (Split-Path $Src -Leaf)
  Copy-Item -LiteralPath $Src -Destination $tmpFile -Force
  $tmpOut = Join-Path $tmpDir 'out.hwpx'
  $hwp = New-Object -ComObject HWPFrame.HwpObject
  [void]$hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModuleExample')
  [void]$hwp.SetMessageBoxMode(0x2FFF1)   # 저장 확인 대화상자 자동 응답
  [void]$hwp.Open($tmpFile, 'HWPX', 'forceopen:true')
  $ctrl = $hwp.HeadCtrl; $n = 0
  while ($ctrl -ne $null) {
    if ($ctrl.CtrlID -eq 'eqed') {
      [void]$hwp.SetPosBySet($ctrl.GetAnchorPos(0))
      [void]$hwp.FindCtrl()
      $pset = $hwp.HParameterSet.HEqEdit
      [void]$hwp.HAction.GetDefault('EquationModify', $pset.HSet)
      $pset.string = $pset.VisualString
      $pset.Version = 'Equation Version 60'
      [void]$hwp.HAction.Execute('EquationModify', $pset.HSet)
      $n++
    }
    $ctrl = $ctrl.Next
  }
  $pc = $hwp.PageCount
  [void]$hwp.SaveAs($tmpOut, 'HWPX', '')
  Copy-Item -LiteralPath $tmpOut -Destination $Out -Force
  Write-Output ("OK equations=$n pages=$pc")
} catch {
  Write-Output ("ERR " + $_.Exception.Message)
} finally {
  if ($hwp) {
    try { [void]$hwp.Clear(1) } catch { }
    try { [void]$hwp.Quit() } catch { }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($hwp)
  }
  try { Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
