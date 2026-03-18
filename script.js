// Shared enhancements for the invitation site.
// Keeps motion subtle and reads only from a sanitized public RSVP feed.
(function () {
  const guestSummaryElement = document.querySelector("[data-guest-summary]");
  const guestStatusElement = document.querySelector("[data-guest-status]");
  const groupSections = {
    yes: document.querySelector('[data-guest-group="yes"]'),
  };
  const groupLists = {
    yes: document.querySelector('[data-guest-list="yes"]'),
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
    const requestUrl = new URL(config.sourceUrl, window.location.href);
    requestUrl.searchParams.set("_", String(Date.now()));

    const response = await fetch(requestUrl.toString(), {
      cache: "no-store",
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
      guestSummaryElement.style.display = "none";
      guestStatusElement.textContent =
        "We can't wait to fill this with the friends who are coming to celebrate.";
      return;
    }

    guestSummaryElement.style.display = "";
    renderGroup("yes", yesNames);
    guestSummaryElement.textContent = buildSummaryText(yesNames.length, noCount, config.showNoCount);
    guestStatusElement.textContent = "We'll show first names of friends who are coming.";
  }

  function renderGroup(status, names) {
    if (!names.length) {
      hideGroup(status);
      return;
    }

    const section = groupSections[status];
    const list = groupLists[status];

    section.hidden = false;

    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.appendChild(item);
    });
  }

  function hideGroup(status) {
    const section = groupSections[status];
    const list = groupLists[status];

    if (!section || !list) return;
    section.hidden = true;
    list.innerHTML = "";
  }

  function clearList(list) {
    if (list) list.innerHTML = "";
  }

  function setUnavailableState(summary, statusMessage) {
    guestSummaryElement.textContent = summary;
    guestSummaryElement.style.display = "";
    guestStatusElement.textContent = statusMessage;
    hideGroup("yes");
  }

  function buildSummaryText(yesCount, noCount, showNoCount) {
    const yesLabel = yesCount === 1 ? "1 coming" : `${yesCount} coming`;

    if (showNoCount && noCount > 0) {
      const noLabel = noCount === 1 ? "1 can't make it" : `${noCount} can't make it`;
      return `${yesLabel} · ${noLabel}`;
    }

    return yesLabel;
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
        "Would you be able to attend?",
        "Would you be able to attend",
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
    if (Array.isArray(payload)) {
      return groupGuestsFromRows(payload, window.partyGuestListConfig || {});
    }

    const yesSource = Array.isArray(payload.yes)
      ? payload.yes
      : Array.isArray(payload.kids)
        ? payload.kids
        : [];

    const yesNames = uniqueSorted(yesSource.map(sanitizeFirstName));

    const safeNoCount = Number.isFinite(payload.noCount)
      ? Math.max(0, payload.noCount)
      : 0;

    return {
      yes: yesNames,
      noCount: safeNoCount,
    };
  }

  function uniqueSorted(names) {
    return Array.from(new Set(names.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }

  function getFieldValue(row, fieldNames) {
    const rowKeys = Object.keys(row);
    const actualKey = rowKeys.find((rowKey) =>
      fieldNames.some((candidate) => normalizeHeader(rowKey) === normalizeHeader(candidate))
    );

    return actualKey ? row[actualKey] : "";
  }

  function normalizeStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized.includes("yes") || normalized.includes("be there")) {
      return "yes";
    }

    if (
      normalized.includes("no") ||
      normalized.includes("can't make it") ||
      normalized.includes("cannot make it") ||
      normalized.includes("sorry")
    ) {
      return "no";
    }

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

  function normalizeHeader(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[?]/g, "")
      .replace(/\s+/g, " ");
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
