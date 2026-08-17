// ---------- Amount in words ----------
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function threeDigitsToWords(n) {
  let s = "";
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) s += ONES[n] + " ";
  return s.trim();
}
function numberToWords(num) {
  num = Math.round(num);
  if (num === 0) return "Zero";
  const units = ["", "Thousand", "Million", "Billion"];
  let groups = [];
  let n = num;
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  let parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] > 0)
      parts.push(
        threeDigitsToWords(groups[i]) + (units[i] ? " " + units[i] : "")
      );
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
const CURRENCY_NAMES = {
  GHS: "Ghana Cedis",
  USD: "US Dollars",
  EUR: "Euros",
  GBP: "British Pounds",
  ZAR: "South African Rand",
  NGN: "Nigerian Naira",
};

const MINOR_UNIT_NAMES = {
  GHS: "Pesewas",
  USD: "Cents",
  EUR: "Cents",
  GBP: "Pence",
  ZAR: "Cents",
  NGN: "Kobo",
};

export function amountInWords(amount, currency) {
  const safeCurrency = String(currency ?? "GHS").toUpperCase();
  const whole = Math.floor(Math.abs(amount));
  const minorUnits = Math.round((Math.abs(amount) - whole) * 100);
  const currencyName =
    CURRENCY_NAMES[safeCurrency] ?? `${safeCurrency || "Unknown"} Currency`;
  const minorUnitName =
    MINOR_UNIT_NAMES[safeCurrency] ?? "Minor Units";

  let words = numberToWords(whole) + " " + currencyName;
  if (minorUnits > 0) words += " and " + numberToWords(minorUnits) + " " + minorUnitName;
  return words + " Only";
}


