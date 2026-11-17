import { useSelector } from 'react-redux';

const LABELS = {
  online: 'Connected',
  connecting: 'Connecting',
  degraded: 'Unstable connection',
  offline: 'Offline, changes kept locally',
};

export default function ConnectionBadge() {
  const status = useSelector((s) => s.presence.connection);
  return (
    <span className={`badge badge--${status}`} role="status">
      <span className="badge-dot" />
      {LABELS[status]}
    </span>
  );
}
