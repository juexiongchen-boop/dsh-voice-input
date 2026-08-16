# fetch-models.ps1 — 下载 dsh-voice-input 所需的流式 ASR 模型到 %DSH_HOME%/voice-asr/models/
# 用法：在 runtime/ 目录执行  powershell -ExecutionPolicy Bypass -File .\fetch-models.ps1
# 模型来源：k2-fsa/sherpa-onnx GitHub Releases（asr-models tag），Apache-2.0 友好。

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$home = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$modelsDir = Join-Path $home 'voice-asr\models'
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$assets = @(
  @{
    name = 'sherpa-onnx-x-asr-480ms-streaming-zipformer-transducer-zh-en-punct-int8-2026-06-05.tar.bz2'
    note = '主模型：X-ASR 中英双语流式 + 自动标点（int8，约 128MB）'
  },
  @{
    name = 'sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30.tar.bz2'
    note = '备用模型：纯中文流式 Zipformer（int8，约 126MB）'
  }
)

$base = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models'

foreach ($asset in $assets) {
  $name = $asset.name
  $target = Join-Path $modelsDir $name
  $extracted = Join-Path $modelsDir ($name -replace '\.tar\.bz2$', '')
  Write-Host "== $($asset.note)"
  if (Test-Path $extracted) {
    Write-Host "   已存在，跳过：$extracted"
    continue
  }
  if (-not (Test-Path $target)) {
    Write-Host "   下载中：$name ..."
    curl.exe -L --retry 3 --connect-timeout 30 -C - -o $target "$base/$name"
    if ($LASTEXITCODE -ne 0) { throw "下载失败：$name" }
  }
  Write-Host '   解压中 ...'
  tar -xjf $target -C $modelsDir
  if ($LASTEXITCODE -ne 0) { throw "解压失败：$name" }
  Remove-Item $target -Force
  Write-Host "   完成：$extracted"
}

Write-Host ''
Write-Host '模型就绪。sidecar 启动：node ' (Join-Path $home 'voice-asr\server.js') ' --port 6035'
