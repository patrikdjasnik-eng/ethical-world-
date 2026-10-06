[CmdletBinding()]
param([string]$InstallerScript = (Join-Path $PSScriptRoot "test-desktop-install.ps1"))

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

# Load the real discovery function without running a Windows installer.
$parseTokens = $null
$parseErrors = $null
$installerAst = [Management.Automation.Language.Parser]::ParseFile($InstallerScript, [ref]$parseTokens, [ref]$parseErrors)
Assert-True ($parseErrors.Count -eq 0) "Installer script must parse successfully."
$discoveryFunction = $installerAst.Find({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Get-EthicalWorldShortcuts"
}, $true)
Assert-True ($null -ne $discoveryFunction) "Shortcut discovery function was not found."
. ([scriptblock]::Create($discoveryFunction.Extent.Text))
$selectionFunction = $installerAst.Find({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Get-EthicalWorldDesktopShortcut"
}, $true)
Assert-True ($null -ne $selectionFunction) "Desktop shortcut selection function was not found."
. ([scriptblock]::Create($selectionFunction.Extent.Text))

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("ethical-world-shortcuts-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
  $shortcutFixtures = @{}
  $fakeShell = [PSCustomObject]@{ Shortcuts = $shortcutFixtures }
  $fakeShell | Add-Member -MemberType ScriptMethod -Name CreateShortcut -Value {
    param($shortcutPath)
    if (-not $this.Shortcuts.ContainsKey($shortcutPath)) { throw "Unreadable shortcut fixture." }
    return $this.Shortcuts[$shortcutPath]
  }

  $emptyResult = @(Get-EthicalWorldShortcuts -ShortcutShell $fakeShell -ShortcutLocations @($fixtureRoot))
  Assert-True ($emptyResult.Count -eq 0) "An empty desktop must return zero shortcut records."

  $namedPath = Join-Path $fixtureRoot "Ethical World.lnk"
  New-Item -ItemType File -Path $namedPath | Out-Null
  $shortcutFixtures[$namedPath] = [PSCustomObject]@{ TargetPath = "C:\old\EthicalWorld.exe"; Arguments = ""; IconLocation = "" }
  $singleResult = @(Get-EthicalWorldShortcuts -ShortcutShell $fakeShell -ShortcutLocations @($fixtureRoot))
  Assert-True ($singleResult.Count -eq 1) "One matching link must return one shortcut record, not the automatic regex Matches table."
  Assert-True ($singleResult[0].Path -eq $namedPath) "The shortcut record must retain its file path."

  $targetPath = Join-Path $fixtureRoot "Workspace.lnk"
  $argumentPath = Join-Path $fixtureRoot "Launcher.lnk"
  $otherPath = Join-Path $fixtureRoot "Z unrelated.lnk"
  $unreadablePath = Join-Path $fixtureRoot "Ethical unreadable.lnk"
  foreach ($fixturePath in @($targetPath, $argumentPath, $otherPath, $unreadablePath)) {
    New-Item -ItemType File -Path $fixturePath | Out-Null
  }
  $shortcutFixtures[$targetPath] = [PSCustomObject]@{ TargetPath = "C:\old\EthicalWorld.exe"; Arguments = ""; IconLocation = "icon,0" }
  $shortcutFixtures[$argumentPath] = [PSCustomObject]@{ TargetPath = "C:\app\Update.exe"; Arguments = '--processStart "EthicalWorld.exe"'; IconLocation = "" }
  $shortcutFixtures[$otherPath] = [PSCustomObject]@{ TargetPath = "C:\other\other.exe"; Arguments = ""; IconLocation = "" }

  $multipleResult = @(Get-EthicalWorldShortcuts -ShortcutShell $fakeShell -ShortcutLocations @($fixtureRoot, $fixtureRoot))
  Assert-True ($multipleResult.Count -eq 3) "Discovery must keep all matching records, deduplicate locations and skip unrelated/unreadable links."
  $snapshot = @{}
  foreach ($record in $multipleResult) {
    $snapshot[$record.Path] = $record.LastWriteTimeUtc
  }
  Assert-True ($snapshot.Count -eq 3) "Shortcut records must be usable as non-null snapshot keys before installation."
  Assert-True ($snapshot.ContainsKey($namedPath) -and $snapshot.ContainsKey($targetPath) -and $snapshot.ContainsKey($argumentPath)) "Snapshot must contain the expected shortcut paths."
  $launcherRecord = [PSCustomObject]@{ Path = (Join-Path $fixtureRoot "Ethical World Launcher.lnk"); TargetPath = "C:\Windows\powershell.exe"; Arguments = '-File "C:\EthicalWorldLauncher\desktop-launcher.ps1"' }
  $selection = Get-EthicalWorldDesktopShortcut -Shortcuts (@($launcherRecord) + $multipleResult) -DesktopPath $fixtureRoot
  Assert-True ($selection.Path -ne $launcherRecord.Path) "Installer smoke must select the app shortcut, not recursively start the update launcher."
  $updaterSelection = Get-EthicalWorldDesktopShortcut -Shortcuts (@($launcherRecord) + $multipleResult) -DesktopPath $fixtureRoot -ExpectedUpdater "C:\app\Update.exe"
  Assert-True ($updaterSelection.Path -eq $argumentPath) "Versioned smoke must select the installed Squirrel updater."
  Write-Host "[PASS] Shortcut discovery: empty, single, multiple, unreadable and snapshot indexing."
} finally {
  Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
}

foreach ($scriptFile in (Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.ps1" -File)) {
  $scriptAst = [Management.Automation.Language.Parser]::ParseFile($scriptFile.FullName, [ref]$parseTokens, [ref]$parseErrors)
  Assert-True ($parseErrors.Count -eq 0) "PowerShell parse error in $($scriptFile.Name)."
  $automaticAssignments = @($scriptAst.FindAll({
    param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and
      $node.Left -is [Management.Automation.Language.VariableExpressionAst] -and
      $node.Left.VariablePath.UserPath -in @("matches", "args", "input", "home", "host", "pid")
  }, $true))
  Assert-True ($automaticAssignments.Count -eq 0) "Do not overwrite PowerShell automatic variables in $($scriptFile.Name)."
}
Write-Host "[PASS] All desktop scripts parse and avoid overwriting checked automatic variables."
