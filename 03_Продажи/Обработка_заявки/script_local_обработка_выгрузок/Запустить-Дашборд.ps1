# Launcher for the local Dashboard update.
# It finds the Python program in this folder and runs it using the bundled runtime.

$ErrorActionPreference = 'Stop'
$scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pythonScript = Get-ChildItem -LiteralPath $scriptFolder -Filter '*.py' |
  Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw 'Python runtime was not found.'
}
if (-not $pythonScript) {
  throw 'Python update program was not found.'
}

& $pythonExe $pythonScript
exit $LASTEXITCODE
