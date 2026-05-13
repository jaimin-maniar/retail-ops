/* App roles, routes, and fixed lists. */

// basic setup
{
const roles = {
    Admin: "Admin",
    InventoryManager: "InventoryManager",
    StoreManager: "StoreManager",
    Cashier: "Cashier"
  };

  const allOpsRoles = [roles.Admin, roles.InventoryManager, roles.StoreManager];
  const storeRoles = [roles.Admin, roles.StoreManager];
  const sellRoles = [roles.Admin, roles.StoreManager, roles.Cashier];

  app.setup = {
    appName: "RetailOps",
    storagePrefix: "retailops.web",
    taxRate: 0.05,
    roles,
    dataFiles: {
      products: true,
      skus: true,
      inventory: true,
      promotions: true,
      replenishment: true,
      forecast: true,
      suppliers: true,
      warehouses: true,
      activityLogs: true,
      orders: true,
      users: true,
      settings: true
    },
    routes: [
      { id: "dashboard", path: "#/dashboard", title: "Dashboard", subtitle: "Quick view of stock, sales, alerts, and promotions.", icon: "D", section: "Main", roles: Object.values(roles) },
      { id: "products", path: "#/products", title: "Products", subtitle: "Add and update product details.", icon: "P", section: "Data", roles: allOpsRoles },
      { id: "skus", path: "#/skus", title: "SKUs", subtitle: "Maintain SKU packaging and barcode details.", icon: "S", section: "Data", roles: allOpsRoles },
      { id: "inventory", path: "#/inventory", title: "Inventory", subtitle: "Check stock and make stock adjustments.", icon: "I", section: "Work", roles: allOpsRoles },
      { id: "replenishment", path: "#/replenishment", title: "Replenishment", subtitle: "See low stock suggestions and approvals.", icon: "R", section: "Work", roles: allOpsRoles },
      { id: "promotions", path: "#/promotions", title: "Promotions", subtitle: "Create discounts and test which one applies.", icon: "%", section: "Sales", roles: storeRoles },
      { id: "forecast", path: "#/forecast", title: "Forecast", subtitle: "Estimate demand and stock risk.", icon: "F", section: "Work", roles: allOpsRoles },
      { id: "reports", path: "#/reports", title: "Reports", subtitle: "Generate sales, stock, and promotion reports.", icon: "B", section: "Reports", roles: allOpsRoles },
      { id: "billing", path: "#/billing", title: "Billing", subtitle: "Create an order and deduct stock.", icon: "$", section: "Sales", roles: sellRoles },
      { id: "settings", path: "#/settings", title: "Settings", subtitle: "Change local settings and reset saved data.", icon: "G", section: "Admin", roles: [roles.Admin] },
      { id: "logs", path: "#/logs", title: "Logs", subtitle: "View login, product, inventory, promotion, and billing activity.", icon: "L", section: "Admin", roles: [roles.Admin] }
    ],
    promotionTypes: [
      { value: "Percentage", label: "Percentage" },
      { value: "FlatDiscount", label: "Flat Discount" },
      { value: "BuyOneGetOne", label: "Buy One Get One" },
      { value: "ComboOffer", label: "Combo Offer" }
    ]
  };
}



