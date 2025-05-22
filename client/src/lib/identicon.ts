// Identicon generation utility

export function generateIdenticon(canvas: HTMLCanvasElement, value: string, size: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Generate hash from value
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use hash to generate colors and pattern
  const hue = Math.abs(hash) % 360;
  const saturation = 50 + (Math.abs(hash >> 8) % 30);
  const lightness = 40 + (Math.abs(hash >> 16) % 20);
  
  const bgColor = `hsl(${hue}, ${saturation}%, ${lightness + 30}%)`;
  const fgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Generate pattern grid (5x5)
  const gridSize = 5;
  const cellSize = size / gridSize;
  
  ctx.fillStyle = fgColor;
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      // Use hash bits to determine if cell should be filled
      const bitIndex = (y * gridSize + x) % 32;
      const shouldFill = (Math.abs(hash) >> bitIndex) & 1;
      
      if (shouldFill) {
        // Create symmetrical pattern
        const mirrorX = gridSize - 1 - x;
        
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        if (x !== mirrorX) {
          ctx.fillRect(mirrorX * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }
}
