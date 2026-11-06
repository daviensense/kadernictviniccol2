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

Add-Type @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct NiccolPropertyKey {
    public Guid FormatId;
    public uint PropertyId;
}

[StructLayout(LayoutKind.Explicit, Size = 16)]
public struct NiccolPropVariant {
    [FieldOffset(0)] public ushort Type;
    [FieldOffset(8)] public IntPtr StringValue;
}

[ComImport]
[Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface NiccolPropertyStore {
    void GetCount(out uint count);
    void GetAt(uint index, out NiccolPropertyKey key);
    void GetValue(ref NiccolPropertyKey key, out NiccolPropVariant value);
    void SetValue(ref NiccolPropertyKey key, ref NiccolPropVariant value);
    void Commit();
}

public static class NiccolShortcutIdentity {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SHGetPropertyStoreFromParsingName(
        string path, IntPtr bindContext, uint flags, ref Guid interfaceId,
        [MarshalAs(UnmanagedType.Interface)] out NiccolPropertyStore propertyStore);

    public static void SetAppId(string shortcutPath, string appId) {
        Guid interfaceId = typeof(NiccolPropertyStore).GUID;
        NiccolPropertyStore store = null;
        IntPtr stringValue = Marshal.StringToCoTaskMemUni(appId);
        try {
            SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, 2, ref interfaceId, out store);
            NiccolPropertyKey key = new NiccolPropertyKey {
                FormatId = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
                PropertyId = 5
            };
            NiccolPropVariant value = new NiccolPropVariant {
                Type = 31,
                StringValue = stringValue
            };
            store.SetValue(ref key, ref value);
            store.Commit();
        }
        finally {
            if (store != null) Marshal.ReleaseComObject(store);
            if (stringValue != IntPtr.Zero) Marshal.FreeCoTaskMem(stringValue);
        }
    }
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
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$shortcut.Arguments = "`"$root\WebNiccolApp.vbs`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "NICCOL - galerie a nahrani webu"
$shortcut.Save()
if (-not (Test-Path -LiteralPath $shortcutPath)) { throw "Shortcut was not created." }
[NiccolShortcutIdentity]::SetAppId($shortcutPath, "NICCOL.GalleryEditor")
Write-Host "Repository shortcut created or updated: $shortcutPath"
