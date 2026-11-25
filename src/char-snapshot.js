import { getCharWorldbookNames, getContext, getCurrentCharacterName, getWorldbook, getWorldbookNames, rebindCharWorldbooks, replaceWorldbook, saveMetadata } from "./compat.js";
import { luluGetGlobalVars, luluUpdateGlobalVars } from "./state.js";

// ========== 【功能9：角色快照绑定聊天 & 原地更新】工具函数 开始 ==========
const LULU_CHAT_SNAP_BIND_KEY = "lulu_bound_char_snapshot";
// 读取当前聊天绑定的角色快照（存 chat_metadata，天然跟随单个聊天存档）
const luluGetChatSnapBinding = () => {
  try {
    const ctx =
      typeof SillyTavern !== "undefined"
        ? SillyTavern.getContext()
        : typeof getContext === "function"
          ? getContext()
          : {};
    const meta =
      ctx.chatMetadata ||
      (typeof chat_metadata !== "undefined" ? chat_metadata : null);
    if (!meta) return null;
    const b = meta[LULU_CHAT_SNAP_BIND_KEY];
    if (!b || typeof b !== "object" || !b.snapName) return null;
    return { charName: b.charName || "", snapName: b.snapName };
  } catch (e) {
    return null;
  }
};
// 写入/清除当前聊天的快照绑定（snapName 传 null 即解绑）
const luluSetChatSnapBinding = async (charName, snapName) => {
  const ctx =
    typeof SillyTavern !== "undefined"
      ? SillyTavern.getContext()
      : typeof getContext === "function"
        ? getContext()
        : {};
  const meta =
    ctx.chatMetadata ||
    (typeof chat_metadata !== "undefined" ? chat_metadata : null);
  if (!meta) throw new Error("当前没有打开任何聊天，无法绑定哦~");
  if (snapName) meta[LULU_CHAT_SNAP_BIND_KEY] = { charName, snapName };
  else delete meta[LULU_CHAT_SNAP_BIND_KEY];
  if (typeof ctx.saveMetadata === "function") await ctx.saveMetadata();
  else if (typeof saveMetadata === "function") await saveMetadata();
};
// 安全读取当前角色名（未开聊天/群聊时可能是 null 或群名）
const luluGetCurrentCharNameSafe = () => {
  try {
    if (typeof getCurrentCharacterName === "function")
      return getCurrentCharacterName();
    if (typeof SillyTavern !== "undefined")
      return SillyTavern.getContext().name2;
  } catch (e) {}
  return null;
};
// 读取当前角色绑定的所有世界书名
const luluGetCharBoundBookNames = () => {
  let obj = { primary: null, additional: [] };
  try {
    if (typeof getCharWorldbookNames === "function")
      obj = getCharWorldbookNames("current") || obj;
  } catch (e) {}
  const list = [];
  if (obj.primary) list.push(obj.primary);
  if (obj.additional) list.push(...obj.additional);
  return list;
};
// ✨【修复】安全改绑角色世界书：角色身上可能残留"已被删除/改名"的失效书，
// 直接把这些旧名字传给 rebindCharWorldbooks 会触发"未找到以下世界书"报错，导致解绑/绑定全部卡死。
// 这里先把不存在的书从目标配置里过滤掉再提交，顺带把角色卡上的失效绑定清干净。
const luluRebindCharWorldbooksSafe = async (target, config) => {
  let primary = config ? config.primary : null;
  let additional = config && Array.isArray(config.additional) ? [...config.additional] : [];
  let dropped = [];
  try {
    if (typeof getWorldbookNames === "function") {
      const existing = new Set(getWorldbookNames());
      if (primary && !existing.has(primary)) {
        dropped.push(primary);
        primary = null;
      }
      const kept = [];
      additional.forEach((wb) => {
        if (existing.has(wb)) kept.push(wb);
        else dropped.push(wb);
      });
      additional = kept;
    }
  } catch (e) {}
  if (typeof rebindCharWorldbooks === "function") {
    await rebindCharWorldbooks(target, { primary, additional });
  }
  if (dropped.length > 0 && typeof toastr !== "undefined") {
    toastr.warning(
      `角色身上还挂着 [${dropped.join(", ")}] 这些已经不存在的世界书，已顺手帮你清理掉啦~`,
    );
  }
};
// 抓取当前绑定书的启用条目状态（角色快照数据格式：{ 书名: [uid...] }）
const luluCaptureCharSnapData = async (boundBooks) => {
  const data = {};
  for (const wb of boundBooks) {
    let entries;
    try {
      entries = await getWorldbook(wb);
    } catch (e) {
      throw new Error(
        `读取世界书【${wb}】失败（${e.message}）。这本书可能已被删除或改名，但还绑在角色身上，请先去「分配卡片/用户档案」页面解绑它再试~`,
      );
    }
    if (!Array.isArray(entries)) {
      throw new Error(
        `世界书【${wb}】读取结果异常，它可能已被删除或改名，但还绑在角色身上，请先去「分配卡片/用户档案」页面解绑它再试~`,
      );
    }
    data[wb] = entries.filter((e) => e.enabled).map((e) => e.uid);
  }
  return data;
};
// 把角色快照数据应用到当前绑定书上，返回 { ok, missing, failed }
const luluApplyCharSnapData = async (snapData, boundBooks) => {
  const snapWbNames = Object.keys(snapData);
  const missing = snapWbNames.filter((wb) => !boundBooks.includes(wb));
  if (missing.length === snapWbNames.length)
    return { ok: false, missing, failed: [] };
  const failed = [];
  for (const wb of boundBooks) {
    let entries;
    try {
      entries = await getWorldbook(wb);
    } catch (e) {
      failed.push(wb);
      continue;
    }
    if (!Array.isArray(entries)) {
      failed.push(wb);
      continue;
    }
    let changed = false;
    const targetUIDs = snapData[wb] || [];
    entries.forEach((entry) => {
      const should = targetUIDs.includes(entry.uid);
      if (entry.enabled !== should) {
        entry.enabled = should;
        changed = true;
      }
    });
    if (changed) {
      try {
        await replaceWorldbook(wb, entries);
      } catch (e) {
        failed.push(wb);
      }
    }
  }
  return { ok: true, missing, failed };
};
// 判断角色快照当前是否正生效
const luluIsCharSnapActiveNow = async (snapData, boundBooks) => {
  const snapWbNames = Object.keys(snapData);
  for (const wb of snapWbNames) {
    if (!boundBooks.includes(wb)) return false;
  }
  for (const wb of boundBooks) {
    let entries;
    try {
      entries = await getWorldbook(wb);
    } catch (e) {
      return false;
    }
    if (!Array.isArray(entries)) return false;
    const enabledUIDs = entries
      .filter((e) => e.enabled)
      .map((e) => e.uid)
      .sort();
    const targetUIDs = [...(snapData[wb] || [])].sort();
    if (
      enabledUIDs.length !== targetUIDs.length ||
      !enabledUIDs.every((v, idx) => v === targetUIDs[idx])
    )
      return false;
  }
  return true;
};
// 进入聊天时：自动应用本聊天绑定的角色快照
const luluAutoApplyBoundChatSnapshot = async () => {
  try {
    const binding = luluGetChatSnapBinding();
    if (!binding) return;
    const charName = luluGetCurrentCharNameSafe();
    if (!charName || charName !== binding.charName) return;
    let charSnaps = luluGetGlobalVars().wb_char_snapshots;
    if (typeof charSnaps === "string") {
      try {
        charSnaps = JSON.parse(charSnaps);
      } catch (e) {
        charSnaps = {};
      }
    }
    if (!charSnaps || typeof charSnaps !== "object" || Array.isArray(charSnaps))
      charSnaps = {};
    const snapData =
      charSnaps[charName] && charSnaps[charName][binding.snapName];
    if (!snapData) {
      // 绑定的快照已经被删了 → 自动解绑，免得每次进聊天都扑空
      await luluSetChatSnapBinding(charName, null);
      if (typeof toastr !== "undefined")
        toastr.warning(
          `本聊天绑定的角色快照【${binding.snapName}】已经不存在啦，已自动解绑~`,
        );
      return;
    }
    const boundBooks = luluGetCharBoundBookNames();
    if (boundBooks.length === 0) return;
    // 已经生效就安静跳过，不刷屏也不重复写书
    if (await luluIsCharSnapActiveNow(snapData, boundBooks)) return;
    const { ok, missing, failed } = await luluApplyCharSnapData(
      snapData,
      boundBooks,
    );
    if (typeof toastr !== "undefined") {
      if (ok) {
        toastr.success(
          `🔗 已自动应用本聊天绑定的角色快照【${binding.snapName}】~`,
        );
        if (missing.length > 0)
          toastr.warning(
            `快照里的 [${missing.join(", ")}] 当前没绑定在角色身上，这几本无法复原~`,
          );
        if (failed.length > 0)
          toastr.warning(
            `世界书 [${failed.join(", ")}] 读取/写入失败（可能已被删除但还绑在角色身上），这几本未能复原~`,
          );
      } else {
        toastr.error(
          `本聊天绑定的快照【${binding.snapName}】应用失败：当前角色没有绑定快照里的任何世界书(＞﹏＜)`,
        );
      }
    }
  } catch (e) {
    console.error("Lulu 快照自动应用出错", e);
  }
};
// 原地更新角色快照：用当前条目状态覆盖旧快照（可顺便改名）
const luluUpdateCharSnapshotFlow = async (charName, oldName, onDone) => {
  try {
    const boundBooks = luluGetCharBoundBookNames();
    if (boundBooks.length === 0)
      return toastr.warning("当前角色没有绑定任何世界书，无法更新快照哦~");
    const inputName = await SillyTavern.callGenericPopup(
      `将把角色当前世界书的条目开关状态保存进这个快照。<br>保持原名 = 直接覆盖更新；改成新名字 = 用当前状态另存并移除旧快照。`,
      SillyTavern.POPUP_TYPE.INPUT,
      oldName,
    );
    if (!inputName || !inputName.trim()) return;
    const newName = inputName.trim();
    const newSnapData = await luluCaptureCharSnapData(boundBooks);
    let charSnaps = luluGetGlobalVars().wb_char_snapshots;
    if (typeof charSnaps === "string") {
      try {
        charSnaps = JSON.parse(charSnaps);
      } catch (e) {
        charSnaps = {};
      }
    }
    if (!charSnaps || typeof charSnaps !== "object" || Array.isArray(charSnaps))
      charSnaps = {};
    const mySnaps = charSnaps[charName] || {};
    if (newName !== oldName && mySnaps[newName]) {
      const overRes = await SillyTavern.callGenericPopup(
        `名字【${newName}】已经被别的快照占用了哦！要用当前状态把它也覆盖掉吗？`,
        SillyTavern.POPUP_TYPE.CONFIRM,
      );
      if (overRes !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) return;
    }
    luluUpdateGlobalVars(
      (v) => {
        if (typeof v.wb_char_snapshots === "string") {
          try {
            v.wb_char_snapshots = JSON.parse(v.wb_char_snapshots);
          } catch (e) {
            v.wb_char_snapshots = {};
          }
        }
        if (
          !v.wb_char_snapshots ||
          typeof v.wb_char_snapshots !== "object" ||
          Array.isArray(v.wb_char_snapshots)
        )
          v.wb_char_snapshots = {};
        if (!v.wb_char_snapshots[charName]) v.wb_char_snapshots[charName] = {};
        if (newName !== oldName) delete v.wb_char_snapshots[charName][oldName];
        v.wb_char_snapshots[charName][newName] = newSnapData;
        return v;
      },
      { type: "global" },
    );
    // 本聊天若绑定的是旧名 → 绑定跟着新名走
    const binding = luluGetChatSnapBinding();
    if (
      binding &&
      binding.charName === charName &&
      binding.snapName === oldName &&
      newName !== oldName
    ) {
      try {
        await luluSetChatSnapBinding(charName, newName);
      } catch (e) {}
    }
    toastr.success(
      newName === oldName
        ? `✨ 快照【${newName}】已用当前状态更新覆盖！`
        : `✨ 已把当前状态存为【${newName}】，旧快照【${oldName}】已移除~`,
    );
    // 刷新列表单独兜底：就算刷新出岔子，也不谎报"更新失败"（快照其实已存好）
    if (typeof onDone === "function") {
      try {
        await onDone();
      } catch (e2) {
        console.error("Lulu 更新快照后刷新列表失败", e2);
      }
    }
  } catch (e) {
    toastr.error("更新快照失败：" + (e && e.message ? e.message : e));
  }
};
// ========== 【功能9：角色快照绑定聊天 & 原地更新】工具函数 结束 ==========


export { LULU_CHAT_SNAP_BIND_KEY, luluGetChatSnapBinding, luluSetChatSnapBinding, luluGetCurrentCharNameSafe, luluGetCharBoundBookNames, luluRebindCharWorldbooksSafe, luluCaptureCharSnapData, luluApplyCharSnapData, luluIsCharSnapActiveNow, luluAutoApplyBoundChatSnapshot, luluUpdateCharSnapshotFlow };
