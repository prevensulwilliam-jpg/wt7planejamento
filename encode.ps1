$p = Join-Path $env:USERPROFILE "Desktop\CLAUDE WILLIAM\wt7\preview_lock_alerts.html"
Write-Host "Path: $p"
$html = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($html))
$out = Join-Path $env:USERPROFILE "Desktop\b64.txt"
$b64 | Set-Content $out -NoNewline -Encoding ASCII
Write-Host "Done: $($b64.Length) chars -> $out"
