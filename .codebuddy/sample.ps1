Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap('C:\Users\Administrator\AppData\Local\Temp\image.png')
[int]$w = $bmp.Width; [int]$h = $bmp.Height
"尺寸 $w x $h"
# 采样：dock 背景（名称行上方空白处）与各名称文字像素
$pts = @(
  @{ n = 'dock底-左'; x = 30; y = 78 },
  @{ n = 'dock底-中'; x = 190; y = 78 },
  @{ n = 'dock底-右'; x = 350; y = 78 },
  @{ n = '名称行-酸性荧光附近'; x = 130; y = 92 },
  @{ n = '名称行-多巴胺附近'; x = 245; y = 92 },
  @{ n = '名称行-竖版海报附近'; x = 465; y = 92 }
)
foreach ($p in $pts) {
  if ($p.x -lt $w -and $p.y -lt $h) {
    $c = $bmp.GetPixel($p.x, $p.y)
    "{0}: R={1} G={2} B={3} (#{1:X2}{2:X2}{3:X2})" -f $p.n, $c.R, $c.G, $c.B
  }
}
# 扫描名称行 (y=88..98) 找暗像素分布，判断有没有深色胶囊
$dark = 0; $light = 0
for ($x = 0; $x -lt $w; $x += 2) {
  for ($y = 86; $y -le 98; $y += 2) {
    $c = $bmp.GetPixel($x, $y)
    $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
    if ($lum -lt 100) { $dark++ } elseif ($lum -gt 200) { $light++ }
  }
}
"名称行暗像素=$dark 亮像素=$light (有深色胶囊则暗像素应显著)"
# 找当前选中：扫缩略区 y=20..70 找双环/描边（亮环）
$bmp.Dispose()
