// Saving to localStorage: mission progress, cash, position, weapons, packages
// and lifetime stats. Autosaves after every mission; the safehouse saves on
// demand. Loading applies the save to a freshly built world.

const SAVE_KEY = 'solmarina-save-v1';

export function createSave() {
  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  return {
    hasSave() {
      return readSave() !== null;
    },
    saveGame(G) {
      try {
        const data = {
          version: 1,
          missionNext: G.mission.next,
          missionDone: G.mission.done,
          allDone: G.mission.allDone,
          cash: Math.floor(G.player.cash),
          hp: Math.round(G.player.hp),
          armor: Math.round(G.player.armor),
          x: Math.round(G.player.x),
          y: Math.round(G.player.y),
          weaponsOwned: G.player.weaponsOwned,
          ammo: G.player.ammo,
          packagesTaken: G.activities.packages.map((p) => p.taken),
          stats: G.stats,
          muted: G.audio.isMuted(),
          savedAt: Date.now(),
        };
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },
    loadGame(G) {
      const data = readSave();
      if (!data) return false;
      G.mission.next = data.missionNext ?? 0;
      G.mission.done = data.missionDone ?? [];
      G.mission.allDone = data.allDone ?? false;
      G.player.cash = data.cash ?? 120;
      G.player.hp = data.hp ?? 100;
      G.player.armor = data.armor ?? 0;
      G.player.x = data.x ?? 1000;
      G.player.y = data.y ?? 1000;
      G.player.weaponsOwned = data.weaponsOwned ?? ['fists', 'pistol'];
      G.player.ammo = data.ammo ?? { smg: 0, shotgun: 0 };
      if (Array.isArray(data.packagesTaken)) {
        data.packagesTaken.forEach((taken, i) => {
          if (G.activities.packages[i]) G.activities.packages[i].taken = taken;
        });
        G.activities.packagesFound = G.activities.packages.filter((p) => p.taken).length;
      }
      if (data.stats) Object.assign(G.stats, data.stats);
      if (data.muted) G.audio.setMuted(true);
      return true;
    },
    clearSave() {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Storage unavailable: nothing to clear.
      }
    },
  };
}
