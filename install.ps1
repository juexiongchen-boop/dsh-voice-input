# install.ps1 — 一键部署 dsh-voice-input 的 sidecar 运行时与模型
# 用法：在仓库根目录执行  powershell -ExecutionPolicy Bypass -File .\install.ps1
# 之后按 README 完成插件安装（dsh plugin add）与组合注册（cordis.patch.yml）。

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$home = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$runtimeRoot = Join-Path $home 'voice-asr'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== 部署 sidecar 运行时到 $runtimeRoot"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
Copy-Item (Join-Path $here 'runtime\server.js') $runtimeRoot -Force
Copy-Item (Join-Path $here 'runtime\package.json') $runtimeRoot -Force
Copy-Item (Join-Path $here 'runtime\fetch-models.ps1') $runtimeRoot -Force

Write-Host '== 安装 sidecar 依赖（sherpa-onnx-node + ws）'
Push-Location $runtimeRoot
try {
  npm install --loglevel=warn
  if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
} finally {
  Pop-Location
}

Write-Host '== 下载 ASR 模型（约 256MB，仅首次）'
& (Join-Path $runtimeRoot 'fetch-models.ps1')

Write-Host ''
Write-Host '运行时就绪。剩余两步（见 README.md）：'
Write-Host '  1. dsh plugin --profile web add github:<your-name>/dsh-voice-input'
Write-Host '  2. 在 profiles/web/cordis.patch.yml 的 insert 列表中加入：'
Write-Host '       - id: voice-input'
Write-Host '         name: ''dsh-voice-input'''
Write-Host '  然后重启 dsh web。'
