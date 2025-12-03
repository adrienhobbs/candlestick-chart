import { useRef, useState, useEffect, ReactNode } from 'react';

interface ResizableIndicatorPaneProps {
  indicatorName: string;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
  children: ReactNode;
}

export function ResizableIndicatorPane({
  indicatorName,
  initialHeight = 200,
  minHeight = 100,
  maxHeight = 600,
  onHeightChange,
  children,
}: ResizableIndicatorPaneProps) {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = e.clientY - startYRef.current;
      const newHeight = Math.min(
        Math.max(startHeightRef.current + deltaY, minHeight),
        maxHeight
      );

      setHeight(newHeight);
      if (onHeightChange) {
        onHeightChange(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minHeight, maxHeight, onHeightChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  return (
    <div ref={containerRef} className="w-full border-t border-slate-700">
      <div className="flex items-center justify-between px-2 py-1 bg-slate-800/50">
        <div className="text-xs text-slate-400">{indicatorName}</div>
        <div
          className={`text-xs text-slate-500 hover:text-slate-300 cursor-ns-resize px-2 py-1 transition-colors ${
            isResizing ? 'text-blue-400' : ''
          }`}
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          ⋮⋮⋮
        </div>
      </div>
      <div style={{ height: `${height}px`, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}
