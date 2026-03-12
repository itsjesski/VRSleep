window.VRSleepLayoutParts = window.VRSleepLayoutParts || {};

(function renderLayout() {
  const parts = window.VRSleepLayoutParts;

  const headerHost = document.getElementById("layout-header");
  const loginHost = document.getElementById("layout-login");
  const mainHost = document.getElementById("layout-main");
  const modalsHost = document.getElementById("layout-modals");
  const footerHost = document.getElementById("layout-footer");

  if (headerHost) headerHost.innerHTML = parts.header || "";
  if (loginHost) loginHost.innerHTML = parts.loginView || "";
  if (mainHost) mainHost.innerHTML = parts.mainView || "";
  if (modalsHost) modalsHost.innerHTML = parts.modals || "";
  if (footerHost) footerHost.innerHTML = parts.footer || "";
})();