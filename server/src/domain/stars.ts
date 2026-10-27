const SAO_NAM = ["mộc đức", "la hầu", "thổ tú", "thủy diệu", "thái bạch", "thái dương", "vân hán", "kế đô", "thái âm"];
const SAO_NU = ["la hầu", "kế đô", "vân hán", "mộc đức", "thái âm", "thái dương", "thổ tú", "thủy diệu", "thái bạch"];
const HAN = ["thiên la", "địa võng", "diêm vương", "huỳnh tiền", "tam kheo", "ngũ mộ", "thiên tinh", "tán tận"];

export function starName(age: number, female: boolean): string {
  const names = female ? SAO_NU : SAO_NAM;
  const index = ((age % 9) + 9) % 9;
  return names[index] ?? "";
}

export function hanName(age: number): string {
  const index = ((age % HAN.length) + HAN.length) % HAN.length;
  return HAN[index] ?? "";
}

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

export function readNumber(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999) return String(value);
  if (value < 10) return DIGITS[value] ?? String(value);
  if (value < 20) return value === 10 ? "mười" : `mười ${value === 15 ? "lăm" : DIGITS[value - 10]}`;
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const one = value % 10;
    const tenWord = `${DIGITS[ten]} mươi`;
    if (one === 0) return tenWord;
    if (one === 1) return `${tenWord} mốt`;
    if (one === 5) return `${tenWord} lăm`;
    return `${tenWord} ${DIGITS[one]}`;
  }
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  if (rest === 0) return `${DIGITS[hundred]} trăm`;
  if (rest < 10) return `${DIGITS[hundred]} trăm lẻ ${DIGITS[rest]}`;
  return `${DIGITS[hundred]} trăm ${readNumber(rest)}`;
}
