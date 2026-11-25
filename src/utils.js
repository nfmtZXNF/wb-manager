
// ========== 【通用】分配新条目 UID（模仿酒馆原生 getFreeWorldEntryUid） ==========
const luluGetFreeEntryUid = (entries) => {
  const used = new Set();
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (e && (typeof e.uid === "number" || typeof e.uid === "string")) {
      const uidNum = Number(e.uid);
      if (Number.isInteger(uidNum) && uidNum >= 0) used.add(uidNum);
    }
  });
  let uid = 0;
  while (used.has(uid)) uid++;
  return uid;
};
// ========== 【性能】中文排序比较器：Intl.Collator 实例只建一次，反复复用 ==========
const luluZhCollator = new Intl.Collator("zh-CN");
const luluZhCompare = (a, b) => luluZhCollator.compare(a, b);
// ========== 【通用】长任务互斥锁：防止弹窗里连点造成重复执行 ==========
const luluBusyTasks = new Set();
const luluTryStartTask = (key) => {
  if (luluBusyTasks.has(key)) return false;
  luluBusyTasks.add(key);
  return true;
};
const luluEndTask = (key) => {
  luluBusyTasks.delete(key);
};
// ========== 【通用】稳定序列化：键序无关，专用于"内容是否被改过"的对比 ==========
const luluStableStringify = (obj) => {
  const normalize = (o, seen) => {
    if (Array.isArray(o)) return o.map((v) => normalize(v, seen));
    if (o && typeof o === "object") {
      if (seen.has(o)) return null; // 防循环引用
      seen.add(o);
      const out = {};
      Object.keys(o)
        .sort()
        .forEach((k) => {
          const v = o[k];
          if (v === undefined || typeof v === "function") return;
          out[k] = normalize(v, seen);
        });
      seen.delete(o);
      return out;
    }
    return o;
  };
  return JSON.stringify(normalize(obj, new WeakSet()));
};
// ========== 【通用】#rrggbb + 透明度(0-100) 转 rgba 字符串（全脚本统一用这一份） ==========
const luluHexToRgba = (hex, alpha) => {
  let r = 0,
    g = 0,
    b = 0;
  if (hex && hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha / 100})`;
};

export { luluGetFreeEntryUid, luluZhCollator, luluZhCompare, luluBusyTasks, luluTryStartTask, luluEndTask, luluStableStringify, luluHexToRgba };
