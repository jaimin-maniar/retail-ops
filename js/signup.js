/* Signup page form handling. */

{
  const form = document.getElementById("signupForm");
  const message = document.getElementById("message");

  if (window.RetailOpsAuth.getLoggedInUser()) {
    window.location.href = "dashboard.html";
  }

  function showMessage(text, success) {
    message.textContent = text;
    message.className = success ? "message success" : "message";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      const user = window.RetailOpsAuth.signup({
        fullName: document.getElementById("fullName").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        confirmPassword: document.getElementById("confirmPassword").value,
        storeId: document.getElementById("storeId").value,
        otp: document.getElementById("otp").value
      });

      showMessage(`Account created for ${user.StoreId}. Opening your dashboard...`, true);
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    } catch (error) {
      showMessage(error.message, false);
    }
  });
}
