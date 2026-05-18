Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Deploy web/ to GitHub Pages"
$form.Size = New-Object System.Drawing.Size(520, 320)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

# Title label
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "Kadernictvi NICCOL"
$lblTitle.Location = New-Object System.Drawing.Point(16, 14)
$lblTitle.Size = New-Object System.Drawing.Size(488, 22)
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(180, 150, 255)
$form.Controls.Add($lblTitle)

# Deploy button
$btnDeploy = New-Object System.Windows.Forms.Button
$btnDeploy.Text = "Nahraj web"
$btnDeploy.Location = New-Object System.Drawing.Point(16, 50)
$btnDeploy.Size = New-Object System.Drawing.Size(120, 32)
$btnDeploy.BackColor = [System.Drawing.Color]::FromArgb(88, 60, 160)
$btnDeploy.ForeColor = [System.Drawing.Color]::White
$btnDeploy.FlatStyle = "Flat"
$btnDeploy.FlatAppearance.BorderSize = 0
$btnDeploy.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($btnDeploy)

# Status label
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = ""
$lblStatus.Location = New-Object System.Drawing.Point(148, 98)
$lblStatus.Size = New-Object System.Drawing.Size(340, 18)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(150, 220, 150)
$form.Controls.Add($lblStatus)

# Output box
$txtOutput = New-Object System.Windows.Forms.RichTextBox
$txtOutput.Location = New-Object System.Drawing.Point(16, 132)
$txtOutput.Size = New-Object System.Drawing.Size(480, 134)
$txtOutput.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$txtOutput.ForeColor = [System.Drawing.Color]::FromArgb(180, 255, 180)
$txtOutput.Font = New-Object System.Drawing.Font("Consolas", 8)
$txtOutput.ReadOnly = $true
$txtOutput.BorderStyle = "None"
$txtOutput.ScrollBars = "Vertical"
$form.Controls.Add($txtOutput)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$btnDeploy.Add_Click({
    $btnDeploy.Enabled = $false
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(255, 220, 80)
    $lblStatus.Text = "Deploying web/ structure..."
    $txtOutput.Text = ""
    $form.Refresh()

    $deployScript = Join-Path $scriptDir "deploy-github.ps1"
    $argList = @()
    if ($chkForce.Checked) { $argList += "-Force" }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$deployScript`" $($argList -join ' ')"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WorkingDirectory = $scriptDir

    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    $output = $stdout
    if ($stderr -ne "") { $output += "`r`nERROR: $stderr" }
    $txtOutput.Text = $output.Trim()
    $txtOutput.SelectionStart = $txtOutput.Text.Length
    $txtOutput.ScrollToCaret()

    if ($exitCode -eq 0) {
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(100, 220, 100)
        $lblStatus.Text = "Done! web/ structure deployed successfully."
    } else {
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(255, 100, 100)
        $lblStatus.Text = "Deploy failed (exit code $exitCode)."
    }

    $btnDeploy.Enabled = $true
})

[void]$form.ShowDialog()
