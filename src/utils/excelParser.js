let xlsxPromise = null;

/**
 * Dynamically load SheetJS from CDN on-demand.
 * This guarantees Vite will never try to bundle it, eliminating all bundler-related blank screen errors.
 */
function loadXLSX() {
  if (window.XLSX) {
    return Promise.resolve(window.XLSX);
  }
  if (xlsxPromise) {
    return xlsxPromise;
  }

  xlsxPromise = new Promise((resolve, reject) => {
    console.log("[ExcelParser] Injecting SheetJS CDN script dynamically...");
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      if (window.XLSX) {
        console.log("[ExcelParser] SheetJS loaded successfully from CDN ✓");
        resolve(window.XLSX);
      } else {
        reject(new Error("SheetJS failed to initialize."));
      }
    };
    script.onerror = () => {
      xlsxPromise = null; // Reset on failure so we can try again
      reject(new Error("Failed to load SheetJS library from CDN."));
    };
    document.body.appendChild(script);
  });

  return xlsxPromise;
}

const COLUMN_ALIASES = {
  // Name
  name: "name",
  "full name": "name",
  fullname: "name",
  "first name": "name",
  firstname: "name",
  "contact name 1": "name",
  "contact name1": "name",
  "contact name": "name",
  "contact person": "name",

  // Second contact
  "contact name 2": "contact2",
  "contact name2": "contact2",
  "contactname2": "contact2",
  "second contact": "contact2",

  // Designation / Role
  designation: "designation",
  designation1: "designation",
  "designation 1": "designation",
  role: "designation",
  title: "designation",
  position: "designation",
  "job title": "designation",

  // Email
  email: "email",
  mail: "email",
  "e-mail": "email",
  "email address": "email",
  "mail address": "email",
  "email id": "email",
  "email1": "email",
  "email 1": "email",

  // Phone
  phone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  contact: "phone",
  "phone number": "phone",
  "mobile number": "phone",
  "contact number": "phone",
  "whatsapp number": "phone",
  tel: "phone",
  telephone: "phone",
  "phone1": "phone",
  "mobile1": "phone",

  // Company
  company: "company",
  organization: "company",
  organisation: "company",
  "company name": "company",
  org: "company",
  "firm name": "company",
  "firm": "company",

  // Website
  website: "website",
  "web": "website",
  "url": "website",
  "site": "website",
  "company website": "website",
  "web address": "website",

  // Products / Services
  "products dealing": "products",
  "products": "products",
  "product": "products",
  "services": "products",
  "products/services": "products",
  "products & services": "products",
  "dealing in": "products",
  "business": "products",
  "industry": "products",

  // Activities
  activities: "activities",
  activity: "activities",
  "business activity": "activities",
  "business activities": "activities",
  "nature of business": "activities",
};

/**
 * Parses Excel files locally in the browser.
 * Loads the external library on-demand only when parsing is requested.
 *
 * @param {ArrayBuffer} arrayBuffer — Raw binary data from FileReader
 * @returns {Promise<{ headers: string[], contacts: object[], totalCount: number }>}
 */
export async function parseExcelClient(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Empty file data.");
  }

  // Load the SheetJS library dynamically
  const XLSX = await loadXLSX();

  // Read the workbook in dense array mode (highly memory efficient)
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error("No worksheets found in this Excel workbook.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert Sheet to array of arrays (fastest and cleanest representation)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length === 0) {
    throw new Error("The Excel worksheet is empty.");
  }

  // Detect and normalize headers
  const rawHeaders = rows[0].map((h) => String(h).trim());
  const headerMap = rawHeaders.map((h) => {
    const key = h.toLowerCase();
    return COLUMN_ALIASES[key] || h;
  });

  const colCount = headerMap.length;
  const contacts = [];

  // Parse remaining rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Skip fully blank rows
    let hasData = false;
    for (let c = 0; c < colCount; c++) {
      const v = row[c];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    // Assemble parsed row data
    const contact = {};
    for (let c = 0; c < colCount; c++) {
      const val = row[c];
      if (val instanceof Date) {
        // Format JS Date to YYYY-MM-DD
        contact[headerMap[c]] = val.toISOString().split("T")[0];
      } else {
        contact[headerMap[c]] = val !== null && val !== undefined ? String(val).trim() : "";
      }
    }
    contacts.push(contact);
  }

  console.log(`[ExcelParser] ClientParsed "${sheetName}": ${contacts.length} leads.`);
  return {
    headers: headerMap,
    contacts,
    totalCount: contacts.length,
  };
}
