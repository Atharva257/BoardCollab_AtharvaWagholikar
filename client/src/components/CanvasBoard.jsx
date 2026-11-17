import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { Minus, Plus } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import Item from './Item';
import TextEditor from './TextEditor';
import { commit, recordHistory, selectVisible } from '../store/canvasSlice';
import { select } from '../store/uiSlice';
import { getBounds, intersects } from '../lib/geometry';
import { transport } from '../lib/transport';
import { colorForUser } from '../lib/palette';
import { isTyping } from '../lib/dom';
import { uid } from '../lib/ids';

const ACCENT = '#1f4e79';
const FONT_SIZE = 20;
const MOVE_THROTTLE_MS = 16;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const CURSORS = { pen: 'crosshair', rect: 'crosshair', circle: 'crosshair', text: 'text', hand: 'grab', select: 'default' };

const shapeProps = (type, a, b, style) => {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return type === 'rect'
    ? { x: x1, y: y1, w, h, ...style }
    : { x: x1 + w / 2, y: y1 + h / 2, rx: w / 2, ry: h / 2, ...style };
};

export default function CanvasBoard() {
  const dispatch = useDispatch();
  const wrapRef = useRef(null);
  const gesture = useRef(null);
  const spaceDown = useRef(false);
  const dragOrigin = useRef(null);
  const lastDrag = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [editing, setEditing] = useState(null);

  const tool = useSelector((s) => s.ui.tool);
  const color = useSelector((s) => s.ui.color);
  const strokeWidth = useSelector((s) => s.ui.strokeWidth);
  const selected = useSelector((s) => (s.ui.selectedId ? s.canvas.byId[s.ui.selectedId] : null));
  const elements = useSelector(selectVisible);
  const cursors = useSelector((s) => s.presence.cursors);
  const selfId = useSelector((s) => s.auth.user?.id);

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !isTyping(e)) {
        spaceDown.current = true;
        e.preventDefault();
      }
    };
    const up = (e) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Virtualization: only elements intersecting the (padded) viewport reach Konva.
  const viewport = useMemo(() => {
    const m = 120 / view.scale;
    return {
      x1: -view.x / view.scale - m,
      y1: -view.y / view.scale - m,
      x2: (size.w - view.x) / view.scale + m,
      y2: (size.h - view.y) / view.scale + m,
    };
  }, [view, size]);
  const items = useMemo(() => elements.filter((el) => intersects(getBounds(el), viewport)), [elements, viewport]);

  const toCanvas = (stage) => {
    const p = stage.getPointerPosition();
    return p ? { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale } : null;
  };

  const finish = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'stroke') {
      dispatch(commit([{ id: g.id, type: 'stroke', props: { points: g.pts.slice() } }]));
      dispatch(recordHistory({ items: [{ id: g.id, type: 'stroke', undo: { deleted: true }, redo: { deleted: false } }] }));
    } else if (g.kind === 'shape') {
      const tiny = (g.props.w ?? g.props.rx * 2) < 3 && (g.props.h ?? g.props.ry * 2) < 3;
      if (tiny) {
        dispatch(commit([{ id: g.id, type: g.type, props: { deleted: true } }]));
      } else {
        dispatch(commit([{ id: g.id, type: g.type, props: g.props }]));
        dispatch(recordHistory({ items: [{ id: g.id, type: g.type, undo: { deleted: true }, redo: { deleted: false } }] }));
      }
    } else if (g.kind === 'text') {
      // Deferred so the browser's mousedown focus handling cannot blur the editor immediately.
      setTimeout(() => setEditing({ id: uid(), x: g.p.x, y: g.p.y, text: '', isNew: true, color: g.color }), 0);
    }
  }, [dispatch]);

  useEffect(() => {
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [finish]);

  const onPointerDown = (e) => {
    const evt = e.evt;
    if (evt.button === 2) return;
    const stage = e.target.getStage();
    const p = toCanvas(stage);
    if (!p) return;

    if (tool === 'hand' || evt.button === 1 || spaceDown.current) {
      gesture.current = { kind: 'pan', sx: evt.clientX, sy: evt.clientY, vx: view.x, vy: view.y };
      return;
    }
    if (tool === 'select') {
      if (e.target === stage) dispatch(select(null));
      return;
    }
    if (tool === 'pen') {
      const id = uid();
      gesture.current = { kind: 'stroke', id, pts: [p.x, p.y, p.x, p.y], t: 0 };
      dispatch(commit([{ id, type: 'stroke', props: { x: 0, y: 0, points: [p.x, p.y, p.x, p.y], stroke: color, strokeWidth } }]));
    } else if (tool === 'rect' || tool === 'circle') {
      const id = uid();
      const style = { stroke: color, strokeWidth };
      const props = shapeProps(tool, p, p, style);
      gesture.current = { kind: 'shape', id, type: tool, a: p, style, props, t: 0 };
      dispatch(commit([{ id, type: tool, props }]));
    } else if (tool === 'text') {
      gesture.current = { kind: 'text', p, color };
    }
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (g?.kind === 'pan') {
      setView((v) => ({ ...v, x: g.vx + e.evt.clientX - g.sx, y: g.vy + e.evt.clientY - g.sy }));
      return;
    }
    const p = toCanvas(e.target.getStage());
    if (!p) return;
    transport.cursor(p.x, p.y);
    if (!g) return;

    const now = performance.now();
    if (g.kind === 'stroke') {
      const n = g.pts.length;
      const dx = p.x - g.pts[n - 2];
      const dy = p.y - g.pts[n - 1];
      if (dx * dx + dy * dy < (1.5 / view.scale) ** 2) return;
      g.pts.push(p.x, p.y);
      if (now - g.t >= MOVE_THROTTLE_MS) {
        g.t = now;
        dispatch(commit([{ id: g.id, type: 'stroke', props: { points: g.pts.slice() } }]));
      }
    } else if (g.kind === 'shape') {
      g.props = shapeProps(g.type, g.a, p, g.style);
      if (now - g.t >= MOVE_THROTTLE_MS) {
        g.t = now;
        dispatch(commit([{ id: g.id, type: g.type, props: g.props }]));
      }
    }
  };

  const zoomTo = (next, cx = size.w / 2, cy = size.h / 2) =>
    setView((v) => {
      const s = clamp(next, 0.1, 8);
      const mx = (cx - v.x) / v.scale;
      const my = (cy - v.y) / v.scale;
      return { scale: s, x: cx - mx * s, y: cy - my * s };
    });

  const onWheel = (e) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = e.target.getStage().getPointerPosition();
      zoomTo(view.scale * Math.exp(-e.evt.deltaY * 0.01), p.x, p.y);
    } else {
      setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
    }
  };

  // Stable handlers keep memoized <Item/>s from re-rendering.
  const onSelect = useCallback((id) => dispatch(select(id)), [dispatch]);
  const onDragStart = useCallback((el) => {
    dragOrigin.current = { id: el.id, x: el.data.x || 0, y: el.data.y || 0 };
  }, []);
  const onDragMove = useCallback(
    (el, e) => {
      const now = performance.now();
      if (now - lastDrag.current < 30) return;
      lastDrag.current = now;
      const { x, y } = e.target.position();
      dispatch(commit([{ id: el.id, type: el.type, props: { x, y } }]));
    },
    [dispatch]
  );
  const onDragEnd = useCallback(
    (el, e) => {
      const o = dragOrigin.current;
      const { x: nx, y: ny } = e.target.position();
      // Always send the final position, even when the last throttled move was skipped.
      dispatch(commit([{ id: el.id, type: el.type, props: { x: nx, y: ny } }]));
      if (o && (o.x !== nx || o.y !== ny)) {
        dispatch(recordHistory({ items: [{ id: el.id, type: el.type, undo: { x: o.x, y: o.y }, redo: { x: nx, y: ny } }] }));
      }
      dragOrigin.current = null;
    },
    [dispatch]
  );
  const onEditText = useCallback(
    (el) => setEditing({ id: el.id, x: el.data.x || 0, y: el.data.y || 0, text: el.data.text || '', isNew: false, fontSize: el.data.fontSize, color: el.data.fill || el.data.stroke }),
    []
  );

  const commitText = (raw) => {
    const ed = editing;
    setEditing(null);
    if (!ed) return;
    const text = raw.replace(/\s+$/, '');
    if (ed.isNew) {
      if (!text) return;
      dispatch(commit([{ id: ed.id, type: 'text', props: { x: ed.x, y: ed.y, text, fontSize: FONT_SIZE, fill: ed.color } }], { record: true }));
    } else if (text !== ed.text) {
      const props = text ? { text } : { deleted: true };
      dispatch(commit([{ id: ed.id, type: 'text', props }], { record: true }));
    }
  };

  const sel = selected && !selected.deleted ? getBounds(selected) : null;

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ cursor: spaceDown.current ? 'grab' : CURSORS[tool] }}>
      {size.w > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onWheel={onWheel}
        >
          <Layer>
            {items.map((el) => (
              <Item key={el.id} el={el} interactive={tool === 'select'} onSelect={onSelect}
                onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onEditText={onEditText} />
            ))}
          </Layer>
          <Layer listening={false}>
            {sel && (
              <Rect x={sel.x1 - 4} y={sel.y1 - 4} width={sel.x2 - sel.x1 + 8} height={sel.y2 - sel.y1 + 8}
                stroke={ACCENT} strokeWidth={1} dash={[5, 4]} strokeScaleEnabled={false} />
            )}
            {Object.entries(cursors)
              .filter(([id]) => id !== selfId)
              .map(([id, c]) => {
                const col = colorForUser(id);
                const w = c.username.length * 6.4 + 12;
                return (
                  <Group key={id} x={c.x} y={c.y} scaleX={1 / view.scale} scaleY={1 / view.scale}>
                    <Line points={[0, 0, 0, 16, 4.5, 12, 8, 19, 10.5, 17.8, 7, 11, 12.5, 11]} closed fill={col} stroke="#fff" strokeWidth={1} />
                    <Rect x={14} y={14} width={w} height={18} fill={col} cornerRadius={2} />
                    <Text x={20} y={17} text={c.username} fontSize={11} fill="#fff" />
                  </Group>
                );
              })}
          </Layer>
        </Stage>
      )}
      {editing && (
        <TextEditor
          left={view.x + editing.x * view.scale}
          top={view.y + editing.y * view.scale}
          fontSize={(editing.fontSize || FONT_SIZE) * view.scale}
          color={editing.color}
          initial={editing.text}
          onCommit={commitText}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="zoom">
        <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomTo(view.scale / 1.25)}><Minus size={16} /></button>
        <button className="zoom-value" aria-label="Reset zoom" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>
          {Math.round(view.scale * 100)}%
        </button>
        <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomTo(view.scale * 1.25)}><Plus size={16} /></button>
      </div>
    </div>
  );
}
