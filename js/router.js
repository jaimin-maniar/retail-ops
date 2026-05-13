/* Hash route handling. */

// hash navigation
{
const routeHandlers = {};
  let currentRoute = null;

  function hasAccess(route, user) {
    return Boolean(user && route.roles.includes(user.Role));
  }

  function getRouteByHash(hash) {
    return app.setup.routes.find((route) => route.path === hash) || app.setup.routes[0];
  }

  function render() {
    const user = app.data.getUser();

    if (!user) {
      app.screens.renderLogin();
      return;
    }

    let route = getRouteByHash(window.location.hash || "#/dashboard");
    if (!hasAccess(route, user)) {
      route = app.setup.routes.find((item) => hasAccess(item, user)) || app.setup.routes[0];
      window.location.hash = route.path;
      return;
    }

    currentRoute = route;
    app.screens.renderShell(route);
    const outlet = document.querySelector("[data-route-outlet]");
    const handler = routeHandlers[route.id];

    if (outlet && handler) {
      handler(outlet);
    }
  }

  app.nav = {
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
      app.data.subscribe(() => {
        if (app.data.isLoaded()) {
          render();
        }
      });
      if (!window.location.hash) {
        window.location.hash = "#/dashboard";
      }
      render();
    }
  };
}



