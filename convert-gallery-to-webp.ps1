# convert-gallery-to-webp.ps1
# Converts JPG/JPEG images in ./gallery to WebP files.
#
# Examples:
#   .\convert-gallery-to-webp.ps1
#   .\convert-gallery-to-webp.ps1 -Quality 82
#   .\convert-gallery-to-webp.ps1 -Force -UpdateGalleryJson
#
# Requires either:
#   - cwebp (from Google WebP tools), or
#   - magick (ImageMagick)

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1, 100)]
    [int]$Quality = 80,

    [switch]$Force,

    [switch]$UpdateGalleryJson
)

$ErrorActionPreference = "Stop"

$galleryDir = Join-Path $PSScriptRoot "gallery"
if (-not (Test-Path -Path $galleryDir -PathType Container)) {
    throw "Gallery directory not found: $galleryDir"
}

$cwebpCmd = Get-Command cwebp -ErrorAction SilentlyContinue
$magickCmd = Get-Command magick -ErrorAction SilentlyContinue

if (-not $cwebpCmd -and -not $magickCmd) {
    throw "No WebP converter found. Install 'cwebp' or ImageMagick ('magick') and try again."
}

$jpgFiles = Get-ChildItem -Path $galleryDir -File |
    Where-Object { @('.jpg', '.jpeg') -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name

if (-not $jpgFiles -or $jpgFiles.Count -eq 0) {
    Write-Host "No JPG/JPEG files found in $galleryDir"
    exit 0
}

$converted = 0
$skipped = 0
$failed = 0

foreach ($file in $jpgFiles) {
    $target = [System.IO.Path]::ChangeExtension($file.FullName, ".webp")

    if ((Test-Path $target) -and -not $Force) {
        Write-Host "Skip (exists): $($file.Name) -> $(Split-Path $target -Leaf)"
        $skipped++
        continue
    }

    if (-not $PSCmdlet.ShouldProcess($file.FullName, "Convert to WebP")) {
        continue
    }

    try {
        if ($cwebpCmd) {
            & $cwebpCmd.Path -q $Quality -o "$target" -- "$($file.FullName)" | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "cwebp exited with code $LASTEXITCODE"
            }
        }
        else {
            & $magickCmd.Path "$($file.FullName)" -quality $Quality "$target"
            if ($LASTEXITCODE -ne 0) {
                throw "magick exited with code $LASTEXITCODE"
            }
        }

        if (Test-Path $target) {
            Write-Host "Converted: $($file.Name) -> $(Split-Path $target -Leaf)"
            $converted++
        }
        else {
            throw "Output file was not created"
        }
    }
    catch {
        Write-Warning "Failed: $($file.Name)`n - $($_.Exception.Message)"
        $failed++
    }
}

Write-Host ""
Write-Host "Done. Converted: $converted | Skipped: $skipped | Failed: $failed"

if ($UpdateGalleryJson) {
    $updateScript = Join-Path $PSScriptRoot "update-gallery.ps1"
    if (Test-Path $updateScript) {
        Write-Host "Running update-gallery.ps1 ..."
        & $updateScript
    }
    else {
        Write-Warning "update-gallery.ps1 not found at: $updateScript"
    }
}
