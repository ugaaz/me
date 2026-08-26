(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const yearEls = document.querySelectorAll("[data-year]");
  const reveals = document.querySelectorAll(".reveal");
  const forms = document.querySelectorAll("form[data-form]");
  const amountButtons = document.querySelectorAll("[data-amount]");
  const amountInput = document.querySelector("#amount");

  const year = String(new Date().getFullYear());
  yearEls.forEach((el) => {
    el.textContent = year;
  });

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    document.querySelectorAll(".site-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if ("IntersectionObserver" in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  amountButtons.forEach((button) => {
    button.addEventListener("click", () => {
      amountButtons.forEach((other) => other.classList.remove("is-selected"));
      button.classList.add("is-selected");
      if (amountInput) {
        amountInput.value = button.getAttribute("data-amount") || "";
        amountInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });

  if (amountInput) {
    amountInput.addEventListener("input", () => {
      const value = amountInput.value.trim();
      amountButtons.forEach((button) => {
        button.classList.toggle("is-selected", button.getAttribute("data-amount") === value);
      });
    });
  }

  const consultButtons = document.querySelectorAll("[data-consult-type]");
  const consultInput = document.querySelector("#consult-type");
  const consultBlock = document.querySelector(".choice-block");
  const consultError = document.querySelector("[data-consult-error]");

  consultButtons.forEach((button) => {
    button.addEventListener("click", () => {
      consultButtons.forEach((other) => {
        other.classList.remove("is-selected");
        other.setAttribute("aria-pressed", "false");
      });
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
      if (consultInput) consultInput.value = button.getAttribute("data-consult-type") || "";
      consultBlock?.classList.remove("is-invalid");
      if (consultError) consultError.hidden = true;
    });
  });

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (consultInput && form.contains(consultInput) && !consultInput.value) {
        consultBlock?.classList.add("is-invalid");
        if (consultError) {
          consultError.hidden = false;
          consultError.focus();
        }
        return;
      }
      const success = form.parentElement.querySelector("[data-form-success]");
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus();
      }
      form.reset();
      consultButtons.forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
      });
    });
  });
})();
