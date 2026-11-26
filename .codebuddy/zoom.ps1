Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap('C:\Users\Administrator\AppData\Local\Temp\image.png')
[int]$w = $bmp.Width; [int]$h = $bmp.Height
"尺寸 $w x $h"
# 底部 dock 区（含模板缩略行+名称）：从 60% 高度到底部
[int]$top = [int]($h * 0.62)
[int]$ch = $h - $top
$rect = New-Object System.Drawing.Rectangle 0, $top, $w, $ch
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
[int]$bw = [int]($w * 1.6); [int]$bh = [int]($ch * 1.6)
$big = New-Object System.Drawing.Bitmap $bw, $bh
$g = [System.Drawing.Graphics]::FromImage($big)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.DrawImage($crop, 0, 0, $bw, $bh)
$big.Save('g:\MoMo\ProJect\Mcard\.codebuddy\dock-zoom.png')
$g.Dispose(); $big.Dispose()
# 采样名称行：先扫 y=0..ch*0.7 找出文字行的 y（暗/亮突变），简化为直接输出若干行的亮度概况
for ($y = 0; $y -lt $ch; $y += 6) {
  $dark = 0; $mid = 0
  for ($x = 0; $x -lt $w; $x += 3) {
    $c = $crop.GetPixel($x, $y)
    $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
    if ($lum -lt 90) { $dark++ } elseif ($lum -ge 90 -and $lum -lt 180) { $mid++ }
  }
  "y=$y (orig $(($top + $y))): dark=$dark mid=$mid"
}
$crop.Dispose(); $bmp.Dispose()
