import { Circle, Hand, MousePointer2, Pencil, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { clearAll, redo, undo } from '../store/canvasSlice';
import { setColor, setStrokeWidth, setTool } from '../store/uiSlice';
import { INK_COLORS } from '../lib/palette';

const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', Icon: MousePointer2 },
  { id: 'pen', label: 'Pen', key: 'P', Icon: Pencil },
  { id: 'rect', label: 'Rectangle', key: 'R', Icon: Square },
  { id: 'circle', label: 'Ellipse', key: 'O', Icon: Circle },
  { id: 'text', label: 'Text', key: 'T', Icon: Type },
  { id: 'hand', label: 'Pan', key: 'H', Icon: Hand },
];
const WIDTHS = [2, 4, 8];

export default function Toolbar() {
  const dispatch = useDispatch();
  const { tool, color, strokeWidth } = useSelector((s) => s.ui);
  const canUndo = useSelector((s) => s.canvas.undo.length > 0);
  const canRedo = useSelector((s) => s.canvas.redo.length > 0);

  return (
    <nav className="toolbar" aria-label="Drawing tools">
      <div className="tool-group">
        {TOOLS.map(({ id, label, key, Icon }) => (
          <button key={id} className={`icon-btn${tool === id ? ' is-active' : ''}`} title={`${label} (${key})`}
            aria-label={label} aria-pressed={tool === id} onClick={() => dispatch(setTool(id))}>
            <Icon size={18} />
          </button>
        ))}
      </div>
      <div className="tool-group">
        {INK_COLORS.map((c) => (
          <button key={c} className={`swatch${color === c ? ' is-active' : ''}`} style={{ background: c }}
            aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => dispatch(setColor(c))} />
        ))}
      </div>
      <div className="tool-group">
        {WIDTHS.map((w) => (
          <button key={w} className={`icon-btn${strokeWidth === w ? ' is-active' : ''}`} title={`${w}px`}
            aria-label={`Stroke ${w}px`} aria-pressed={strokeWidth === w} onClick={() => dispatch(setStrokeWidth(w))}>
            <span className="width-preview" style={{ height: w }} />
          </button>
        ))}
      </div>
      <div className="tool-group tool-group--end">
        <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => dispatch(undo())}><Undo2 size={18} /></button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={() => dispatch(redo())}><Redo2 size={18} /></button>
        <button className="icon-btn" title="Clear canvas" aria-label="Clear canvas"
          onClick={() => window.confirm('Clear the whole canvas for everyone in this room? You can undo this.') && dispatch(clearAll())}>
          <Trash2 size={18} />
        </button>
      </div>
    </nav>
  );
}
