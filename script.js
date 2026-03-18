// Shared enhancements for the invitation concepts.
// Keeps animation subtle and disables itself gracefully where unsupported.
(function () {
  const guestCountElement = document.querySelector("[data-guest-count]");
  const guestListElement = document.querySelector("[data-guest-list]");
  const guestStatusElement = document.querySelector("[data-guest-status]");
  const reveals = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && reveals.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -24px 0px",
      }
    );

    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add("is-visible"));
  }

  document.querySelectorAll("[data-copy-location]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy-location");
      if (!navigator.clipboard || !text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = button.textContent;
        button.textContent = "Address copied";
        window.setTimeout(() => {
          button.textContent = original;
        }, 1600);
      } catch (error) {
        // Fail silently; the main action is still the RSVP link.
      }
    });
  });

  initializeGuestList();

  function initializeGuestList() {
    if (!guestCountElement || !guestListElement || !guestStatusElement) return;

    const config = window.partyGuestListConfig || {};
    if (!config.sourceUrl) {
      guestCountElement.textContent = "Guest list updates here";
      guestListElement.hidden = true;
      return;
    }

    loadGuests(config).catch(() => {
      guestCountElement.textContent = "Guest list unavailable";
      guestStatusElement.textContent = "We could not load the first-name guest list right now.";
      guestListElement.hidden = true;
    });
  }

  async function loadGuests(config) {
    const response = await fetch(config.sourceUrl, {
      headers: {
        Accept: config.format === "json" ? "application/json" : "text/csv",
      },
    });

    if (!response.ok) {
      throw new Error("Guest source request failed");
    }

    const rows =
      config.format === "json"
        ? normalizeJsonFeed(await response.json(), config)
        : parseCsv(await response.text());

    const guests = extractFirstNames(rows, config.firstNameField);
    renderGuests(guests);
  }

  function renderGuests(guests) {
    guestListElement.innerHTML = "";

    if (!guests.length) {
      guestCountElement.textContent = "No RSVP names yet";
      guestStatusElement.textContent = "Once replies come in, children's first names can appear here automatically.";
      guestListElement.hidden = true;
      return;
    }

    guestCountElement.textContent =
      guests.length === 1 ? "1 little friend is joining" : `${guests.length} little friends are joining`;

    guestStatusElement.textContent = "Only children's first names are shown here for privacy.";
    guestListElement.hidden = false;

    guests.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      guestListElement.appendChild(item);
    });
  }

  function extractFirstNames(rows, preferredField) {
    const list = Array.isArray(rows) ? rows : [];
    const fallbackFields = [
      preferredField,
      "Child First Name",
      "First Name",
      "Kid First Name",
      "Child Name",
      "Name",
    ].filter(Boolean);

    const names = list
      .map((row) => {
        if (!row || typeof row !== "object") return "";

        const field = fallbackFields.find((key) => Object.prototype.hasOwnProperty.call(row, key));
        const rawName = field ? row[field] : "";
        return sanitizeFirstName(rawName);
      })
      .filter(Boolean);

    return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right));
  }

  function sanitizeFirstName(value) {
    if (typeof value !== "string") return "";

    const trimmed = value.trim();
    if (!trimmed) return "";

    const firstToken = trimmed.split(/\s+/)[0];
    const clean = firstToken.replace(/[^A-Za-z'-]/g, "");

    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : "";
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const nextCharacter = text[index + 1];

      if (character === '"') {
        if (inQuotes && nextCharacter === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (character === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((character === "\n" || character === "\r") && !inQuotes) {
        if (character === "\r" && nextCharacter === "\n") {
          index += 1;
        }

        row.push(current);
        if (row.some((cell) => cell.trim() !== "")) {
          rows.push(row);
        }
        row = [];
        current = "";
      } else {
        current += character;
      }
    }

    if (current || row.length) {
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
    }

    if (!rows.length) return [];

    const [headers, ...dataRows] = rows;
    return dataRows.map((dataRow) => {
      const entry = {};

      headers.forEach((header, index) => {
        entry[header.trim()] = (dataRow[index] || "").trim();
      });

      return entry;
    });
  }

  function normalizeJsonFeed(payload, config) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.kids)) {
      return payload.kids.map((name) => ({
        [config.firstNameField || "Child First Name"]: name,
      }));
    }

    return [];
  }
})();
