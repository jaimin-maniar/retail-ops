(function (app) {
  const routeHandlers = {};
  let currentRoute = null;

  function hasAccess(route, user) {
    return Boolean(user && route.roles.includes(user.Role));
  }

  function getRouteByHash(hash) {
    return app.config.routes.find((route) => route.path === hash) || app.config.routes[0];
  }

  function render() {
    const user = app.store.getUser();

    if (!user) {
      app.layout.renderLogin();
      return;
    }

    let route = getRouteByHash(window.location.hash || "#/dashboard");
    if (!hasAccess(route, user)) {
      route = app.config.routes.find((item) => hasAccess(item, user)) || app.config.routes[0];
      window.location.hash = route.path;
      return;
    }

    currentRoute = route;
    app.layout.renderShell(route);
    const outlet = document.querySelector("[data-route-outlet]");
    const handler = routeHandlers[route.id];

    if (outlet && handler) {
      handler(outlet);
    }
  }

  app.router = {
    register(id, handler) {
      routeHandlers[id] = handler;
    },

    navigate(path) {
      window.location.hash = path;
    },

    current() {
      return currentRoute;
    },

    hasAccess,

    start() {
      window.addEventListener("hashchange", render);
      app.store.subscribe(() => {
        if (app.store.isLoaded()) {
          render();
        }
      });
      if (!window.location.hash) {
        window.location.hash = "#/dashboard";
      }
      render();
    }
  };
})(window.RetailOps = window.RetailOps || {});
