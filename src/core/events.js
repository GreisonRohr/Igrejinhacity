// Barramento de eventos simples: sistemas avisam o que aconteceu sem se conhecerem.
const handlers = new Map();
export const events = {
  on(name, fn) { (handlers.get(name) || handlers.set(name, []).get(name)).push(fn); return () => events.off(name, fn); },
  off(name, fn) { const a = handlers.get(name); if (a) a.splice(a.indexOf(fn) >>> 0, 1); },
  emit(name, data) { for (const fn of handlers.get(name) || []) fn(data); },
};
