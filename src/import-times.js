import { getWorldbookNames } from "./compat.js";

// ========== 【功能：世界书导入时间记录】工具函数 开始 ==========
// 酒馆接口拿不到世界书文件的真实创建时间，所以脚本自己记账：
// 第一次见到某本书就记下当时时间，之后"按导入时间排序"就看这本账
const LULU_WB_IMPORT_TIME_KEY = "lulu_wb_import_times";
const getWbImportTimes = () => {
  try {
    const obj = JSON.parse(
      localStorage.getItem(LULU_WB_IMPORT_TIME_KEY) || "{}",
    );
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
};
// 拿当前书单对账：新书补记"现在"（同一批按名单顺序错开 1ms，保证次序稳定），已删除的书清掉
const syncWbImportTimes = (currentNames) => {
  const names = Array.isArray(currentNames) ? currentNames : [];
  const times = getWbImportTimes();
  const now = Date.now();
  let changed = false;
  names.forEach((n, i) => {
    if (times[n] === undefined) {
      times[n] = now + i;
      changed = true;
    }
  });
  Object.keys(times).forEach((n) => {
    if (!names.includes(n)) {
      delete times[n];
      changed = true;
    }
  });
  if (changed)
    localStorage.setItem(LULU_WB_IMPORT_TIME_KEY, JSON.stringify(times));
  return times;
};
// 脚本加载时先记一笔，之后每次渲染面板都会再对账
try {
  if (typeof getWorldbookNames === "function")
    syncWbImportTimes(getWorldbookNames());
} catch (e) {}
// ========== 【功能：世界书导入时间记录】工具函数 结束 ==========

export { LULU_WB_IMPORT_TIME_KEY, getWbImportTimes, syncWbImportTimes };
