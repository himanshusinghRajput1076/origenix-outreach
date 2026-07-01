/**
 * Clean a raw phone string into digits-only format suitable for wa.me links.
 *
 * Rules:
 *  - Strip spaces, dashes, parentheses, dots
 *  - Remove a leading "+" (wa.me expects bare digits)
 *  - If the remaining number doesn't start with a country code (i.e. < 11 digits
 *    and starts with something that looks local), prepend defaultCountryCode.
 *
 * @param {string} raw
 * @param {string} [defaultCountryCode="91"]  — default country code (India)
 * @returns {string}
 */
function cleanPhoneNumber(raw, defaultCountryCode = "91") {
  if (!raw) return "";

  // Split by common separators and take the first part
  const parts = String(raw).split(/[,/;]|\band\b/i);
  let firstPart = parts[0] ? parts[0].trim() : "";

  // Strip common separators
  let cleaned = firstPart.replace(/[\s\-().+]/g, "");

  // Remove any remaining non-digit characters
  cleaned = cleaned.replace(/\D/g, "");

  if (cleaned.length === 0) return "";

  // Strip leading zero if present
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Heuristic: if the number is 10 digits (common local format), prepend country code
  if (cleaned.length === 10) {
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
}

/**
 * Replace {name}, {company}, and any other contact-field placeholders
 * inside a message template, supporting case-insensitivity and aliases.
 */
function applyTemplate(template, contact) {
  if (!contact) return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "");
    
    // Check direct keys first
    for (const contactKey of Object.keys(contact)) {
      if (contactKey.toLowerCase().replace(/[\s_-]/g, "") === normalizedKey) {
        return contact[contactKey] ?? "";
      }
    }
    
    // Check common aliases
    if (normalizedKey === "contactperson" || normalizedKey === "fullname" || normalizedKey === "contactname") {
      return contact.name ?? "";
    }
    if (normalizedKey === "companyname") {
      return contact.company ?? "";
    }
    if (normalizedKey === "phonenumber" || normalizedKey === "mobilenumber" || normalizedKey === "contactnumber" || normalizedKey === "whatsappnumber") {
      return contact.phone ?? "";
    }
    if (normalizedKey === "emailaddress" || normalizedKey === "emailid") {
      return contact.email ?? "";
    }
    
    // Fallback: If it's a standard alphanumeric variable tag, replace with empty string
    if (/^[a-zA-Z0-9\s_-]+$/.test(key)) {
      return "";
    }
    return match;
  });
}

/**
 * Generate WhatsApp wa.me links for a list of contacts.
 *
 * @param {object}   opts
 * @param {object[]} opts.contacts         — [{name, phone, company, …}]
 * @param {string}   opts.messageTemplate  — message with {name}, {company} placeholders
 * @param {string}   [opts.defaultCountryCode="91"]
 *
 * @returns {{ name: string, phone: string, link: string, message: string }[]}
 */
export function generateWhatsAppLinks({
  contacts,
  messageTemplate,
  defaultCountryCode = "91",
}) {
  if (!contacts || contacts.length === 0) {
    throw new Error("No contacts provided");
  }
  if (!messageTemplate) {
    throw new Error("Message template is required");
  }

  const results = contacts.map((contact) => {
    const name = contact.name || "";
    const rawPhone = contact.phone || "";
    const cleanedPhone = cleanPhoneNumber(rawPhone, defaultCountryCode);
    const personalMessage = applyTemplate(messageTemplate, contact);
    const encodedMessage = encodeURIComponent(personalMessage);

    const link = cleanedPhone
      ? `https://wa.me/${cleanedPhone}?text=${encodedMessage}`
      : "";

    return {
      name,
      phone: cleanedPhone,
      link,
      message: personalMessage,
    };
  });

  const validCount = results.filter((r) => r.link).length;
  console.log(
    `[WhatsAppService] Generated ${validCount}/${contacts.length} links`
  );

  return results;
}
