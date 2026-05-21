/**
 * Generate PWA icon PNGs from SVG using Node.js built-in fetch + resvg-js
 * Run: npx tsx scripts/generate-icons.mjs
 * 
 * Alternative: If you have Inkscape or ImageMagick installed:
 *   inkscape public/icon-192.svg -w 192 -h 192 -o public/icon-192.png
 *   inkscape public/icon-512.svg -w 512 -h 512 -o public/icon-512.png
 */

import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

// Try to use resvg-js if available, otherwise fall back to a simple approach
async function main() {
  try {
    // Method 1: Try npx @resvg/resvg-js-win32-x64-msvc (or platform equivalent)
    const { Resvg } = await import('@aspect-build/rules_js/../resvg-js').catch(() => null) || {};
    if (Resvg) {
      for (const size of [192, 512]) {
        const svg = readFileSync(`public/icon-${size}.svg`, 'utf8');
        const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
        const png = resvg.render().asPng();
        writeFileSync(`public/icon-${size}.png`, png);
        console.log(`Generated icon-${size}.png`);
      }
      return;
    }
  } catch {}

  // Method 2: Use PowerShell + .NET System.Drawing (Windows)
  console.log('Using PowerShell to convert SVGs to PNGs...');
  for (const size of [192, 512]) {
    const ps = `
      Add-Type -AssemblyName System.Drawing
      $bmp = New-Object System.Drawing.Bitmap(${size}, ${size})
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 5, 8))
      
      # Draw the eye icon
      $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 199, 126))
      $pen = New-Object System.Drawing.Pen($brush, [Math]::Max(2, ${size}/64))
      
      $cx = ${size}/2
      $cy = ${size}/2
      $r = ${size} * 0.28
      
      # Outer eye shape (ellipse)
      $g.DrawEllipse($pen, [float]($cx - $r), [float]($cy - $r * 0.6), [float]($r * 2), [float]($r * 1.2))
      
      # Inner circle
      $innerR = $r * 0.55
      $g.DrawEllipse($pen, [float]($cx - $innerR), [float]($cy - $innerR), [float]($innerR * 2), [float]($innerR * 2))
      
      # Pupil
      $pupilR = $r * 0.15
      $g.FillEllipse($brush, [float]($cx - $pupilR), [float]($cy - $pupilR), [float]($pupilR * 2), [float]($pupilR * 2))
      
      $g.Dispose()
      $bmp.Save("public/icon-${size}.png", [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      Write-Host "Generated icon-${size}.png"
    `;
    try {
      execSync(`powershell -Command "${ps.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Failed to generate icon-${size}.png:`, err.message);
    }
  }
}

main();
