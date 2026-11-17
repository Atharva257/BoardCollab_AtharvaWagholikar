import { useSelector } from 'react-redux';
import { colorForUser } from '../lib/palette';

const MAX = 5;

export default function UserList() {
  const users = useSelector((s) => s.presence.users);
  const me = useSelector((s) => s.auth.user);
  const list = users.length ? users : me ? [{ userId: me.id, username: me.username }] : [];
  const shown = list.slice(0, MAX);

  return (
    <div className="users" aria-label={`${list.length} in this room`}>
      <span className="users-count">{list.length} online</span>
      <ul>
        {shown.map((u) => (
          <li key={u.userId} className="avatar" style={{ background: colorForUser(u.userId) }}
            title={u.userId === me?.id ? `${u.username} (you)` : u.username}>
            {u.username.slice(0, 1).toUpperCase()}
          </li>
        ))}
        {list.length > MAX && <li className="avatar avatar--more">+{list.length - MAX}</li>}
      </ul>
    </div>
  );
}
