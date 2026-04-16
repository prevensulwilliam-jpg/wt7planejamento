$out = Join-Path $env:USERPROFILE "Desktop\b64.txt"
$b64 = Get-Content $out -Raw
$len = $b64.Length
$chunk = [math]::Ceiling($len / 3)
$b64.Substring(0, $chunk) | Set-Content (Join-Path $env:USERPROFILE "Desktop\b64_1.txt") -NoNewline -Encoding ASCII
$b64.Substring($chunk, $chunk) | Set-Content (Join-Path $env:USERPROFILE "Desktop\b64_2.txt") -NoNewline -Encoding ASCII
$b64.Substring($chunk*2) | Set-Content (Join-Path $env:USERPROFILE "Desktop\b64_3.txt") -NoNewline -Encoding ASCII
Write-Host "Split done: $len chars, chunk=$chunk"
