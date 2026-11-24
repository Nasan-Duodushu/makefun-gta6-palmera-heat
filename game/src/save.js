// One save slot in localStorage: cash, story progress and where the player stood.
// Storage can be unavailable (private windows); every call here fails soft so the
// game simply runs unsaved rather than breaking.
window.PH = window.PH || {};

PH.saveGame = function saveGame(data) {
  try {
    window.localStorage.setItem(PH.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
};

PH.loadGame = function loadGame() {
  try {
    const raw = window.localStorage.getItem(PH.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch { return null; }
};

PH.clearSave = function clearSave() {
  try { window.localStorage.removeItem(PH.SAVE_KEY); } catch { /* nothing to clear */ }
};
