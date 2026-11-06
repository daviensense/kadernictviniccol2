$ErrorActionPreference = "Stop"
. "$PSScriptRoot\windows-images.ps1"
$root = Split-Path $PSScriptRoot -Parent

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NiccolIcon {
    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr handle);
}
"@

$iconPath = Join-Path $root "images\niccol.ico"
$image = Get-WindowsImage -Path "$root\images\logo.png" -Width 256
$square = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($square)
$handle = [IntPtr]::Zero
$icon = $null
$file = $null
try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $scale = [Math]::Min(256.0 / $image.Width, 256.0 / $image.Height)
    $width = [int]($image.Width * $scale)
    $height = [int]($image.Height * $scale)
    $graphics.DrawImage($image, [int]((256 - $width) / 2), [int]((256 - $height) / 2), $width, $height)
    $handle = $square.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($handle)
    $file = [System.IO.File]::Create($iconPath)
    $icon.Save($file)
}
finally {
    if ($file) { $file.Dispose() }
    if ($icon) { $icon.Dispose() }
    if ($handle -ne [IntPtr]::Zero) { [void][NiccolIcon]::DestroyIcon($handle) }
    $graphics.Dispose()
    $square.Dispose()
    $image.Dispose()
}

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $root "WebNiccolApp.lnk"
if (Test-Path -LiteralPath $shortcutPath) {
    throw "Shortcut already exists: $shortcutPath. Rename or remove it before running again."
}
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$shortcut.Arguments = "`"$root\WebNiccolApp.vbs`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "NICCOL - galerie a nahrani webu"
$shortcut.Save()
if (-not (Test-Path -LiteralPath $shortcutPath)) { throw "Shortcut was not created." }
Write-Host "Repository shortcut created: $shortcutPath"
