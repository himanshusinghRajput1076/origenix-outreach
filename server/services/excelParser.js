import * as XLSX from "xlsx";

/**
 * Known column aliases → canonical field names.
 * Matching is case-insensitive and trimmed.
 */
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
 * Parse an Excel buffer (.xlsx / .xls) and return structured contact data.
 * Optimised: uses dense_mode to skip allocation of sparse arrays and
 * skips raw header rows faster with index-based access.
 *
 * @param {Buffer} buffer — raw file bytes
 * @returns {{ headers: string[], contacts: object[], totalCount: number }}
 */
export function parseExcel(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty or missing file buffer");
  }

  // cellDates: parse date serial numbers to JS Date objects
  // dense: use dense 2-D array internally (faster for large sheets)
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });

  if (workbook.SheetNames.length === 0) {
    throw new Error("The uploaded workbook contains no sheets");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // sheet_to_json with header:1 returns array-of-arrays — fastest path
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length === 0) {
    throw new Error("The first sheet is empty");
  }

  // ---------- Header detection ----------
  const rawHeaders = rows[0].map((h) => String(h).trim());

  // Pre-build headerMap once (avoid repeated COLUMN_ALIASES lookups per row)
  const headerMap = rawHeaders.map((h) => {
    const key = h.toLowerCase();
    return COLUMN_ALIASES[key] || h;
  });

  const colCount = headerMap.length;

  // ---------- Row parsing (optimised tight loop) ----------
  const contacts = [];
  const rowCount = rows.length;

  for (let i = 1; i < rowCount; i++) {
    const row = rows[i];
    if (!row) continue;

    // Fast empty-row check: look for any non-blank cell
    let hasData = false;
    for (let c = 0; c < colCount; c++) {
      const v = row[c];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    // Build contact object with pre-validated field names
    const contact = {};
    for (let c = 0; c < colCount; c++) {
      const value = row[c];
      // Convert dates to ISO strings; everything else to trimmed string
      if (value instanceof Date) {
        contact[headerMap[c]] = value.toISOString().split("T")[0]; // YYYY-MM-DD
      } else {
        contact[headerMap[c]] =
          value !== null && value !== undefined ? String(value).trim() : "";
      }
    }

    contacts.push(contact);
  }

  console.log(
    `[ExcelParser] Sheet "${sheetName}" — ${rawHeaders.length} columns, ${contacts.length} contacts parsed`
  );

  return {
    headers: headerMap,
    contacts,
    totalCount: contacts.length,
  };
}
