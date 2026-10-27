const CLASSES: Record<string, string> = {
  a: "aàáảãạăằắẳẵặâầấẩẫậAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ",
  e: "eèéẻẽẹêềếểễệEÈÉẺẼẸÊỀẾỂỄỆ",
  i: "iìíỉĩịIÌÍỈĨỊ",
  o: "oòóỏõọôồốổỗộơờớởỡợOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ",
  u: "uùúủũụưừứửữựUÙÚỦŨỤƯỪỨỬỮỰ",
  y: "yỳýỷỹỵYỲÝỶỸỴ",
  d: "dđDĐ",
};

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

export function accentRegex(query: string): RegExp {
  let pattern = "";
  for (const char of fold(query)) {
    const group = CLASSES[char];
    if (group) pattern += `[${group}]`;
    else pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(pattern, "i");
}
