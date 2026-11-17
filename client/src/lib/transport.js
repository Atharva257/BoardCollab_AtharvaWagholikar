// Decouples the Redux thunks from the socket lifecycle.
let current = null;

export const transport = {
  attach(outbox) {
    current = outbox;
  },
  detach(outbox) {
    if (current === outbox) current = null;
  },
  send(ops) {
    if (current) current.push(ops);
  },
  cursor(x, y) {
    if (current) current.cursor(x, y);
  },
};
