# deploy-github.ps1
# Deploy website to GitHub Pages using only a GitHub token - no Git required.
#
# Usage:
#   .\deploy-github.ps1
#
# Optional parameters:
#   -Branch "main"              (default: main)
#   -Message "Added new photos" (default: auto-generated)
#   -Force                      re-upload all files even if unchanged

param(
    [string] $Branch  = "main",
    [string] $Message = "",
    [switch] $Force
)

$Owner = "daviensense"
$Repo  = "kadernictviniccol2"
$Token = $env:GITHUB_TOKEN_HAIR

if (-not $Token) {
    if (Get-Command Get-StoredCredential -ErrorAction SilentlyContinue) {
        $cred = Get-StoredCredential -Target 'github_token_hair'
        if ($cred) {$Token = $cred.Password}
        if ($Token -and $Token -is [System.Security.SecureString]) {
            $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token)
            $Token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}
if (-not $Token) {
    throw 'No GitHub token found. Set environment variable GITHUB_TOKEN_HAIR, or add a stored credential "github_token_hair".'
}

# Print some safe diagnostics about the token being used
$tokenSource = if ($env:GITHUB_TOKEN_HAIR) { 'env:GITHUB_TOKEN_HAIR' } elseif ($cred) { 'stored credential "github_token_hair"' } else { 'unknown' }
$tokenLen = if ($Token) { $Token.Length } else { 0 }
$masked = if ($tokenLen -le 8) { '*' * $tokenLen } else { $Token.Substring(0,4) + ('*' * [Math]::Max(4, ($tokenLen - 8))) + $Token.Substring($tokenLen-4) }
Write-Host "Using token from $tokenSource $masked"


$root    = $PSScriptRoot
$api     = "https://api.github.com"
$headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

# Compute the same blob SHA that GitHub stores for a file
function Get-BlobSha([string]$filePath) {
    $bytes  = [System.IO.File]::ReadAllBytes($filePath)
    $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
    $sha1   = [System.Security.Cryptography.SHA1]::Create()
    return ($sha1.ComputeHash($header + $bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
}

# Convert an absolute local path to a repo-relative forward-slash path.
function Get-RepoPath([string]$fullPath) {
    $rel = $fullPath.Substring($root.TrimEnd('\').Length).TrimStart('\').Replace('\', '/')
    if ($rel -like 'web/*') {
        return $rel.Substring(4)
    }
    return $rel
}

# ------------------------------------------------------------------
# 1. Regenerate data/gallery.json
# ------------------------------------------------------------------
Write-Host "Updating gallery list..."
& "$root\update-gallery.ps1"
Write-Host ""

# ------------------------------------------------------------------
# 2. Get current branch state from GitHub
# ------------------------------------------------------------------
Write-Host "Connecting to github.com/$Owner/$Repo (branch: $Branch)..."
$currentCommitSha = $null
$currentTreeSha   = $null
$remoteShas       = @{}

try {
    $ref    = Invoke-RestMethod -Uri "$api/repos/$Owner/$Repo/git/ref/heads/$Branch" -Headers $headers
    $currentCommitSha = $ref.object.sha
    $commit = Invoke-RestMethod -Uri "$api/repos/$Owner/$Repo/git/commits/$currentCommitSha" -Headers $headers
    $currentTreeSha = $commit.tree.sha
    $tree   = Invoke-RestMethod -Uri "$api/repos/$Owner/$Repo/git/trees/$currentTreeSha`?recursive=1" -Headers $headers
    foreach ($item in $tree.tree) {
        if ($item.type -eq "blob") { $remoteShas[$item.path] = $item.sha }
    }
    Write-Host "Found $($remoteShas.Count) existing remote file(s)."
} catch {
    Write-Host "Repo appears empty - all files will be uploaded fresh."
}

# ------------------------------------------------------------------
# 3. Collect local files to deploy
# ------------------------------------------------------------------
$imgExts    = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif")
$localFiles = @()
$localFiles += Get-Item "$root\index.html"
$localFiles += Get-Item "$root\styles\main.css"
$localFiles += Get-Item "$root\data\gallery.json"
$localFiles += Get-Item "$root\data\hours.json"
$localFiles += Get-ChildItem "$root\js" -File |
               Where-Object { $_.Extension -eq '.js' }
$localFiles += Get-ChildItem "$root\gallery" -File |
               Where-Object { $imgExts -contains $_.Extension.ToLower() }
$localFiles += Get-ChildItem "$root\images" -File |
               Where-Object { $imgExts -contains $_.Extension.ToLower() }

# ------------------------------------------------------------------
# 4. Create blobs for changed files only
# ------------------------------------------------------------------
Write-Host ""
$treeEntries = @()
$skipped     = 0

# Build set of local repo paths for comparison
$localRepoPaths = @{}
foreach ($file in $localFiles) {
    $localRepoPaths[(Get-RepoPath $file.FullName)] = $true
}

# Delete remote files that were previously deployed but no longer exist locally
# (managed website files deployed from /web)
foreach ($remotePath in $remoteShas.Keys) {
    $isManaged = ($remotePath -eq 'index.html') -or
                 ($remotePath -eq 'styles/main.css') -or
                 ($remotePath -match '^js/[^/]+\.js$') -or
                 ($remotePath -eq 'data/gallery.json') -or
                 ($remotePath -eq 'data/hours.json') -or
                 ($remotePath -match '^gallery/[^/]+$') -or
                 ($remotePath -match '^images/[^/]+$')
    if ($isManaged -and -not $localRepoPaths.ContainsKey($remotePath)) {
        Write-Host "  delete  $remotePath"
        $treeEntries += @{ path = $remotePath; mode = "100644"; type = "blob"; sha = $null }
    }
}

foreach ($file in $localFiles) {
    $repoPath = Get-RepoPath $file.FullName
    $localSha = Get-BlobSha  $file.FullName

    if (-not $Force -and $localSha -eq $remoteShas[$repoPath]) {
        Write-Host "  skip    $repoPath"
        $skipped++
        continue
    }

    Write-Host "  stage   $repoPath"
    $b64  = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file.FullName))
    $blob = Invoke-RestMethod `
        -Uri         "$api/repos/$Owner/$Repo/git/blobs" `
        -Method      POST `
        -Headers     $headers `
        -Body        (@{ content = $b64; encoding = "base64" } | ConvertTo-Json) `
        -ContentType "application/json"

    $treeEntries += @{ path = $repoPath; mode = "100644"; type = "blob"; sha = $blob.sha }
}

if ($treeEntries.Count -eq 0 -and $skipped -gt 0) {
    Write-Host ""
    Write-Host "Nothing to commit - all files are up to date."
    exit 0
}

# ------------------------------------------------------------------
# 5. Create tree
# ------------------------------------------------------------------
Write-Host ""
Write-Host "Creating tree ($($treeEntries.Count) file(s))..."
$treeBody = @{ tree = $treeEntries }
if ($currentTreeSha) { $treeBody.base_tree = $currentTreeSha }

$newTree = Invoke-RestMethod `
    -Uri         "$api/repos/$Owner/$Repo/git/trees" `
    -Method      POST `
    -Headers     $headers `
    -Body        ($treeBody | ConvertTo-Json -Depth 5) `
    -ContentType "application/json"

# ------------------------------------------------------------------
# 6. Create commit
# ------------------------------------------------------------------
$timestamp  = Get-Date -Format "yyyy-MM-dd HH:mm"
$msg        = if ($Message) { $Message } else { "deploy: update website [$timestamp]" }
$msgEsc     = $msg -replace '\\','\\' -replace '"','\"'
$parentsArr = if ($currentCommitSha) { "`"$currentCommitSha`"" } else { "" }
$commitJson = "{`"message`":`"$msgEsc`",`"tree`":`"$($newTree.sha)`",`"parents`":[$parentsArr]}"

$newCommit = Invoke-RestMethod `
    -Uri         "$api/repos/$Owner/$Repo/git/commits" `
    -Method      POST `
    -Headers     $headers `
    -Body        $commitJson `
    -ContentType "application/json"

# ------------------------------------------------------------------
# 7. Update branch ref
# ------------------------------------------------------------------
Write-Host "Pushing 1 commit..."
if ($currentCommitSha) {
    Invoke-RestMethod `
        -Uri         "$api/repos/$Owner/$Repo/git/refs/heads/$Branch" `
        -Method      PATCH `
        -Headers     $headers `
        -Body        (@{ sha = $newCommit.sha } | ConvertTo-Json) `
        -ContentType "application/json" | Out-Null
} else {
    Invoke-RestMethod `
        -Uri         "$api/repos/$Owner/$Repo/git/refs" `
        -Method      POST `
        -Headers     $headers `
        -Body        (@{ ref = "refs/heads/$Branch"; sha = $newCommit.sha } | ConvertTo-Json) `
        -ContentType "application/json" | Out-Null
}

Write-Host ""
Write-Host "Done. $($treeEntries.Count) file(s) changed, $skipped unchanged - pushed in 1 commit."
Write-Host "Live at: https://$Owner.github.io/$Repo"
