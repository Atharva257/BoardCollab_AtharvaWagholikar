import { useEffect, useRef } from 'react';
import { FONT } from './Item';

export default function TextEditor({ left, top, fontSize, color, initial, onCommit, onCancel }) {
  const ref = useRef(null);
  const done = useRef(false);

  const fit = () => {
    const el = ref.current;
    el.style.width = '0px';
    el.style.height = '0px';
    el.style.width = `${Math.max(120, el.scrollWidth + 4)}px`;
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    fit();
  }, []);

  const finish = (fn) => {
    if (done.current) return;
    done.current = true;
    fn(ref.current.value);
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      defaultValue={initial}
      wrap="off"
      style={{ left, top, fontSize, color, fontFamily: FONT }}
      onInput={fit}
      onBlur={() => finish(onCommit)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(() => onCancel());
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          finish(onCommit);
        }
      }}
    />
  );
}
