[CmdletBinding(PositionalBinding = $false)]
param(
	[ValidateSet("auto", "node", "uv")]
	[string]$Runtime = "auto",
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$CommitArgs
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeCli = Join-Path $repoRoot "packages\commit-history-cli\bin\commit-history.js"
$uvProject = Join-Path $repoRoot "packages\commit-history-uv"

$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$hasUv = [bool](Get-Command uv -ErrorAction SilentlyContinue)
$hasPackageJson = Test-Path (Join-Path (Get-Location) "package.json")
$hasPyProject = Test-Path (Join-Path (Get-Location) "pyproject.toml")

function Invoke-NodeRuntime {
	& node $nodeCli @CommitArgs
}

function Invoke-UvRuntime {
	& uv run --project $uvProject commit-history-uv @CommitArgs
}

if ($Runtime -eq "node") {
	if (-not $hasNode) { throw "Node runtime requested but 'node' is not available." }
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

if ($Runtime -eq "uv") {
	if (-not $hasUv) { throw "uv runtime requested but 'uv' is not available." }
	Invoke-UvRuntime
	exit $LASTEXITCODE
}

if ($hasPackageJson -and -not $hasPyProject -and $hasNode) {
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

if ($hasPyProject -and -not $hasPackageJson -and $hasUv) {
	Invoke-UvRuntime
	exit $LASTEXITCODE
}

if ($hasPackageJson -and $hasNode) {
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

if ($hasPyProject -and $hasUv) {
	Invoke-UvRuntime
	exit $LASTEXITCODE
}

if ($hasNode) {
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

if ($hasUv) {
	Invoke-UvRuntime
	exit $LASTEXITCODE
}

throw "Neither a usable Node runtime nor uv runtime is available."
