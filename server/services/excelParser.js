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
 *
 * @param {Buffer} buffer — raw file bytes
 * @returns {{ headers: string[], contacts: object[], totalCount: number }}
 */
export function parseExcel(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty or missing file buffer");
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("The uploaded workbook contains no sheets");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array-of-arrays so we can inspect the header row ourselves
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length === 0) {
    throw new Error("The first sheet is empty");
  }

  // ---------- Header detection ----------
  const rawHeaders = rows[0].map((h) => String(h).trim());

  // Map each column index → canonical field name (or keep original header)
  const headerMap = rawHeaders.map((h) => {
    const key = h.toLowerCase();
    return COLUMN_ALIASES[key] || h;
  });

  // ---------- Row parsing ----------
  const contacts = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip completely empty rows
    const allEmpty = row.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === ""
    );
    if (allEmpty) continue;

    const contact = {};
    headerMap.forEach((field, colIdx) => {
      const value = row[colIdx];
      contact[field] = value !== null && value !== undefined ? String(value).trim() : "";
    });

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
