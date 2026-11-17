import { memo } from 'react';
import { Ellipse, Line, Rect, Text } from 'react-konva';

export const FONT = '"Helvetica Neue", Arial, sans-serif';

// memo + Immer structural sharing: an element only re-renders when its own data changes.
function Item({ el, interactive, onSelect, onDragStart, onDragMove, onDragEnd, onEditText }) {
  const d = el.data;
  const stroke = d.stroke || '#1d2126';
  const strokeWidth = d.strokeWidth || 2;
  const common = {
    x: d.x || 0,
    y: d.y || 0,
    listening: interactive,
    draggable: interactive,
    onPointerDown: interactive ? () => onSelect(el.id) : undefined,
    onDragStart: () => onDragStart(el),
    onDragMove: (e) => onDragMove(el, e),
    onDragEnd: (e) => onDragEnd(el, e),
    perfectDrawEnabled: false,
  };
  const outline = { stroke, strokeWidth, fill: 'rgba(0,0,0,0)' }; // transparent fill keeps the interior hit-testable

  switch (el.type) {
    case 'stroke':
      return (
        <Line {...common} points={d.points || []} stroke={stroke} strokeWidth={strokeWidth}
          lineCap="round" lineJoin="round" hitStrokeWidth={Math.max(14, strokeWidth)} />
      );
    case 'rect':
      return <Rect {...common} {...outline} width={d.w || 0} height={d.h || 0} />;
    case 'circle':
      return <Ellipse {...common} {...outline} radiusX={d.rx || 0} radiusY={d.ry || 0} />;
    case 'text':
      return (
        <Text {...common} text={d.text || ''} fontSize={d.fontSize || 20} lineHeight={1.25}
          fontFamily={FONT} fill={d.fill || stroke}
          onDblClick={() => onEditText(el)} onDblTap={() => onEditText(el)} />
      );
    default:
      return null;
  }
}

export default memo(Item);
