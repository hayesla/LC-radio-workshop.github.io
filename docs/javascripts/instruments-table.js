// Enhance the instrument catalogue table with auto-linked URLs and
// Simple-DataTables (sort, search, paginate). Resilient to column
// changes in the source spreadsheet — works on whatever table the
// table-reader plugin produces.

function enhanceInstrumentsTable() {
  const wrapper = document.querySelector(".instruments-table");
  if (!wrapper) return;

  const table = wrapper.querySelector("table");
  if (!table || table.dataset.dtInit === "true") return;
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

  document.getElementById("font-size-slider").addEventListener("input", e => {
    const size = e.target.value;
    wrapper.style.fontSize = size + "px";
    document.getElementById("font-size-value").textContent = size;
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
