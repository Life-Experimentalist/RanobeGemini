[CmdletBinding(PositionalBinding = $false)]
param(
	[ValidateSet("auto", "node")]
	[string]$Runtime = "auto",
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$CommitArgs
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeCli = Join-Path $repoRoot "dev\commit-history.js"

$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)

function Invoke-NodeRuntime {
	& node $nodeCli @CommitArgs
}

if ($Runtime -eq "node") {
	if (-not $hasNode) { throw "Node runtime requested but 'node' is not available." }
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

if ($hasNode) {
	Invoke-NodeRuntime
	exit $LASTEXITCODE
}

throw "Node.js is required to run dev/commit-history.js in this repository."
