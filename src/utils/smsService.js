// ─────────────────────────────────────────────────────────────────────────────
// smsService.js
//
// Twilio  → India (+91), UAE (+971), KSA (+966), Qatar (+974), Bahrain (+973), Oman (+968)
// Msegat  → UAE (+971), KSA (+966), Qatar (+974), Bahrain (+973), Oman (+968)  [no India]
// ─────────────────────────────────────────────────────────────────────────────

// Gulf countries supported by both providers
const GULF_PREFIXES = [
  { prefix: '+971', name: 'UAE',     localDigits: 9  },
  { prefix: '+966', name: 'KSA',     localDigits: 9  },
  { prefix: '+974', name: 'Qatar',   localDigits: 8  },
  { prefix: '+973', name: 'Bahrain', localDigits: 8  },
  { prefix: '+968', name: 'Oman',    localDigits: 8  },
];

// Twilio also allows India
const TWILIO_EXTRA_PREFIXES = [
  { prefix: '+91', name: 'India', localDigits: 10 },
];

const ALL_TWILIO_PREFIXES  = [...GULF_PREFIXES, ...TWILIO_EXTRA_PREFIXES];
const ALL_MSEGAT_PREFIXES  = GULF_PREFIXES;

/**
 * Normalise a phone number to E.164.
 * Handles local formats for all supported countries.
 */
export const normalisePhone = (raw) => {
  if (!raw) return null;
  let n = String(raw).replace(/[\s\-().]/g, '');

  // Already valid E.164
  if (/^\+\d{7,15}$/.test(n)) return n;

  // 00-prefixed international
  if (/^00\d{7,14}$/.test(n)) return '+' + n.slice(2);

  // Bare prefix without +
  if (/^971\d{8,9}$/.test(n))  return '+' + n; // UAE
  if (/^966\d{8,9}$/.test(n))  return '+' + n; // KSA
  if (/^974\d{7,8}$/.test(n))  return '+' + n; // Qatar
  if (/^973\d{7,8}$/.test(n))  return '+' + n; // Bahrain
  if (/^968\d{7,8}$/.test(n))  return '+' + n; // Oman
  if (/^91\d{10}$/.test(n))    return '+' + n; // India

  // Gulf local: 05xxxxxxxx or 5xxxxxxxx (UAE default for ambiguous)
  if (/^05\d{8}$/.test(n))  return '+971' + n.slice(1);
  if (/^5\d{8}$/.test(n))   return '+971' + n;

  // Qatar/Bahrain/Oman local 8-digit starting with 3, 6, 7, 9
  if (/^[3679]\d{7}$/.test(n)) return '+974' + n; // assume Qatar

  // India local: 10-digit starting with 6–9
  if (/^[6-9]\d{9}$/.test(n)) return '+91' + n;

  return null;
};

/**
 * Check if a number is allowed for the given provider.
 */
export const isAllowedForProvider = (e164, provider) => {
  if (!e164) return false;
  const prefixes = provider === 'twilio' ? ALL_TWILIO_PREFIXES : ALL_MSEGAT_PREFIXES;
  return prefixes.some(p => e164.startsWith(p.prefix));
};

/**
 * Human-readable list of supported countries for each provider.
 */
export const getSupportedCountries = (provider) => {
  if (provider === 'twilio') return 'UAE, KSA, Qatar, Bahrain, Oman, India';
  return 'UAE, KSA, Qatar, Bahrain, Oman';
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementations
// ─────────────────────────────────────────────────────────────────────────────

const sendViaTwilio = async ({ accountSid, authToken, fromNumber }, to, body) => {
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials incomplete (Account SID, Auth Token, From Number required).');
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`);
  return { sid: data.sid };
};

const sendViaMsegat = async ({ userName, apiKey, userSender }, to, body) => {
  if (!userName || !apiKey || !userSender) {
    throw new Error('Msegat credentials incomplete (Username, API Key, Sender ID required).');
  }
  const res = await fetch('https://www.msegat.com/gw/sendsms.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName, apiKey, userSender,
      numbers: to.replace(/^\+/, ''),
      msg: body,
      msgEncoding: 'UTF8',
    }),
  });
  const text = await res.text();
  const errors = {
    'M0001': 'Invalid username/password',
    'M0002': 'Sender ID not active',
    'M0003': 'Invalid mobile number',
    'M0004': 'Insufficient balance',
  };
  if (text.trim() !== '1') throw new Error(errors[text.trim()] || `Msegat error: ${text.trim()}`);
  return { code: text.trim() };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export const sendCouponSms = async (settings, phone, couponCode, profileName) => {
  try {
    const e164 = normalisePhone(phone);
    if (!e164) {
      return { success: false, error: 'Could not recognise the phone number. Enter it with country code, e.g. +91xxxxxxxxxx or +971xxxxxxxxx.' };
    }

    const provider = settings.smsProvider || 'twilio';

    if (!isAllowedForProvider(e164, provider)) {
      const supported = getSupportedCountries(provider);
      return { success: false, error: `${provider === 'msegat' ? 'Msegat' : 'Twilio'} supports: ${supported} only.` };
    }

    const message =
      `Your ${profileName || 'internet access'} coupon code is: ${couponCode}\n` +
      `This code activates your session. Do not share it with others.`;

    if (provider === 'twilio') {
      await sendViaTwilio(
        { accountSid: settings.twilioAccountSid, authToken: settings.twilioAuthToken, fromNumber: settings.twilioFromNumber },
        e164, message,
      );
    } else {
      await sendViaMsegat(
        { userName: settings.msegatUserName, apiKey: settings.msegatApiKey, userSender: settings.msegatSenderName },
        e164, message,
      );
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'SMS send failed.' };
  }
};
