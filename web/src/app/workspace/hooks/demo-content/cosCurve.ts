/**
 * Cos Curve — Content for Demo Scenario 2
 *
 * Python code for cos curve plotting + fallback image URL.
 */

export const COS_CURVE_CODE = `import numpy as np
import matplotlib.pyplot as plt

# Generate data
x = np.linspace(0, 4 * np.pi, 1000)
y = np.cos(x)

# Create figure
fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(x, y, 'b-', linewidth=2, label='cos(x)')
ax.fill_between(x, y, alpha=0.1, color='blue')
ax.axhline(y=0, color='gray', linestyle='--', linewidth=0.5)

# Styling
ax.set_xlabel('x (radians)', fontsize=12)
ax.set_ylabel('cos(x)', fontsize=12)
ax.set_title('Cosine Function', fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3)
ax.set_xlim(0, 4 * np.pi)
ax.set_ylim(-1.3, 1.3)

plt.tight_layout()
plt.savefig('/workspace/cos_curve.png', dpi=150, bbox_inches='tight')
plt.show()
print("Plot saved to /workspace/cos_curve.png")`;

/**
 * Fallback cos curve image URL
 * Used when Jupyter kernel is not available for real execution
 */
export const COS_CURVE_IMAGE_URL =
  'https://matplotlib.org/stable/_images/sphx_glr_figure_title_001.png';

/**
 * Pre-rendered cos curve as an SVG data URI (small, no external dependency)
 */
export const COS_CURVE_SVG = (() => {
  // Generate SVG path for cos curve
  const width = 800;
  const height = 480;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const points: string[] = [];
  const fillPoints: string[] = [];
  const numPoints = 200;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = margin.left + t * plotW;
    const val = Math.cos(t * 4 * Math.PI);
    const y = margin.top + plotH / 2 - (val * plotH) / 2;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    fillPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const midY = margin.top + plotH / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">Cosine Function</text>
  <!-- Grid -->
  <line x1="${margin.left}" y1="${midY}" x2="${width - margin.right}" y2="${midY}" stroke="#ccc" stroke-dasharray="4"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="#333" stroke-width="1"/>
  <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${width - margin.right}" y2="${margin.top + plotH}" stroke="#333" stroke-width="1"/>
  <!-- Fill -->
  <polygon points="${margin.left},${midY} ${fillPoints.join(' ')} ${width - margin.right},${midY}" fill="rgba(59,130,246,0.1)"/>
  <!-- Curve -->
  <path d="${points.join('')}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
  <!-- Labels -->
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="13" fill="#555">x (radians)</text>
  <text x="15" y="${height / 2}" text-anchor="middle" font-size="13" fill="#555" transform="rotate(-90,15,${height / 2})">cos(x)</text>
  <!-- Y-axis labels -->
  <text x="${margin.left - 10}" y="${margin.top + 5}" text-anchor="end" font-size="11" fill="#666">1.0</text>
  <text x="${margin.left - 10}" y="${midY + 4}" text-anchor="end" font-size="11" fill="#666">0.0</text>
  <text x="${margin.left - 10}" y="${margin.top + plotH + 5}" text-anchor="end" font-size="11" fill="#666">-1.0</text>
  <!-- Legend -->
  <line x1="${width - margin.right - 100}" y1="${margin.top + 15}" x2="${width - margin.right - 70}" y2="${margin.top + 15}" stroke="#3b82f6" stroke-width="2.5"/>
  <text x="${width - margin.right - 65}" y="${margin.top + 19}" font-size="12" fill="#333">cos(x)</text>
</svg>`;

  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
})();

/**
 * Raw SVG string for Jupyter notebook output rendering
 * (Jupyter uses `image/svg+xml` MIME type with raw SVG, not data URI)
 */
export const COS_CURVE_SVG_RAW = (() => {
  const width = 800;
  const height = 480;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const points: string[] = [];
  const fillPoints: string[] = [];
  const numPoints = 200;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = margin.left + t * plotW;
    const val = Math.cos(t * 4 * Math.PI);
    const y = margin.top + plotH / 2 - (val * plotH) / 2;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    fillPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const midY = margin.top + plotH / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">Cosine Function</text>
  <line x1="${margin.left}" y1="${midY}" x2="${width - margin.right}" y2="${midY}" stroke="#ccc" stroke-dasharray="4"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="#333" stroke-width="1"/>
  <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${width - margin.right}" y2="${margin.top + plotH}" stroke="#333" stroke-width="1"/>
  <polygon points="${margin.left},${midY} ${fillPoints.join(' ')} ${width - margin.right},${midY}" fill="rgba(59,130,246,0.1)"/>
  <path d="${points.join('')}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="13" fill="#555">x (radians)</text>
  <text x="15" y="${height / 2}" text-anchor="middle" font-size="13" fill="#555" transform="rotate(-90,15,${height / 2})">cos(x)</text>
  <text x="${margin.left - 10}" y="${margin.top + 5}" text-anchor="end" font-size="11" fill="#666">1.0</text>
  <text x="${margin.left - 10}" y="${midY + 4}" text-anchor="end" font-size="11" fill="#666">0.0</text>
  <text x="${margin.left - 10}" y="${margin.top + plotH + 5}" text-anchor="end" font-size="11" fill="#666">-1.0</text>
  <line x1="${width - margin.right - 100}" y1="${margin.top + 15}" x2="${width - margin.right - 70}" y2="${margin.top + 15}" stroke="#3b82f6" stroke-width="2.5"/>
  <text x="${width - margin.right - 65}" y="${margin.top + 19}" font-size="12" fill="#333">cos(x)</text>
</svg>`;
})();
