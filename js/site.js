(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");

  function theme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function paint(next) {
    root.setAttribute("data-theme", next);
    if (!toggle) return;
    var dark = next === "dark";
    toggle.setAttribute("aria-pressed", dark ? "true" : "false");
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  paint(theme());

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = theme() === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch (err) {}
      paint(next);
    });
  }

  var header = document.querySelector(".site-header");

  function fromCodes(codes) {
    return String.fromCharCode.apply(null, codes);
  }

  function mailAddress() {
    return fromCodes([97, 97, 102, 97, 113, 64, 109, 115, 110, 46, 99, 111, 109]);
  }

  function phoneText() {
    return fromCodes([43, 57, 50, 32, 51, 49, 50, 32, 51, 55, 49, 51, 48, 48, 52]);
  }

  function phoneHref() {
    return "tel:" + fromCodes([43, 57, 50, 51, 49, 50, 51, 55, 49, 51, 48, 48, 52]);
  }

  function contactNodes() {
    var mail = mailAddress();
    var email = document.createElement("a");
    email.href = "mailto:" + mail;
    email.textContent = mail;
    var phone = document.createElement("a");
    phone.href = phoneHref();
    phone.textContent = phoneText();
    return [email, phone];
  }

  function revealContact(slot, button) {
    if (!slot || slot.getAttribute("data-shown") === "true") return;
    var nodes = contactNodes();
    nodes.forEach(function (node) {
      slot.appendChild(node);
    });
    slot.hidden = false;
    slot.setAttribute("data-shown", "true");
    if (button) button.hidden = true;
  }

  var showContact = document.getElementById("show-contact");
  var contactDetails = document.getElementById("contact-details");
  var resumeContact = document.getElementById("resume-contact");

  if (showContact) {
    showContact.addEventListener("click", function () {
      revealContact(contactDetails || resumeContact, showContact);
    });
  }

  window.addEventListener("beforeprint", function () {
    if (resumeContact) revealContact(resumeContact, showContact);
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      var offset = (header ? header.offsetHeight : 0) + 18;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      if (history.pushState) history.pushState(null, "", "#" + id);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
})();
