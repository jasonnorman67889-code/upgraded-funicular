$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot "smoke_test.py"

Write-Host "Running local smoke test against backend at $env:SMOKE_BASE_URL"
python $scriptPath
