[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw "Launcher requires Windows." }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

$launcherDir = $PSScriptRoot
$launcherMutex = New-Object Threading.Mutex($false, "Local\EthicalWorldLauncher")
$ownsMutex = $false
try {
  try { $ownsMutex = $launcherMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (-not $ownsMutex) {
    [Windows.Forms.MessageBox]::Show("Kontrola aktualizaci uz probiha. Pouzij otevrene okno launcheru.", "Ethical World Launcher") | Out-Null
    return
  }
  $config = Get-Content -LiteralPath (Join-Path $launcherDir "config.json") -Raw | ConvertFrom-Json
  $statusPath = Join-Path $launcherDir "status.json"
  $logPath = Join-Path $launcherDir "launcher.log"
  Remove-Item -LiteralPath $statusPath -ErrorAction SilentlyContinue

  $form = New-Object Windows.Forms.Form
  $form.Text = "Ethical World Launcher"
  $form.ClientSize = New-Object Drawing.Size(570, 300)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.BackColor = [Drawing.ColorTranslator]::FromHtml("#101116")
  $form.ForeColor = [Drawing.ColorTranslator]::FromHtml("#e9e9ef")
  $form.Font = New-Object Drawing.Font("Segoe UI", 10)

  $titleLabel = New-Object Windows.Forms.Label
  $titleLabel.Text = "Ethical World"
  $titleLabel.Font = New-Object Drawing.Font("Segoe UI", 24, [Drawing.FontStyle]::Bold)
  $titleLabel.Location = New-Object Drawing.Point(25, 24)
  $titleLabel.Size = New-Object Drawing.Size(510, 48)
  $form.Controls.Add($titleLabel)

  $statusLabel = New-Object Windows.Forms.Label
  $statusLabel.Text = "Spoustim kontrolu aktualizaci..."
  $statusLabel.Location = New-Object Drawing.Point(28, 92)
  $statusLabel.Size = New-Object Drawing.Size(510, 105)
  $form.Controls.Add($statusLabel)

  $progressBar = New-Object Windows.Forms.ProgressBar
  $progressBar.Location = New-Object Drawing.Point(28, 208)
  $progressBar.Size = New-Object Drawing.Size(510, 6)
  $progressBar.Style = "Marquee"
  $form.Controls.Add($progressBar)

  $logButton = New-Object Windows.Forms.Button
  $logButton.Text = "Otevrit log"
  $logButton.Location = New-Object Drawing.Point(28, 240)
  $logButton.Size = New-Object Drawing.Size(120, 32)
  $logButton.FlatStyle = "Flat"
  $logButton.Add_Click({ if (Test-Path -LiteralPath $logPath) { Start-Process notepad.exe -ArgumentList ('"' + $logPath + '"') } })
  $form.Controls.Add($logButton)

  $closeButton = New-Object Windows.Forms.Button
  $closeButton.Text = "Zavrit"
  $closeButton.Location = New-Object Drawing.Point(418, 240)
  $closeButton.Size = New-Object Drawing.Size(120, 32)
  $closeButton.FlatStyle = "Flat"
  $closeButton.Enabled = $false
  $closeButton.Add_Click({ $form.Close() })
  $form.Controls.Add($closeButton)

  $launcherSession = @{ Worker = $null; Busy = $true; FinishedAt = $null; Success = $false }
  $timer = New-Object Windows.Forms.Timer
  $timer.Interval = 250
  $timer.Add_Tick({
    try {
      if (Test-Path -LiteralPath $statusPath) {
        $currentStatus = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
        $statusLabel.Text = [string]$currentStatus.message
      }
    } catch {
      # Retry a transient status read without blocking worker-exit detection.
    }
    try {
      if ($launcherSession.Worker -and $launcherSession.Worker.HasExited -and $launcherSession.Busy) {
        $launcherSession.Busy = $false
        $launcherSession.FinishedAt = Get-Date
        $launcherSession.Success = $launcherSession.Worker.ExitCode -eq 0
        $progressBar.Style = "Blocks"
        $progressBar.Value = 100
        $closeButton.Enabled = $true
        if ($launcherSession.ErrorOutput.IsCompleted) {
          [IO.File]::AppendAllText($logPath, $launcherSession.ErrorOutput.Result)
        }
        if (-not $launcherSession.Success) {
          $statusLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml("#f6c177")
          if (-not $currentStatus -or $currentStatus.stage -notin @("warning", "error")) {
            $statusLabel.Text = "Launcher se nepodarilo dokoncit. Otevri log pro podrobnosti."
          }
        }
      }
      if ($launcherSession.Success -and ((Get-Date) - $launcherSession.FinishedAt).TotalMilliseconds -gt 700) {
        $timer.Stop()
        $form.Close()
      }
    } catch {
      # Keep the window responsive if a disposed process races the final tick.
    }
  })

  $form.Add_FormClosing({
    param($sender, $event)
    if ($launcherSession.Busy) {
      $event.Cancel = $true
      $statusLabel.Text = "Aktualizace jeste probiha. Pockej na dokonceni, aby se instalace neprerusila."
    }
  })
  $form.Add_Shown({
    try {
      $startInfo = New-Object Diagnostics.ProcessStartInfo
      $startInfo.FileName = [string]$config.nodePath
      $startInfo.Arguments = '"' + (Join-Path $launcherDir "launcher-core.cjs") + '" "' + (Join-Path $launcherDir "config.json") + '"'
      $startInfo.WorkingDirectory = $launcherDir
      $startInfo.UseShellExecute = $false
      $startInfo.CreateNoWindow = $true
      $startInfo.RedirectStandardError = $true
      $launcherSession.Worker = [Diagnostics.Process]::Start($startInfo)
      # Drain the pipe asynchronously so native diagnostics cannot block the worker.
      $launcherSession.ErrorOutput = $launcherSession.Worker.StandardError.ReadToEndAsync()
      $timer.Start()
    } catch {
      $launcherSession.Busy = $false
      $statusLabel.Text = "Launcher nelze spustit. Zkontroluj instalaci Node.js a konfiguraci."
      $closeButton.Enabled = $true
      [IO.File]::WriteAllText($logPath, $_.Exception.Message)
    }
  })
  [Windows.Forms.Application]::Run($form)
  $timer.Dispose()
  if ($launcherSession.Worker) { $launcherSession.Worker.Dispose() }
  $form.Dispose()
} catch {
  [Windows.Forms.MessageBox]::Show($_.Exception.Message, "Ethical World Launcher") | Out-Null
} finally {
  if ($ownsMutex) { $launcherMutex.ReleaseMutex() }
  $launcherMutex.Dispose()
}
