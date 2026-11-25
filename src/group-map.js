import { luluGetGlobalVars, luluUpdateGlobalVars } from "./state.js";
import { luluGetFreeEntryUid } from "./utils.js";

// ========== 【自定义前缀 + 对照表】工具函数 开始 ==========
// 对照表条目的固定标题标记（脚本靠它认出这是对照表，不是普通条目）
const LULU_MAP_ENTRY_TAG = "[LULU_GROUP_MAP]";

// 判断某个条目是不是"对照表条目"
const isLuluMapEntry = (entry) => {
  if (!entry) return false;
  const n = entry.name || entry.comment || "";
  return typeof n === "string" && n.indexOf(LULU_MAP_ENTRY_TAG) === 0;
};

// 从一整本世界书的条目数组里，读出对照表对象（前缀 -> 长分组名）
// 读不到就返回空对象 {}
const readGroupMapFromEntries = (entries) => {
  if (!Array.isArray(entries)) return {};
  const mapEntry = entries.find((e) => isLuluMapEntry(e));
  if (!mapEntry || !mapEntry.content) return {};
  try {
    const obj = JSON.parse(mapEntry.content);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
};

// 根据"前缀"反查"长分组名"；查不到就原样返回前缀本身（向下兼容）
const resolveGroupByPrefix = (prefixMap, prefix) => {
  if (!prefix) return "";
  if (prefixMap && prefixMap[prefix]) return prefixMap[prefix];
  return prefix;
};

// 根据"长分组名"正查"前缀"；查不到就返回长分组名本身（表示前缀=分组名）
const resolvePrefixByGroup = (prefixMap, groupName) => {
  if (!groupName) return "";
  if (prefixMap && typeof prefixMap === "object") {
    for (const [prefix, grp] of Object.entries(prefixMap)) {
      if (grp === groupName) return prefix;
    }
  }
  return groupName;
};
// —— 记住"每本书里，每个分组该用什么前缀" ——
// 存在全局变量 lulu_wb_group_prefix 里，结构：{ 世界书名: { 长分组名: 前缀 } }
const getGroupPrefixStore = () => {
  let vars = luluGetGlobalVars();
  let store = vars.lulu_wb_group_prefix;
  if (typeof store === "string") {
    try {
      store = JSON.parse(store);
    } catch (e) {
      store = {};
    }
  }
  return store && typeof store === "object" && !Array.isArray(store)
    ? store
    : {};
};
const saveGroupPrefixStore = (obj) => {
  luluUpdateGlobalVars(
    (v) => {
      v.lulu_wb_group_prefix = obj;
      return v;
    },
    { type: "global" },
  );
};
// 取某本书某个分组的前缀；没设过就默认返回分组名本身
const getGroupPrefix = (wbName, groupName) => {
  const store = getGroupPrefixStore();
  if (store[wbName] && store[wbName][groupName])
    return store[wbName][groupName];
  return groupName;
};
// 设置某本书某个分组的前缀
const setGroupPrefix = (wbName, groupName, prefix) => {
  const store = getGroupPrefixStore();
  if (!store[wbName]) store[wbName] = {};
  store[wbName][groupName] = prefix;
  saveGroupPrefixStore(store);
};
// —— 核心：根据当前所有条目，生成/更新/清理对照表条目 ——
// 传入某本书的条目数组(会直接修改它)，返回处理后的数组
// prefixMapUsed 是一个 {前缀: 长分组名} 对象，由外面收集好传进来
const syncMapEntryIntoEntries = (entries, prefixMapUsed) => {
  if (!Array.isArray(entries)) return entries;

  // 先找出已有的对照表条目（可能有，也可能没有）
  const mapIdx = entries.findIndex((e) => isLuluMapEntry(e));

  // 如果对照表内容为空（没有任何"前缀≠分组名"的映射），就不需要对照表条目
  const needMap = prefixMapUsed && Object.keys(prefixMapUsed).length > 0;

  if (!needMap) {
    // 不需要了 → 如果原来有对照表条目，删掉它
    if (mapIdx !== -1) entries.splice(mapIdx, 1);
    return entries;
  }

  // 需要对照表 → 生成内容
  const contentJson = JSON.stringify(prefixMapUsed);
  const mapName = LULU_MAP_ENTRY_TAG + " 请勿删除/开启（本插件分组数据）";

  if (mapIdx !== -1) {
    // 已有 → 更新它，并强制关闭
    const m = entries[mapIdx];
    m.name = mapName;
    m.comment = mapName;
    m.title = mapName;
    m.content = contentJson;
    m.enabled = false;
    m.disable = true;
    m.disabled = true;
    if (m.strategy) m.strategy.type = "constant";
    m._lulu_ui_group = "";
  } else {
    // 没有 → 新建一个关闭状态的条目
    entries.push({
      uid: luluGetFreeEntryUid(entries),
      name: mapName,
      comment: mapName,
      title: mapName,
      enabled: false,
      disable: true,
      disabled: true,
      content: contentJson,
      group: "",
      key: [],
      keys: [],
      _lulu_ui_group: "",
      strategy: { type: "constant", keys: [] },
      position: { type: "at_depth", role: "system", depth: 0, order: 100 },
      recursion: {
        prevent_incoming: true,
        prevent_outgoing: true,
        delay_until: null,
      },
      exclude_recursion: true,
      prevent_recursion: true,
    });
  }
  return entries;
};
// ========== 【自定义前缀 + 对照表】工具函数 结束 ==========

export { LULU_MAP_ENTRY_TAG, isLuluMapEntry, readGroupMapFromEntries, resolveGroupByPrefix, resolvePrefixByGroup, getGroupPrefixStore, saveGroupPrefixStore, getGroupPrefix, setGroupPrefix, syncMapEntryIntoEntries };
