param(
    [Parameter(Mandatory = $true)]
    [string] $RepositoryPath,
    [Parameter(Mandatory = $true)]
    [string] $Branch,
    [Parameter(Mandatory = $true)]
    [string] $ExpectedRemote
)

$ErrorActionPreference = "Stop"

function Get-RemoteIdentity([string]$Remote) {
    if ($Remote -match '^(?:https?://|git://)?(?:git@)?github\.com[:/](?<repository>[^/]+/[^/]+?)(?:\.git)?/?$') {
        return "github.com/$($Matches.repository.ToLowerInvariant())"
    }
    return [System.IO.Path]::GetFullPath($Remote).TrimEnd('\', '/').ToLowerInvariant()
}

function Invoke-RepositoryGit([string[]]$Arguments) {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & git -C $RepositoryPath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')`n$($output -join "`n")"
    }
    return ($output -join "`n").Trim()
}

if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
    throw "Repository folder does not exist: $RepositoryPath"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required to synchronize the local repository."
}

$repositoryRoot = (Resolve-Path -LiteralPath $RepositoryPath).Path.TrimEnd('\', '/')
$gitRoot = Invoke-RepositoryGit @("rev-parse", "--show-toplevel")
$gitRoot = (Resolve-Path -LiteralPath $gitRoot).Path.TrimEnd('\', '/')
if (-not [string]::Equals($repositoryRoot, $gitRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The deployment folder is not the root of the local Git repository."
}

if ((Invoke-RepositoryGit @("check-ref-format", "--branch", $Branch)) -ne $Branch) {
    throw "Invalid Git branch name: $Branch"
}
$localBranch = Invoke-RepositoryGit @("symbolic-ref", "--quiet", "--short", "HEAD")
if ($localBranch -ne $Branch) {
    throw "The website was uploaded, but local branch '$localBranch' is not '$Branch'; local Git state was left unchanged."
}

$origin = Invoke-RepositoryGit @("remote", "get-url", "origin")
if ((Get-RemoteIdentity $origin) -ne (Get-RemoteIdentity $ExpectedRemote)) {
    throw "The website was uploaded, but origin does not match the deployed GitHub repository; local Git state was left unchanged."
}

Write-Host "Fetching origin/$Branch..."
$fetchArguments = @("fetch", "origin", "refs/heads/$Branch`:refs/remotes/origin/$Branch")
$windowsProxy = [System.Net.WebRequest]::DefaultWebProxy
$useWindowsProxy = $false
if ($origin -match '^https://github\.com/') {
    $destination = [Uri]$origin
    if ($windowsProxy -and -not $windowsProxy.IsBypassed($destination)) {
        $proxyUri = $windowsProxy.GetProxy($destination)
        $useWindowsProxy = $proxyUri -and $proxyUri.Authority -ne $destination.Authority
    }
}
$previousNoProxy = $env:NO_PROXY
try {
    if ($useWindowsProxy) {
        Write-Host "Using the Windows proxy, as used by the website uploader."
        $fetchArguments = @("-c", "http.proxy=$($proxyUri.AbsoluteUri)") + $fetchArguments
        # curl's NO_PROXY can otherwise bypass the explicit Windows proxy.
        $env:NO_PROXY = ""
    }
    Invoke-RepositoryGit $fetchArguments | Out-Null
}
finally {
    $env:NO_PROXY = $previousNoProxy
}
$head = Invoke-RepositoryGit @("rev-parse", "HEAD")
$mergeBase = Invoke-RepositoryGit @("merge-base", "HEAD", "refs/remotes/origin/$Branch")
if ($mergeBase -ne $head) {
    throw "The website was uploaded, but local commits diverge from origin/$Branch; local Git state was left unchanged."
}

$stagedPaths = @((Invoke-RepositoryGit @("diff", "--cached", "--name-only", "--no-renames")) -split "`r?`n" | Where-Object { $_ })
$workingPaths = @((Invoke-RepositoryGit @("diff", "--name-only", "--no-renames")) -split "`r?`n" | Where-Object { $_ })
$workingPathSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($path in $workingPaths) { [void]$workingPathSet.Add($path) }
$conflictingPaths = @($stagedPaths | Where-Object { $workingPathSet.Contains($_) })
if ($conflictingPaths.Count -gt 0) {
    throw "The website was uploaded, but staged and unstaged edits overlap in: $($conflictingPaths -join ', '). Local Git state was left unchanged."
}

Invoke-RepositoryGit @("reset", "--mixed", "--quiet", "refs/remotes/origin/$Branch") | Out-Null
Write-Host "Local branch is synchronized with origin/$Branch. The stage is cleared; working files were preserved."
