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

  // Strip common separators and whitespace
  let cleaned = String(raw).replace(/[\s\-().+]/g, "");

  // Remove any remaining non-digit characters
  cleaned = cleaned.replace(/\D/g, "");

  if (cleaned.length === 0) return "";

  // Heuristic: if the number is 10 digits (common local format), prepend country code
  if (cleaned.length === 10) {
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
}

/**
 * Replace {name}, {company}, and any other contact-field placeholders
 * inside a message template.
 */
function applyTemplate(template, contact) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return contact[key.toLowerCase()] ?? "";
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
