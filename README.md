# RetailOps

RetailOps is a browser-only Vanilla JavaScript demo app. It uses plain HTML, CSS, ordered JavaScript files, localStorage, and the seed data in js/data.js.

There is no framework, bundler, TypeScript, npm install, or backend.

## Page Flow

| Page | Purpose |
| --- | --- |
| index.html | Public landing page |
| landing.html | Same landing page kept as a named training file |
| signup.html | Creates frontend-only localStorage users |
| login.html | Logs in with email, password, Store ID, and dummy OTP |
| dashboard.html | Loads the existing RetailOps app after login |

## JavaScript File Guide

Script order in index.html matters because every file adds one clear part to the shared app object.

| File | What moved there | Why it is easier to explain |
| --- | --- | --- |
| app.js | Creates the shared app object | The app starts with one simple global object |
| landing.js | Landing page session button behavior | Logged-in users can jump back to the dashboard |
| login.js | Login page form handling | Reads fields, validates through auth.js, then opens dashboard.html |
| signup.js | Signup page form handling | Reads fields, creates a local account, then sends user to login.html |
| helpers.js | Small shared helpers | General helpers are no longer mixed with screens |
| validation.js | Business validation checks | Form rules can be explained separately |
| format.js | Currency, number, percent, and date formatting | Display formatting has one obvious place |
| config.js | Roles, routes, and promotion type options | App navigation setup is easy to find |
| storage.js | Browser data loading, saving, and reset | Storage behavior is isolated from UI code |
| activity.js | Activity log write/read helpers | Audit logging is separate from page rendering |
| router.js | Hash route handling and access checks | Navigation flow is short and direct |
| toast.js | Success, error, and warning messages | User feedback is easy to demo |
| popup.js | Modal and confirm dialogs | Popup behavior has its own small file |
| forms.js | Simple dynamic form builder | Add/edit forms are in one place |
| search.js | Search box UI | Table search input is separate from table rendering |
| tables.js | Searchable, sortable, paginated tables | Table behavior is isolated for reuse |
| charts.js | Small bar, donut, and sparkline charts | Charts are separate from business logic |
| layout.js | Login screen, sidebar, and page shell | The visible app frame has one file |
| ui.js | Small shared page HTML pieces | Repeated page cards/options stay together |
| auth.js | Login and logout logic | Authentication flow is short and readable |
| products.js | Product logic and Products page | Product CRUD is grouped with its screen |
| skus.js | SKU logic and SKUs page | SKU maintenance is grouped with its screen |
| inventory.js | Stock logic and Inventory page | Inventory actions are grouped with their UI |
| promotions.js | Promotion logic and Promotions page | Discount rules are grouped with promo screens |
| billing.js | Billing calculations and Billing page | Cart, totals, payment, and stock deduction stay together |
| replenishment.js | Reorder recommendations and approval page | Replenishment workflow is in one feature file |
| forecast.js | Forecast calculations and Forecast page | Forecast risk display is easy to trace |
| reports.js | Report filtering, text output, and Reports page | Report generation is grouped with its filters |
| settings.js | Settings logic and Settings page | Local settings/reset behavior has one place |
| dashboard.js | Alerts and Dashboard page | Summary screen logic is separated from features |
| logs.js | Activity log page | Audit table display is separate from audit writes |
| main.js | Startup loading and page registration | Startup flow is now the final small file |

## Demo Auth Notes

This is a frontend-only training flow. Users are saved in localStorage under
retailops.authUsers. The active session is saved as loggedInUser. The OTP is
always 0000.

Store data is saved per store using keys like retailops.web.STORE1001.products.
Each saved collection is wrapped with its storeId, so STORE1001 and STORE2001
can change their data independently.
