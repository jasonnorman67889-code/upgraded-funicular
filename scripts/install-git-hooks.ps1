$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

node "$PSScriptRoot\install-git-hooks.mjs"
