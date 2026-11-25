import { getVariables, updateVariablesWith } from "./compat.js";

let globalBindingMapCache = {};
const setGlobalBindingMapCache = (v) => {
  globalBindingMapCache = v;
};
// ✨ 【全局】已提取的卡内原版记号（供批量提取 & 单卡体检共用，避免重复建书）
window.luluGetExtractedMap = () => {
  try {
    return JSON.parse(
      localStorage.getItem("lulu_wb_extracted_originals") || "{}",
    );
  } catch (e) {
    return {};
  }
};
window.luluMarkExtracted = (avatar, bookName, newName) => {
  const map = window.luluGetExtractedMap();
  map[`${avatar}||${bookName}`] = newName;
  localStorage.setItem("lulu_wb_extracted_originals", JSON.stringify(map));
};
window.luluGetExtractedName = (avatar, bookName) => {
  const map = window.luluGetExtractedMap();
  return map[`${avatar}||${bookName}`] || null;
};
// ========== 【性能】全局变量缓存层：避免每次读取都深拷贝整棵变量树 ==========
// 读：第一次访问时取一次并存起来；写：任何写入后缓存失效，下次读取自动拿新数据
let __luluGlobalVarsCache = null;
const luluGetGlobalVars = () => {
  if (__luluGlobalVarsCache === null) {
    __luluGlobalVarsCache = getVariables({ type: "global" });
  }
  return __luluGlobalVarsCache;
};
const luluInvalidateGlobalVars = () => {
  __luluGlobalVarsCache = null;
};
const luluUpdateGlobalVars = (updater, options) => {
  const result = updateVariablesWith(updater, options || { type: "global" });
  // ✨【性能】同步 updater 的返回值就是最新变量表，直接拿来当缓存，
  //    不再把缓存置空（否则下次读取又要深拷贝整棵变量树，快照多的时候很疼）
  if (result && typeof result.then === "function") {
    __luluGlobalVarsCache = null;
  } else {
    __luluGlobalVarsCache = result;
  }
  return result;
};

const getWbUiGroups = () => {
  let vars = luluGetGlobalVars();
  let map = vars.lulu_wb_ui_groups;
  if (typeof map === "string") {
    try {
      map = JSON.parse(map);
    } catch (e) {
      map = {};
    }
  }
  return map && typeof map === "object" ? map : {};
};
const saveWbUiGroups = (obj) => {
  luluUpdateGlobalVars(
    (v) => {
      v.lulu_wb_ui_groups = obj;
      return v;
    },
    { type: "global" },
  );
};
const getEntryUiGroup = (wbName, uid, entry = null) => {
  const map = getWbUiGroups();
  if (map[wbName] && map[wbName][uid]) return map[wbName][uid];
  if (entry && entry.extensions && entry.extensions.lulu_group)
    return entry.extensions.lulu_group;
  return "";
};

let isEntryBatchMode = false;
const setIsEntryBatchMode = (v) => {
  isEntryBatchMode = v;
};
let entryBatchSelected = new Set();

export { globalBindingMapCache, setGlobalBindingMapCache, __luluGlobalVarsCache, luluGetGlobalVars, luluInvalidateGlobalVars, luluUpdateGlobalVars, getWbUiGroups, saveWbUiGroups, getEntryUiGroup, isEntryBatchMode, setIsEntryBatchMode, entryBatchSelected };
