Add-Type -AssemblyName System.Drawing

function Generate-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 5, 8))
    
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 199, 126))
    $penWidth = [Math]::Max(3, $size / 48)
    $pen = New-Object System.Drawing.Pen($brush, $penWidth)
    
    $cx = $size / 2
    $cy = $size / 2
    $r = $size * 0.28
    
    # Outer eye shape
    $g.DrawEllipse($pen, [float]($cx - $r), [float]($cy - $r * 0.65), [float]($r * 2), [float]($r * 1.3))
    
    # Inner circle
    $innerR = $r * 0.55
    $g.DrawEllipse($pen, [float]($cx - $innerR), [float]($cy - $innerR), [float]($innerR * 2), [float]($innerR * 2))
    
    # Pupil (filled)
    $pupilR = $r * 0.15
    $g.FillEllipse($brush, [float]($cx - $pupilR), [float]($cy - $pupilR), [float]($pupilR * 2), [float]($pupilR * 2))
    
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $path ($size x $size)"
}

Generate-Icon 192 "public/icon-192.png"
Generate-Icon 512 "public/icon-512.png"
