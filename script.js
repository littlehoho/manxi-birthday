// Shared enhancements for the invitation site.
// Keeps motion subtle and reads only from a sanitized public RSVP feed.
(function () {
  const guestSummaryElement = document.querySelector("[data-guest-summary]");
  const guestStatusElement = document.querySelector("[data-guest-status]");
  const guestCountRowElement = document.querySelector("[data-guest-count-row]");
  const yesCountElement = document.querySelector("[data-yes-count]");
  const noCountElement = document.querySelector("[data-no-count]");
  const groupSections = {
    yes: document.querySelector('[data-guest-group="yes"]'),
  };
  const groupLists = {
    yes: document.querySelector('[data-guest-list="yes"]'),
  };
  const groupCountElements = {
    yes: document.querySelector('[data-count-for="yes"]'),
  };
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
        // Fail silently; the RSVP link remains the primary action.
      }
    });
  });

  initializeGuestList();

  function initializeGuestList() {
    if (!guestSummaryElement || !guestStatusElement) return;

    const config = window.partyGuestListConfig || {};
    if (!config.sourceUrl) {
      setUnavailableState(
        "Guest list updates here",
        "Add a sanitized public RSVP feed to show first-name-only responses."
      );
      return;
    }

    loadGuests(config).catch(() => {
      setUnavailableState(
        "Guest list unavailable",
        "We could not load the public RSVP summary right now."
      );
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

    const payload =
      config.format === "json"
        ? await response.json()
        : parseCsv(await response.text());

    const groupedGuests = config.format === "json"
      ? normalizePublicRsvpFeed(payload)
      : groupGuestsFromRows(payload, config);

    renderGuests(groupedGuests, config);
  }

  function renderGuests(groupedGuests, config) {
    const yesNames = groupedGuests.yes;
    const noCount = groupedGuests.noCount;
    const totalShown = yesNames.length;

    clearList(groupLists.yes);

    if (!totalShown) {
      hideGroup("yes");
      guestCountRowElement.hidden = true;
      guestSummaryElement.hidden = true;
      guestStatusElement.textContent =
        "We can't wait to fill this with the friends who are coming to celebrate.";
      return;
    }

    guestSummaryElement.hidden = false;
    renderGroup("yes", yesNames, "coming");
    guestSummaryElement.textContent = buildSummaryText(yesNames.length);
    guestStatusElement.textContent =
      "Only children's first names and public-safe yes responses are shown here.";

    guestCountRowElement.hidden = false;
    yesCountElement.textContent = yesNames.length === 1 ? "1 yes" : `${yesNames.length} yes`;

    if (config.showNoCount && noCount > 0) {
      noCountElement.hidden = false;
      noCountElement.textContent = noCount === 1 ? "1 not able to make it" : `${noCount} not able to make it`;
    } else {
      noCountElement.hidden = true;
    }
  }

  function renderGroup(status, names, label) {
    if (!names.length) {
      hideGroup(status);
      return;
    }

    const section = groupSections[status];
    const list = groupLists[status];
    const count = groupCountElements[status];

    section.hidden = false;
    count.textContent = names.length === 1 ? `1 ${label}` : `${names.length} ${label}`;

    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.appendChild(item);
    });
  }

  function hideGroup(status) {
    const section = groupSections[status];
    const list = groupLists[status];
    const count = groupCountElements[status];

    if (!section || !list || !count) return;
    section.hidden = true;
    list.innerHTML = "";
    count.textContent = "";
  }

  function clearList(list) {
    if (list) list.innerHTML = "";
  }

  function setUnavailableState(summary, statusMessage) {
    guestSummaryElement.textContent = summary;
    guestSummaryElement.hidden = false;
    guestStatusElement.textContent = statusMessage;
    guestCountRowElement.hidden = true;
    hideGroup("yes");
  }

  function buildSummaryText(yesCount) {
    return yesCount === 1 ? "1 friend is joining the fun" : `${yesCount} friends are joining the fun`;
  }

  function groupGuestsFromRows(rows, config) {
    const list = Array.isArray(rows) ? rows : [];
    const fieldNames = {
      firstName: [
        config.firstNameField,
        "Kid First Name",
        "Child First Name",
        "First Name",
        "Child Name",
        "Name",
      ].filter(Boolean),
      status: [
        config.statusField,
        "RSVP Status",
        "RSVP",
        "Response",
        "Status",
      ].filter(Boolean),
    };

    const grouped = {
      yes: [],
      noCount: 0,
    };

    list.forEach((row) => {
      if (!row || typeof row !== "object") return;

      const rawName = getFieldValue(row, fieldNames.firstName);
      const rawStatus = getFieldValue(row, fieldNames.status);
      const firstName = sanitizeFirstName(rawName);
      const normalizedStatus = normalizeStatus(rawStatus);

      if (normalizedStatus === "no") {
        grouped.noCount += 1;
        return;
      }

      if (!firstName) return;

      if (normalizedStatus === "yes") {
        grouped.yes.push(firstName);
      }
    });

    grouped.yes = uniqueSorted(grouped.yes);
    return grouped;
  }

  function normalizePublicRsvpFeed(payload) {
    const yesNames = uniqueSorted(Array.isArray(payload.yes) ? payload.yes.map(sanitizeFirstName) : []);
    const safeNoCount = Number.isFinite(payload.noCount) ? Math.max(0, payload.noCount) : 0;

    return {
      yes: yesNames,
      noCount: safeNoCount,
    };
  }

  function uniqueSorted(names) {
    return Array.from(new Set(names.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }

  function getFieldValue(row, fieldNames) {
    const key = fieldNames.find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate));
    return key ? row[key] : "";
  }

  function normalizeStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (["yes", "y", "going", "attending"].includes(normalized)) {
      return "yes";
    }

    if (["no", "n", "not attending", "cannot make it", "can't make it"].includes(normalized)) {
      return "no";
    }

    return "unknown";
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
})();
