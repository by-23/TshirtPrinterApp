Add-Type -AssemblyName System.Drawing
$files = @('apps\kiosk-operator-app\src\assets\tshirt-white.png','apps\kiosk-operator-app\src\assets\tshirt-white-back.png')
foreach ($f in $files) {
    $img = New-Object System.Drawing.Bitmap((Resolve-Path $f).Path)
    $w = $img.Width
    $h = $img.Height
    $hasTransparency = $false
    $minA = 255
    $maxA = 0
    $cornerAlphas = @()
    $corners = @(@(0,0), @($w-1,0), @(0,$h-1), @($w-1,$h-1), @([int]($w/2),0), @([int]($w/2),[int]($h/2)))
    foreach ($c in $corners) {
        $px = $img.GetPixel($c[0], $c[1])
        $cornerAlphas += $px.A
    }
    # sample grid for alpha stats
    for ($y = 0; $y -lt $h; $y += 20) {
        for ($x = 0; $x -lt $w; $x += 20) {
            $a = $img.GetPixel($x, $y).A
            if ($a -lt $minA) { $minA = $a }
            if ($a -gt $maxA) { $maxA = $a }
        }
    }
    Write-Output ("{0}: size={1}x{2} minAlpha={3} maxAlpha={4} cornerAlphas={5}" -f $f, $w, $h, $minA, $maxA, ($cornerAlphas -join ","))
    $img.Dispose()
}
