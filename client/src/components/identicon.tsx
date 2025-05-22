import { useEffect, useRef } from "react";
import { generateIdenticon } from "@/lib/identicon";

interface IdenticonProps {
  value: string;
  size: number;
  className?: string;
}

export function Identicon({ value, size, className }: IdenticonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      generateIdenticon(canvasRef.current, value, size);
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
