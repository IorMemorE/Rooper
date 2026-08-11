# 啟動 Tragedy Looper（自動啟動多人伺服器；找不到 Node.js 時退回純靜態模式）
$gameRoot = Split-Path -Parent $MyInvocation.MyCommand.Path   # D:\Rooper\game
$proj = Split-Path -Parent $gameRoot                          # D:\Rooper

# 尋找 Node.js
$node = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }
if (-not $node -and (Test-Path "$env:ProgramFiles\nodejs\node.exe")) { $node = "$env:ProgramFiles\nodejs\node.exe" }
if (-not $node -and (Test-Path "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) { $node = "$env:LOCALAPPDATA\Programs\nodejs\node.exe" }
if (-not $node -and (Test-Path "C:\Users\newyo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")) { $node = "C:\Users\newyo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" }

if ($node) {
  Write-Host "啟動多人伺服器: http://localhost:8360"
  Start-Process -FilePath $node -ArgumentList "$proj\server\multiplayer.js", "8360" -WorkingDirectory $proj -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
  Start-Process "http://localhost:8360/index.html"
  exit
}

Write-Host "找不到 Node.js，退回純靜態伺服器（單人可用；多人聯機需安裝 Node.js）: http://localhost:8357"
$python = "C:\Users\newyo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path $python)) {
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $python = $c; break }
  }
}
Start-Process -FilePath $python -ArgumentList "-m", "http.server", "8357" -WorkingDirectory $gameRoot -WindowStyle Hidden
Start-Sleep -Milliseconds 800
Start-Process "http://localhost:8357/index.html"
