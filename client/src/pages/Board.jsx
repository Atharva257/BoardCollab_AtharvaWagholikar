import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { api } from '../api/client';
import CanvasBoard from '../components/CanvasBoard';
import ConnectionBadge from '../components/ConnectionBadge';
import Toolbar from '../components/Toolbar';
import UserList from '../components/UserList';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useShortcuts } from '../hooks/useShortcuts';
import { exportPng, exportSvg } from '../lib/export';
import { addRecent } from '../lib/recent';
import { hydrate, loadSnapshot, resetCanvas, selectVisible } from '../store/canvasSlice';
import { logout } from '../store/authSlice';
import { resetPresence } from '../store/presenceSlice';

const cacheKey = (id) => `bc_room_${id}`;

function readCache(id) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(id)));
  } catch {
    return null;
  }
}

export default function Board() {
  const { roomId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const store = useStore();
  const token = useSelector((s) => s.auth.token);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null); // { status, message }
  const [attempt, setAttempt] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const metaRef = useRef(null);
  const joinCodeShown = location.state?.joinCode;

  useShortcuts();
  useRoomSocket(roomId);

  // Initial load: paint from the local cache immediately, then merge the server state.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    dispatch(resetCanvas());
    dispatch(resetPresence());
    const cached = readCache(roomId);
    if (cached) dispatch(hydrate(cached));

    api(`/api/rooms/${roomId}`, { token })
      .then((data) => {
        if (cancelled) return;
        metaRef.current = data;
        setMeta(data);
        addRecent({ roomId, name: data.name });
        dispatch(loadSnapshot({ elements: data.elements, lamport: data.lamport }));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) return dispatch(logout());
        if (err.status) return setError({ status: err.status, message: err.message });
        if (cached) {
          const offlineMeta = { roomId, name: cached.name || roomId };
          metaRef.current = offlineMeta;
          setMeta(offlineMeta); // server unreachable: keep working from the local copy
        } else {
          setError({ message: 'Could not reach the server.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, token, attempt, dispatch]);

  // Local fallback copy (debounced) so a reload while offline still shows the board.
  useEffect(() => {
    let timer;
    const unsub = store.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { byId, order, lamport } = store.getState().canvas;
        try {
          localStorage.setItem(cacheKey(roomId), JSON.stringify({ byId, order, lamport, name: metaRef.current?.name }));
        } catch {
          /* quota exceeded: skip */
        }
      }, 1000);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [roomId, store]);

  const exportAs = (kind) => {
    const els = selectVisible(store.getState());
    const name = (meta?.name || 'board').replace(/[^\w-]+/g, '_');
    const fn = kind === 'png' ? exportPng : exportSvg;
    Promise.resolve(fn(els, name)).then((ok) => ok === false && window.alert('The canvas is empty.'));
  };

  const joinPrivate = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/rooms/${roomId}/join`, { method: 'POST', token, body: { joinCode: joinCode.trim() } });
      setAttempt((n) => n + 1);
    } catch (err) {
      setError({ status: err.status, message: err.message });
    }
  };

  if (error) {
    return (
      <main className="auth">
        <div className="panel auth-panel">
          <h2 className="panel-title">{error.status === 403 ? 'Private board' : 'Cannot open this board'}</h2>
          <p className="muted">{error.message}</p>
          {error.status === 403 && (
            <form onSubmit={joinPrivate} className="stack">
              <label className="field">
                <span>Join code</span>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} autoComplete="off" required />
              </label>
              <button className="btn btn--primary">Join</button>
            </form>
          )}
          <Link className="link-btn" to="/">Back to boards</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="board">
      <header className="board-header">
        <Link to="/" className="icon-btn" aria-label="Back to boards" title="Back to boards"><ArrowLeft size={18} /></Link>
        <h1 className="board-title">{meta?.name || 'Loading'}</h1>
        {meta?.visibility && <span className="tag">{meta.visibility}</span>}
        <ConnectionBadge />
        <div className="board-header-end">
          {joinCodeShown && (
            <button className="btn btn--quiet" title="Copy join code" onClick={() => navigator.clipboard?.writeText(joinCodeShown)}>
              Join code <span className="mono">{joinCodeShown}</span>
            </button>
          )}
          <button className="btn btn--quiet" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy link</button>
          <button className="btn btn--quiet" onClick={() => exportAs('png')}>PNG</button>
          <button className="btn btn--quiet" onClick={() => exportAs('svg')}>SVG</button>
          <UserList />
        </div>
      </header>
      <div className="board-body">
        <Toolbar />
        <CanvasBoard />
      </div>
    </div>
  );
}
