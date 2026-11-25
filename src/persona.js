import { getContext } from "./compat.js";

const formatPositionBadge = (pos) => {
  if (!pos) return "📍未知位置 | 🔢100";
  const posMap = {
    before_character_definition: "前:角色定义",
    after_character_definition: "后:角色定义",
    before_example_messages: "前:示例消息",
    after_example_messages: "后:示例消息",
    before_author_note: "前:作者注释",
    after_author_note: "后:作者注释",
  };
  let typeStr = pos.type || "at_depth";
  if (typeStr === "at_depth" || typeStr === "outlet") {
    const roleIcon =
      pos.role === "user"
        ? "👤用户"
        : pos.role === "assistant"
          ? "🤖助手"
          : "⚙️系统";
    return `🌊深度[${roleIcon}]: ${pos.depth || 0} | 🔢${pos.order || 100}`;
  }
  return `📍${posMap[typeStr] || typeStr} | 🔢${pos.order || 100}`;
};

const getCurrentPersonaId = (ctx, pus) => {
  if (!pus) return null;
  if (ctx.chatMetadata && ctx.chatMetadata.persona)
    return ctx.chatMetadata.persona;
  if (pus.default_persona) return pus.default_persona;
  if (pus.personas && ctx.name1) {
    for (let [id, name] of Object.entries(pus.personas)) {
      if (name === ctx.name1) return id;
    }
  }
  return null;
};

const getPersonaWbs = () => {
  const books = [];
  try {
    const ctx =
      typeof SillyTavern !== "undefined"
        ? SillyTavern.getContext()
        : typeof getContext === "function"
          ? getContext()
          : {};
    const pus = ctx.powerUserSettings || {};
    if (pus.persona_description_lorebook)
      books.push(pus.persona_description_lorebook);
    const activeId = getCurrentPersonaId(ctx, pus);
    if (
      activeId &&
      pus.persona_descriptions &&
      pus.persona_descriptions[activeId]
    ) {
      if (pus.persona_descriptions[activeId].lorebook)
        books.push(pus.persona_descriptions[activeId].lorebook);
    }
  } catch (e) {
    console.error("Lù-chan: 读取 Persona 世界书出现了一点小意外呢", e);
  }
  return [...new Set(books)].filter(
    (b) => typeof b === "string" && b.trim() !== "",
  );
};

const rebindPersonaWorldbook = async (newWbName, oldWbToUnbind = null) => {
  const ctx =
    typeof SillyTavern !== "undefined"
      ? SillyTavern.getContext()
      : typeof getContext === "function"
        ? getContext()
        : {};
  const pus = ctx.powerUserSettings;
  if (!pus) return;

  if (newWbName !== null) pus.persona_description_lorebook = newWbName || "";
  else if (oldWbToUnbind && pus.persona_description_lorebook === oldWbToUnbind)
    pus.persona_description_lorebook = "";

  const activeId = getCurrentPersonaId(ctx, pus);
  if (
    activeId &&
    pus.persona_descriptions &&
    pus.persona_descriptions[activeId]
  ) {
    if (newWbName !== null) {
      pus.persona_descriptions[activeId].lorebook = newWbName || "";
    } else if (
      oldWbToUnbind &&
      pus.persona_descriptions[activeId].lorebook === oldWbToUnbind
    ) {
      pus.persona_descriptions[activeId].lorebook = "";
    }
  } else if (oldWbToUnbind) {
    if (pus.persona_descriptions && pus.personas) {
      for (let [id, desc] of Object.entries(pus.persona_descriptions)) {
        if (pus.personas[id] === ctx.name1 && desc.lorebook === oldWbToUnbind)
          desc.lorebook = "";
      }
    }
  }

  if (typeof ctx.saveSettingsDebounced === "function")
    await ctx.saveSettingsDebounced();
  if (typeof $("#persona_lore_button").toggleClass === "function")
    $("#persona_lore_button").toggleClass("world_set", !!newWbName);
};


export { formatPositionBadge, getCurrentPersonaId, getPersonaWbs, rebindPersonaWorldbook };
