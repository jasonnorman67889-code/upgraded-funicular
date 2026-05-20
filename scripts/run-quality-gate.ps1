$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Running local quality gate"
node (Join-Path $PSScriptRoot "quality-gate.mjs")
