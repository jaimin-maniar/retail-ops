/* Browser localStorage and sessionStorage data access. */

// local data storage
{
const listeners = new Set();
  const state = {
    collections: {},
    currentUser: null,
    isLoaded: false
  };

  const storageKey = (name) => `${app.setup.storagePrefix}.${name}`;

  async function loadSavedData(name) {
    const saved = localStorage.getItem(storageKey(name));
    if (saved) {
      return JSON.parse(saved);
    }
    return app.help.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
  }

  function persist(name) {
    localStorage.setItem(storageKey(name), JSON.stringify(state.collections[name]));
  }

  function notify() {
    listeners.forEach((listener) => listener(app.help.clone(state.collections)));
  }

  app.data = {
    async load() {
      const entries = Object.keys(app.setup.dataFiles);
      for (let i = 0; i < entries.length; i += 1) {
        const name = entries[i];
        state.collections[name] = await loadSavedData(name);
      }

      const savedUser = sessionStorage.getItem(`${app.setup.storagePrefix}.sessionUser`);
      state.currentUser = savedUser ? JSON.parse(savedUser) : null;
      state.isLoaded = true;
      notify();
    },

    isLoaded() {
      return state.isLoaded;
    },

    get(name) {
      return app.help.clone(state.collections[name] || (name === "settings" ? {} : []));
    },

    set(name, value, options) {
      state.collections[name] = app.help.clone(value);
      if (!options || options.persist !== false) {
        persist(name);
      }
      notify();
    },

    update(name, updater) {
      const next = updater(app.help.clone(state.collections[name] || []));
      state.collections[name] = next;
      persist(name);
      notify();
      return app.help.clone(next);
    },

    getUser() {
      return state.currentUser ? app.help.clone(state.currentUser) : null;
    },

    setUser(user) {
      state.currentUser = user ? app.help.clone(user) : null;
      if (state.currentUser) {
        sessionStorage.setItem(`${app.setup.storagePrefix}.sessionUser`, JSON.stringify(state.currentUser));
      } else {
        sessionStorage.removeItem(`${app.setup.storagePrefix}.sessionUser`);
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    resetLocalData() {
      Object.keys(app.setup.dataFiles).forEach((name) => {
        localStorage.removeItem(storageKey(name));
        state.collections[name] = app.help.clone((window.RetailOpsSeedData || {})[name] || (name === "settings" ? {} : []));
      });
      notify();
    }
  };
}



