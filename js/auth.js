/* Frontend-only signup, login, OTP, and dashboard auth helpers. */

{
  const AUTH_USERS_KEY = "retailops.authUsers";
  const LOGGED_IN_USER_KEY = "loggedInUser";
  const DUMMY_OTP = "0000";

  const demoUsers = [
    {
      UserId: "U001",
      FullName: "Admin User",
      Username: "admin",
      Email: "admin@store1001.com",
      Password: "Admin@123",
      StoreId: "STORE1001",
      Role: "Admin",
      IsActive: true
    },
    {
      UserId: "U002",
      FullName: "Inventory User",
      Username: "inventory",
      Email: "inventory@store1001.com",
      Password: "Inventory@123",
      StoreId: "STORE1001",
      Role: "InventoryManager",
      IsActive: true
    },
    {
      UserId: "U003",
      FullName: "Store Manager",
      Username: "manager",
      Email: "manager@store2001.com",
      Password: "Manager@123",
      StoreId: "STORE2001",
      Role: "StoreManager",
      IsActive: true
    },
    {
      UserId: "U004",
      FullName: "Cashier User",
      Username: "cashier",
      Email: "cashier@store2001.com",
      Password: "Cashier@123",
      StoreId: "STORE2001",
      Role: "Cashier",
      IsActive: true
    }
  ];

  function getUsers() {
    const saved = localStorage.getItem(AUTH_USERS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }

    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(demoUsers));
    return demoUsers.slice();
  }

  function saveUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  }

  function cleanEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function cleanStoreId(storeId) {
    return String(storeId || "").trim().toUpperCase();
  }

  function checkEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail(email))) {
      return "Invalid email format.";
    }
    return "";
  }

  function checkPassword(password) {
    const text = String(password || "");

    if (text.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!/[A-Z]/.test(text)) {
      return "Password must contain one uppercase letter.";
    }
    if (!/[a-z]/.test(text)) {
      return "Password must contain one lowercase letter.";
    }
    if (!/[0-9]/.test(text)) {
      return "Password must contain one number.";
    }
    if (!/[^A-Za-z0-9]/.test(text)) {
      return "Password must contain one special character.";
    }

    return "";
  }

  function checkStoreId(storeId) {
    const storeRegex = /^STORE[0-9]{4}$/;
    if (!storeRegex.test(cleanStoreId(storeId))) {
      return "Store ID must look like STORE1001.";
    }
    return "";
  }

  function checkOtp(otp) {
    if (String(otp || "").trim() !== DUMMY_OTP) {
      return "Invalid OTP. Use 0000 for this demo.";
    }
    return "";
  }

  function publicUser(user) {
    return {
      UserId: user.UserId,
      FullName: user.FullName,
      Username: user.Username,
      Email: user.Email,
      StoreId: user.StoreId,
      Role: user.Role,
      IsActive: user.IsActive
    };
  }

  function createUserId(users) {
    return "U" + String(users.length + 1).padStart(3, "0");
  }

  function signup(details) {
    const fullName = String(details.fullName || "").trim();
    const email = cleanEmail(details.email);
    const password = String(details.password || "");
    const confirmPassword = String(details.confirmPassword || "");
    const storeId = cleanStoreId(details.storeId);
    const users = getUsers();

    if (!fullName) {
      throw new Error("Full name is required.");
    }

    const emailError = checkEmail(email);
    if (emailError) {
      throw new Error(emailError);
    }

    const passwordError = checkPassword(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    if (password !== confirmPassword) {
      throw new Error("Password and confirm password must match.");
    }

    const storeError = checkStoreId(storeId);
    if (storeError) {
      throw new Error(storeError);
    }

    const otpError = checkOtp(details.otp);
    if (otpError) {
      throw new Error(otpError);
    }

    const exists = users.some((user) =>
      cleanEmail(user.Email) === email && cleanStoreId(user.StoreId) === storeId
    );
    if (exists) {
      throw new Error("An account already exists for this email and store.");
    }

    const created = {
      UserId: createUserId(users),
      FullName: fullName,
      Username: fullName,
      Email: email,
      Password: password,
      StoreId: storeId,
      Role: "Admin",
      IsActive: true
    };

    users.push(created);
    saveUsers(users);
    const sessionUser = publicUser(created);
    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  }

  function login(email, password, storeId, otp) {
    const cleanLoginEmail = cleanEmail(email);
    const cleanLoginStore = cleanStoreId(storeId);
    const users = getUsers();

    const emailError = checkEmail(cleanLoginEmail);
    if (emailError) {
      throw new Error(emailError);
    }

    if (!String(password || "").trim()) {
      throw new Error("Password is required.");
    }

    const storeError = checkStoreId(cleanLoginStore);
    if (storeError) {
      throw new Error(storeError);
    }

    const otpError = checkOtp(otp);
    if (otpError) {
      throw new Error(otpError);
    }

    const matchingEmailPassword = users.find((user) =>
      cleanEmail(user.Email) === cleanLoginEmail &&
      user.Password === password &&
      user.IsActive
    );

    if (matchingEmailPassword && cleanStoreId(matchingEmailPassword.StoreId) !== cleanLoginStore) {
      throw new Error("Store ID does not match this account.");
    }

    const user = users.find((item) =>
      cleanEmail(item.Email) === cleanLoginEmail &&
      item.Password === password &&
      cleanStoreId(item.StoreId) === cleanLoginStore &&
      item.IsActive
    );

    if (!user) {
      throw new Error("Invalid email, password, or store ID.");
    }

    const sessionUser = publicUser(user);
    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  }

  function logout() {
    localStorage.removeItem(LOGGED_IN_USER_KEY);
    sessionStorage.removeItem("retailops.web.sessionUser");
  }

  function getLoggedInUser() {
    const saved = localStorage.getItem(LOGGED_IN_USER_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  function getUsersForStore(storeId) {
    const cleanId = cleanStoreId(storeId);
    return getUsers()
      .filter((user) => cleanStoreId(user.StoreId) === cleanId)
      .map(publicUser);
  }

  window.RetailOpsAuth = {
    otp: DUMMY_OTP,
    signup,
    login,
    logout,
    getUsers,
    getUsersForStore,
    getLoggedInUser,
    checkEmail,
    checkPassword,
    checkStoreId,
    checkOtp,
    cleanStoreId
  };

  if (window.retailApp) {
    const dashboardApp = window.retailApp;

    dashboardApp.auth = {
      login(email, password, storeId, otp) {
        const user = window.RetailOpsAuth.login(email, password, storeId, otp);
        dashboardApp.data.setUser(user);
        dashboardApp.logs.log(user, "Login", "User", user.UserId, "User signed in.");
        return user;
      },

      logout() {
        window.RetailOpsAuth.logout();
        dashboardApp.data.setUser(null);
        window.location.href = "login.html";
      }
    };
  }
}
