. "$PSScriptRoot\common.ps1"

$root = Assert-ProjectRoot
Set-Location $root

Write-Section "CARTERA DASHBOARD - STATS"

$files = Get-ChildItem "src","electron" -Recurse -File -Include *.ts,*.tsx,*.css -ErrorAction SilentlyContinue

$stats = $files | ForEach-Object {
    [PSCustomObject]@{
        Archivo = $_.FullName.Substring($root.Length + 1)
        Lineas = (Get-Content $_.FullName -ErrorAction SilentlyContinue).Count
        KB = [math]::Round($_.Length / 1KB, 2)
    }
}

Write-Host "Archivos analizados: $($stats.Count)"
Write-Host "Líneas totales:      $(($stats | Measure-Object Lineas -Sum).Sum)"
Write-Host ""
Write-Host "Archivos más grandes:" -ForegroundColor Cyan
$stats | Sort-Object Lineas -Descending | Select-Object -First 15 | Format-Table -AutoSize

$patterns = @("TODO", "FIXME", "console\.log", "\bany\b", "@ts-ignore", "eslint-disable")

foreach ($pattern in $patterns) {
    $count = (
        $files |
        Select-String -Pattern $pattern -CaseSensitive:$false -ErrorAction SilentlyContinue |
        Measure-Object
    ).Count

    Write-Host ("{0,-18} {1,6}" -f $pattern, $count)
}
