// Load the instrument catalogue from a published Google Sheets CSV, then
// enhance the table with auto-linked URLs and Simple-DataTables.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(cells => cells.some(cell => cell.trim() !== ""));
}

function buildInstrumentsTable(rows) {
  if (rows.length < 2) {
    throw new Error("The instrument catalogue CSV does not contain table rows.");
  }

  const headers = rows[0];
  const table = document.createElement("table");
  const thead = table.createTHead();
  const headerRow = thead.insertRow();

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header.trim();
    headerRow.appendChild(th);
  });

  const tbody = table.createTBody();
  rows.slice(1).forEach(row => {
    const tr = tbody.insertRow();
    headers.forEach((_, index) => {
      const td = tr.insertCell();
      td.textContent = (row[index] || "").trim();
    });
  });

  return table;
}

async function loadInstrumentsTable(wrapper) {
  const csvUrl = wrapper.dataset.csvUrl;
  if (!csvUrl || wrapper.dataset.csvState) return;

  wrapper.dataset.csvState = "loading";

  try {
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csvText = await response.text();
    const table = buildInstrumentsTable(parseCsv(csvText));

    wrapper.textContent = "";
    wrapper.appendChild(table);
    wrapper.dataset.csvState = "loaded";
    enhanceInstrumentsTable();
  } catch (error) {
    wrapper.dataset.csvState = "error";
    wrapper.textContent = "";

    const message = document.createElement("p");
    message.className = "instruments-status instruments-status--error";
    message.textContent = "Could not load the live instrument catalogue. ";

    const link = document.createElement("a");
    link.href = csvUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open the source CSV";

    message.appendChild(link);
    message.append(".");
    wrapper.appendChild(message);
    console.error(error);
  }
}

function enhanceInstrumentsTable() {
  const wrapper = document.querySelector(".instruments-table");
  if (!wrapper) return;

  const table = wrapper.querySelector("table");
  if (!table) {
    loadInstrumentsTable(wrapper);
    return;
  }
  if (table.dataset.dtInit === "true") return;
  table.dataset.dtInit = "true";

  // Hide section-header rows (rows where only the first cell has content).
  // Lets the current spreadsheet render cleanly before a Category column
  // is added.
  const tbody = table.tBodies[0];
  if (tbody) {
    [...tbody.rows].forEach(row => {
      const cells = [...row.cells];
      const filled = cells.filter(c => c.textContent.trim() !== "").length;
      if (filled <= 1) {
        row.classList.add("section-header-row");
        row.style.display = "none";
      }
    });
  }

  // Blank out NaN values produced by pandas/openpyxl for empty cells.
  table.querySelectorAll("td").forEach(cell => {
    if (cell.textContent.trim().toLowerCase() === "nan") cell.textContent = "";
  });

  // Auto-linkify URLs in cells.
  const urlRe = /(https?:\/\/[^\s<>"')]+)/g;
  const allRows = table.querySelectorAll("tr");
  allRows.forEach(row => {
    [...row.cells].forEach(cell => {
      if (cell.querySelector("a")) return;
      if (!urlRe.test(cell.textContent)) {
        urlRe.lastIndex = 0;
        return;
      }
      urlRe.lastIndex = 0;
      cell.innerHTML = cell.innerHTML.replace(
        urlRe,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    });
  });

  // Font-size slider injected above the table, persisted in localStorage.
  const FONT_KEY = "instruments-font-size";
  const savedSize = parseInt(localStorage.getItem(FONT_KEY) || "14", 10);
  wrapper.style.fontSize = savedSize + "px";

  const controls = document.createElement("div");
  controls.className = "instruments-controls";
  controls.innerHTML = `
    <label for="font-size-slider">Text size: <span id="font-size-value">${savedSize}</span>px</label>
    <input id="font-size-slider" type="range" min="10" max="20" step="1" value="${savedSize}">
  `;
  wrapper.insertAdjacentElement("beforebegin", controls);

  controls.querySelector("#font-size-slider").addEventListener("input", e => {
    const size = e.target.value;
    wrapper.style.fontSize = size + "px";
    controls.querySelector("#font-size-value").textContent = size;
    localStorage.setItem(FONT_KEY, size);
  });

  // Initialise Simple-DataTables.
  if (typeof simpleDatatables !== "undefined") {
    new simpleDatatables.DataTable(table, {
      searchable: true,
      sortable: true,
      perPage: 25,
      perPageSelect: [10, 25, 50, 100],
      labels: {
        placeholder: "Search the catalogue…",
        perPage: "{select} entries per page",
        noRows: "No instruments match the search",
        info: "Showing {start} to {end} of {rows} instruments",
      },
    });
  }
}

// Material's instant-loading feature exposes `document$`; subscribe to it
// so the table re-initialises on client-side navigation. Fall back to a
// standard DOMContentLoaded handler if Material isn't available.
if (typeof document$ !== "undefined") {
  document$.subscribe(enhanceInstrumentsTable);
} else {
  document.addEventListener("DOMContentLoaded", enhanceInstrumentsTable);
}
