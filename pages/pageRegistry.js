(function (app) {
  app.pageRegistry = {
    registerAll() {
      Object.entries(app.pages || {}).forEach(([id, page]) => {
        app.router.register(id, page.render.bind(page));
      });
    }
  };
})(window.RetailOps = window.RetailOps || {});
