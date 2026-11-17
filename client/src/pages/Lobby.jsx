import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api/client';
import { logout } from '../store/authSlice';
import { getRecent } from '../lib/recent';

export default function Lobby() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, user } = useSelector((s) => s.auth);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [roomRef, setRoomRef] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recent = getRecent();

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if (err.status === 401) dispatch(logout());
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const room = await api('/api/rooms', { method: 'POST', token, body: { name, visibility } });
      navigate(`/r/${room.roomId}`, { state: { joinCode: room.joinCode } });
    });
  };

  const open = (e) => {
    e.preventDefault();
    run(async () => {
      const id = roomRef.trim().split('/').filter(Boolean).pop(); // accepts a pasted link or a bare id
      if (joinCode.trim()) await api(`/api/rooms/${id}/join`, { method: 'POST', token, body: { joinCode: joinCode.trim() } });
      navigate(`/r/${id}`);
    });
  };

  return (
    <div className="page">
      <header className="topbar">
        <span className="wordmark">BoardCollab</span>
        <div className="topbar-end">
          <span className="muted">{user?.username}</span>
          <button className="btn btn--quiet" onClick={() => dispatch(logout())}>Sign out</button>
        </div>
      </header>
      <main className="lobby">
        <form className="panel" onSubmit={create}>
          <h2 className="panel-title">New board</h2>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <label className="field">
            <span>Access</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="public">Public: anyone signed in with the link</option>
              <option value="private">Private: requires a join code</option>
            </select>
          </label>
          <button className="btn btn--primary" disabled={busy}>Create board</button>
        </form>

        <form className="panel" onSubmit={open}>
          <h2 className="panel-title">Open a board</h2>
          <label className="field">
            <span>Room ID or link</span>
            <input value={roomRef} onChange={(e) => setRoomRef(e.target.value)} required />
          </label>
          <label className="field">
            <span>Join code <em>(private boards only)</em></span>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn" disabled={busy}>Open</button>
        </form>

        {error && <p className="form-error lobby-error" role="alert">{error}</p>}

        {recent.length > 0 && (
          <section className="panel lobby-recent">
            <h2 className="panel-title">Recent</h2>
            <ul className="recent">
              {recent.map((r) => (
                <li key={r.roomId}>
                  <button className="recent-row" onClick={() => navigate(`/r/${r.roomId}`)}>
                    <span>{r.name}</span>
                    <span className="muted mono">{r.roomId}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
