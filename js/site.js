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

  // Fallback for browsers without view transitions: fade colours together.
  function fadeTo(next) {
    root.classList.add("theming");
    paint(next);
    clearTimeout(toggle.themingTimer);
    toggle.themingTimer = setTimeout(function () {
      root.classList.remove("theming");
    }, 750);
  }

  // Reveal the new theme as a circle growing from the toggle. Every pixel is
  // either fully old or fully new, so text never washes out mid-switch.
  function revealTo(next) {
    var box = toggle.getBoundingClientRect();
    var x = box.left + box.width / 2;
    var y = box.top + box.height / 2;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("theme-reveal");
    var transition = document.startViewTransition(function () {
      paint(next);
    });
    transition.ready.then(function () {
      root.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
        { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
    transition.finished.then(function () {
      root.classList.remove("theme-reveal");
    });
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = theme() === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch (err) {}
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        paint(next);
      } else if (document.startViewTransition) {
        revealTo(next);
      } else {
        fadeTo(next);
      }
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

  // Highlight the menu item for the section being read.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var spied = navLinks
    .map(function (link) { return document.getElementById(link.getAttribute("href").slice(1)); })
    .filter(Boolean);
  var lockedId = null;
  var lockTimer;

  function setActive(id) {
    navLinks.forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function currentSection() {
    if (!spied.length) return null;
    // At the very bottom, the last section wins even if it is short.
    if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 4) {
      return spied[spied.length - 1].id;
    }
    var line = (header ? header.offsetHeight : 0) + window.innerHeight * 0.3;
    var id = null;
    spied.forEach(function (section) {
      if (section.getBoundingClientRect().top <= line) id = section.id;
    });
    return id;
  }

  var ticking = false;
  function onScroll() {
    // While a clicked link scrolls into place, keep it selected until
    // the scrolling has been quiet for a moment.
    if (lockedId) {
      clearTimeout(lockTimer);
      lockTimer = setTimeout(unlock, 160);
      return;
    }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      setActive(currentSection());
    });
  }

  function unlock() {
    lockedId = null;
    setActive(currentSection());
  }

  if (navLinks.length) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      var offset = (header ? header.offsetHeight : 0) + 18;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      // Replace, not push: section jumps should not pile up in Back history.
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });

      lockedId = spied.some(function (s) { return s.id === id; }) ? id : null;
      setActive(lockedId);
      clearTimeout(lockTimer);
      // Unlocks once scrolling stops; also covers a click that needs no scroll.
      lockTimer = setTimeout(unlock, 400);
    });
  });
})();

// Easter egg: clicking the footer flag celebrates Pakistan.
(function () {
  var flag = document.getElementById("flag-egg");
  if (!flag) return;

  var toast, toastTimer, layer;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function showToast() {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "egg-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.innerHTML =
        '<svg viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle cx="18" cy="21" r="12" fill="#fff"/>' +
        '<circle cx="21.5" cy="18.5" r="10.6" fill="#01411c"/>' +
        '<polygon fill="#fff" points="27.6,8.5 28.8,12.2 32.7,12.2 29.6,14.5 30.7,18.2 27.6,15.9 24.5,18.2 25.6,14.5 22.5,12.2 26.4,12.2"/>' +
        "</svg>" +
        "<div><strong>Pakistan Zindabad!</strong>" +
        "<span>Faith · Unity · Discipline</span></div>";
      document.body.appendChild(toast);
    }
    toast.classList.remove("show");
    void toast.offsetWidth; // restart the slide-in on repeat clicks
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 4500);
  }

  function burst() {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "egg-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    var box = flag.getBoundingClientRect();
    var x0 = box.left + box.width / 2;
    var y0 = box.top + box.height / 2;
    var shapes = ["star", "star", "dot", "strip"];
    var colors = ["green", "white", "leaf", "white", "green"];
    var count = innerWidth < 600 ? 46 : 70;

    for (var i = 0; i < count; i++) {
      var bit = document.createElement("span");
      bit.className = "egg-bit " + shapes[i % shapes.length] + " " + colors[i % colors.length];
      var size = 7 + Math.random() * 9;
      bit.style.width = size + "px";
      bit.style.height = (bit.className.indexOf("strip") > -1 ? size * 1.8 : size) + "px";
      layer.appendChild(bit);

      // A simple ballistic arc: launch up and out, then fall with gravity.
      var angle = (-90 + (Math.random() * 130 - 65)) * Math.PI / 180;
      var speed = 9 + Math.random() * 9;
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed;
      var spin = (Math.random() * 2 - 1) * 720;
      var frames = [];
      for (var t = 0; t <= 60; t += 6) {
        var x = x0 + vx * t * 1.4;
        var y = y0 + vy * t * 1.4 + 0.5 * 0.55 * t * t * 1.4;
        frames.push({
          transform: "translate(" + x + "px," + y + "px) rotate(" + (spin * t / 60) + "deg)",
          opacity: t > 42 ? 1 - (t - 42) / 18 : 1
        });
      }
      var anim = bit.animate(frames, {
        duration: 1700 + Math.random() * 900,
        easing: "linear",
        fill: "forwards"
      });
      anim.onfinish = (function (el) {
        return function () { el.remove(); };
      })(bit);
    }
  }

  flag.addEventListener("click", function () {
    if (!reduceMotion.matches && document.body.animate) burst();
    showToast();
  });
})();
