const token = new URL(location.href).searchParams.get("token") || sessionStorage.getItem("studio-token");
if (token) sessionStorage.setItem("studio-token", token);

const state = { content: null, selectedIndex: 0, selectedMediaIndex: 0, selectedBlogIndex: 0, dirty: false };
const form = document.querySelector("#project-form");
const mediaForm = document.querySelector("#media-form");
const blogForm = document.querySelector("#blog-form");
const homepageForm = document.querySelector("#homepage-form");
const status = document.querySelector("#status");
const defaultTransmissionSettings = {
  header: [],
  ego: [],
  shadow: [],
  typingSpeed: 65,
  commaPause: 300,
  sentencePause: 1000,
  phrasePause: 100,
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-studio-token": token || "",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#d44832" : "";
}

function currentProject() {
  return state.content.projects[state.selectedIndex];
}

function currentBlogPost() {
  return state.content.blog[state.selectedBlogIndex];
}

function currentMediaItem() {
  return state.content.media[state.selectedMediaIndex];
}

function refreshMediaDatalist() {
  document.querySelector("#media-id-list").replaceChildren(
    ...state.content.media.map((item) => new Option(`${item.title} / ${item.type}`, item.id)),
  );
}

function commitMediaFormToState() {
  const item = currentMediaItem();
  if (!item) return;
  const data = new FormData(mediaForm);
  Object.assign(item, {
    id: String(data.get("id") || "").trim().toLowerCase(),
    type: String(data.get("type") || "image"),
    title: String(data.get("title") || "").trim(),
    sourcePath: String(data.get("sourcePath") || "").trim(),
    externalUrl: String(data.get("externalUrl") || "").trim(),
    projectId: String(data.get("projectId") || "").trim().toLowerCase(),
    sectionId: String(data.get("sectionId") || "").trim().toLowerCase(),
    caption: String(data.get("caption") || ""),
    alt: String(data.get("alt") || "").trim(),
    credits: String(data.get("credits") || "").trim(),
    posterFrame: String(data.get("posterFrame") || "").trim(),
    fileSize: Number(data.get("fileSize")) || 0,
    fullscreenEligible: mediaForm.elements.namedItem("fullscreenEligible").checked,
  });
}

function fillMediaForm() {
  const item = currentMediaItem();
  if (!item) return;
  for (const [name, value] of Object.entries(item)) {
    const field = mediaForm.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value !== false;
    else field.value = value ?? "";
  }
  document.querySelector("#media-editor-title").textContent = item.title || "MEDIA.RECORD";
}

function renderMediaList() {
  const list = document.querySelector("#media-list");
  list.replaceChildren();
  state.content.media.forEach((item, index) => {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-entry${index === state.selectedMediaIndex ? " is-active" : ""}`;
    button.append(Object.assign(document.createElement("span"), { textContent: String(index + 1).padStart(3, "0") }), Object.assign(document.createElement("span"), { textContent: item.title || item.id }), Object.assign(document.createElement("small"), { textContent: `${item.type || "MEDIA"} / ${item.projectId || "UNASSIGNED"}`.toUpperCase() }));
    button.addEventListener("click", () => {
      commitMediaFormToState();
      state.selectedMediaIndex = index;
      renderMediaList();
      fillMediaForm();
    });
    row.append(button);
    list.append(row);
  });
}

function transmissionLines(selector, preserveWhitespace = false) {
  return document.querySelector(selector).value
    .split(/\r?\n/)
    .map((line) => preserveWhitespace ? line : line.trim())
    .filter((line) => line.trim().length > 0);
}

function commitTransmissionSettings() {
  state.content.transmissions = {
    header: transmissionLines("#transmission-header", true),
    ego: transmissionLines("#transmission-ego"),
    shadow: transmissionLines("#transmission-shadow"),
    typingSpeed: Number(document.querySelector("#transmission-typing-speed").value) || 65,
    commaPause: Number(document.querySelector("#transmission-comma-pause").value) || 0,
    sentencePause: Number(document.querySelector("#transmission-sentence-pause").value) || 0,
    phrasePause: Number(document.querySelector("#transmission-phrase-pause").value) || 0,
  };
}

function fillTransmissionSettings() {
  const transmissions = { ...defaultTransmissionSettings, ...(state.content.transmissions || {}) };
  document.querySelector("#transmission-header").value = (transmissions.header || []).join("\n");
  document.querySelector("#transmission-ego").value = (transmissions.ego || []).join("\n");
  document.querySelector("#transmission-shadow").value = (transmissions.shadow || []).join("\n");
  document.querySelector("#transmission-typing-speed").value = transmissions.typingSpeed;
  document.querySelector("#transmission-comma-pause").value = transmissions.commaPause;
  document.querySelector("#transmission-sentence-pause").value = transmissions.sentencePause;
  document.querySelector("#transmission-phrase-pause").value = transmissions.phrasePause;
}

function newBlockId() {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now().toString(36);
  return `block-${suffix}`;
}

function createBlockCard(block = {}, index = 0) {
  const card = document.createElement("article");
  card.className = "block-card";
  card.dataset.blockId = block.id || newBlockId();
  card.innerHTML = `
    <div class="block-card__title">
      <span data-block-number>BLOCK ${String(index + 1).padStart(2, "0")}</span>
      <div>
        <button type="button" data-block-action="up">[↑]</button>
        <button type="button" data-block-action="down">[↓]</button>
        <button type="button" data-block-action="delete">[DELETE]</button>
      </div>
    </div>
    <div class="block-card__fields">
      <label>TYPE<select data-block-field="type"><option value="text">TEXT</option><option value="signal">SIGNAL / METRICS</option><option value="image">IMAGE</option><option value="video">VIDEO</option><option value="youtube">YOUTUBE</option><option value="vimeo">VIMEO</option><option value="link">EXTERNAL LINK</option><option value="project-link">PROJECT LINK</option></select></label>
      <label>WIDTH<select data-block-field="width"><option value="full">FULL / 6 OF 6</option><option value="half">HALF / 3 OF 6</option><option value="third">THIRD / 2 OF 6</option></select></label>
      <label>MEDIA FIT<select data-block-field="fit"><option value="cover">COVER</option><option value="contain">CONTAIN</option></select></label>
      <label class="wide">HEADING<input data-block-field="heading" /></label>
      <label class="wide">BODY / CAPTION<textarea data-block-field="body" rows="5"></textarea></label>
      <label class="wide">MEDIA SOURCE / YOUTUBE LINK<input data-block-field="source" /></label>
      <label class="wide">CANONICAL MEDIA ID<input data-block-field="mediaRef" list="media-id-list" /></label>
      <label>LINK URL<input data-block-field="href" /></label>
      <label>LINK LABEL / METRICS<textarea data-block-field="label" rows="3" placeholder="1.6M|VIEWS&#10;1,548|UPVOTES"></textarea></label>
      <label class="wide">PROJECT LINK ID<input data-block-field="projectId" /></label>
      <label class="wide">IMAGE ALT TEXT<input data-block-field="alt" /></label>
      <label class="wide">COPY BLOCK MEDIA<div class="media-row"><input class="block-file" type="file" accept="image/*,video/*" /><span></span><button type="button" data-block-action="upload">[COPY FILE]</button></div></label>
    </div>`;
  ["type", "width", "fit", "heading", "body", "source", "mediaRef", "href", "label", "projectId", "alt"].forEach((fieldName) => {
    const field = card.querySelector(`[data-block-field="${fieldName}"]`);
    field.value = block[fieldName] || ({ type: "text", width: "full", fit: "cover" }[fieldName] ?? "");
  });
  return card;
}

function renumberBlocks(editorSelector = "#content-block-editor") {
  [...document.querySelectorAll(`${editorSelector} .block-card`)].forEach((card, index) => {
    card.querySelector("[data-block-number]").textContent = `BLOCK ${String(index + 1).padStart(2, "0")}`;
  });
}

function renderBlockEditor(blocks, editorSelector = "#content-block-editor") {
  const editor = document.querySelector(editorSelector);
  editor.replaceChildren(...blocks.map((block, index) => createBlockCard(block, index)));
}

function readBlocks(editorSelector = "#content-block-editor") {
  return [...document.querySelectorAll(`${editorSelector} .block-card`)].map((card) => {
    const value = (field) => card.querySelector(`[data-block-field="${field}"]`).value;
    return {
      id: card.dataset.blockId,
      type: value("type"),
      width: value("width"),
      heading: value("heading").trim(),
      body: value("body"),
      source: value("source").trim(),
      mediaRef: value("mediaRef").trim().toLowerCase(),
      href: value("href").trim(),
      label: value("label").trim(),
      projectId: value("projectId").trim().toLowerCase(),
      alt: value("alt").trim(),
      fit: value("fit"),
    };
  });
}

function readForm() {
  const data = new FormData(form);
  return {
    ...currentProject(),
    id: String(data.get("id") || "").trim().toLowerCase(),
    parentId: String(data.get("parentId") || "").trim().toLowerCase() || null,
    layout: String(data.get("layout") || "folder"),
    windowWidth: String(data.get("windowWidth") || "748px").trim(),
    windowHeight: String(data.get("windowHeight") || "506px").trim(),
    textWidth: String(data.get("textWidth") || "62ch").trim(),
    body: String(data.get("body") || ""),
    showOverview: form.elements.namedItem("showOverview").checked,
    showFolderActions: form.elements.namedItem("showFolderActions").checked,
    hidden: form.elements.namedItem("hidden").checked,
    blocks: readBlocks(),
    title: String(data.get("title") || "").trim(),
    heading: String(data.get("heading") || "").trim(),
    shortcutLabel: String(data.get("shortcutLabel") || "").trim(),
    kind: String(data.get("kind") || "").trim(),
    description: String(data.get("description") || "").trim(),
    thumbnail: String(data.get("thumbnail") || "").trim(),
    thumbnailMediaRef: String(data.get("thumbnailMediaRef") || "").trim().toLowerCase(),
    thumbnailType: String(data.get("thumbnailType") || "image"),
    sourceType: String(data.get("sourceType") || "image"),
    category: String(data.get("category") || "EXPERIMENT").toUpperCase(),
    period: String(data.get("period") || "").trim(),
    source: String(data.get("source") || "").trim(),
    mediaRef: String(data.get("mediaRef") || "").trim().toLowerCase(),
    role: String(data.get("role") || "").trim(),
    state: String(data.get("state") || "").trim(),
    status: String(data.get("status") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  };
}

function commitFormToState() {
  if (!state.content?.projects.length) return;
  const previousId = currentProject().id;
  const project = readForm();
  state.content.projects[state.selectedIndex] = project;
  if (previousId !== project.id) {
    state.content.projects.forEach((candidate) => {
      if (candidate.parentId === previousId) candidate.parentId = project.id;
    });
  }
  commitSiteSettings();
}

function commitSiteSettings() {
  state.content.site.title = document.querySelector("#site-title").value.trim();
  state.content.site.status = document.querySelector("#site-status").value.trim();
  state.content.homepage = {
    title: document.querySelector("#homepage-title").value.trim() || "CHARACTER_MONITOR.EXE",
    status: document.querySelector("#homepage-status").value.trim(),
    blocks: readBlocks("#homepage-content-block-editor"),
  };
  state.content.contact = {
    heading: document.querySelector("#contact-heading").value.trim(),
    intro: document.querySelector("#contact-intro").value.trim(),
    availability: document.querySelector("#contact-availability").value.trim(),
    location: document.querySelector("#contact-location").value.trim(),
  };
  commitTransmissionSettings();
}

function fillHomepageSettings() {
  const homepage = state.content.homepage || {
    title: "CHARACTER_MONITOR.EXE",
    status: "11PX / 22PX",
    blocks: [],
  };
  document.querySelector("#homepage-title").value = homepage.title || "CHARACTER_MONITOR.EXE";
  document.querySelector("#homepage-status").value = homepage.status || "";
  renderBlockEditor(homepage.blocks || [], "#homepage-content-block-editor");
}

function fillForm() {
  const project = currentProject();
  if (!project) return;
  const parentField = form.elements.namedItem("parentId");
  const unavailable = new Set([project.id]);
  let changed = true;
  while (changed) {
    changed = false;
    state.content.projects.forEach((candidate) => {
      if (candidate.parentId && unavailable.has(candidate.parentId) && !unavailable.has(candidate.id)) {
        unavailable.add(candidate.id);
        changed = true;
      }
    });
  }
  parentField.replaceChildren(new Option("ROOT / PROJECT_INDEX.DIR", ""));
  state.content.projects.forEach((candidate) => {
    if (!unavailable.has(candidate.id) && (candidate.layout || "folder") === "folder") {
      parentField.append(new Option(`${candidate.heading} / ${candidate.id}`, candidate.id));
    }
  });
  for (const [name, value] of Object.entries(project)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value !== false;
    else field.value = name === "status" ? (value || []).join("\n") : value || "";
  }
  form.elements.namedItem("showOverview").checked = project.showOverview !== false;
  form.elements.namedItem("showFolderActions").checked = project.showFolderActions !== false;
  form.elements.namedItem("hidden").checked = project.hidden === true;
  renderBlockEditor(project.blocks || []);
  document.querySelector("#editor-title").textContent = project.title || "PROJECT.ENTRY";
}

function renderProjectList() {
  const list = document.querySelector("#project-list");
  list.replaceChildren();
  state.content.projects.forEach((project, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-entry${index === state.selectedIndex ? " is-active" : ""}`;
    const number = document.createElement("span");
    const depth = (() => {
      let value = 0;
      let parentId = project.parentId;
      const seen = new Set();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        value += 1;
        parentId = state.content.projects.find((candidate) => candidate.id === parentId)?.parentId;
      }
      return value;
    })();
    number.textContent = `${"· ".repeat(depth)}${String(index + 1).padStart(2, "0")}`;
    const name = document.createElement("span");
    name.textContent = project.heading || "UNTITLED";
    const type = document.createElement("small");
    type.textContent = `${project.layout || "folder"} / ${project.id || "no-id"}`.toUpperCase();
    button.append(number, name, type);
    button.addEventListener("click", () => {
      commitFormToState();
      state.selectedIndex = index;
      renderProjectList();
      fillForm();
    });
    item.append(button);
    list.append(item);
  });
}

function readBlogForm() {
  const data = new FormData(blogForm);
  return {
    ...(currentBlogPost() || {}),
    id: String(data.get("id") || "").trim().toLowerCase(),
    title: String(data.get("title") || "").trim(),
    date: String(data.get("date") || ""),
    summary: String(data.get("summary") || "").trim(),
    published: blogForm.elements.namedItem("published").checked,
    blocks: readBlocks("#blog-content-block-editor"),
  };
}

function commitBlogFormToState() {
  if (!state.content?.blog?.length) return;
  state.content.blog[state.selectedBlogIndex] = readBlogForm();
}

function fillBlogForm() {
  const post = currentBlogPost();
  if (!post) {
    blogForm.hidden = true;
    return;
  }
  blogForm.hidden = false;
  ["id", "title", "date", "summary"].forEach((name) => {
    blogForm.elements.namedItem(name).value = post[name] || "";
  });
  blogForm.elements.namedItem("published").checked = post.published !== false;
  renderBlockEditor(post.blocks || [], "#blog-content-block-editor");
  document.querySelector("#blog-editor-title").textContent = post.title || "BLOG.ENTRY";
}

function renderBlogList() {
  const list = document.querySelector("#blog-list");
  list.replaceChildren();
  state.content.blog.forEach((post, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-entry${index === state.selectedBlogIndex ? " is-active" : ""}`;
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.textContent = post.title || "UNTITLED";
    const type = document.createElement("small");
    type.textContent = `${post.published === false ? "DRAFT" : "PUBLISHED"} / ${post.date || "NO DATE"}`;
    button.append(number, name, type);
    button.addEventListener("click", () => {
      commitBlogFormToState();
      state.selectedBlogIndex = index;
      renderBlogList();
      fillBlogForm();
    });
    item.append(button);
    list.append(item);
  });
}

function markDirty() {
  state.dirty = true;
  setStatus("UNSAVED LOCAL CHANGES");
  const project = currentProject();
  if (project) {
    project.heading = form.elements.namedItem("heading").value;
    renderProjectList();
  }
}

function markBlogDirty() {
  state.dirty = true;
  setStatus("UNSAVED LOCAL CHANGES");
  const post = currentBlogPost();
  if (post) {
    post.title = blogForm.elements.namedItem("title").value;
    renderBlogList();
  }
}

async function refreshGitStatus() {
  const git = await api("/api/status");
  document.querySelector("#git-status").textContent = git.remote
    ? `${git.branch} / ${git.contentChanges.length} CONTENT CHANGES`
    : `${git.branch} / NO ORIGIN REMOTE`;
}

async function save() {
  if (!form.reportValidity()) throw new Error("Finish the required project fields first");
  if (state.content.blog.length && !blogForm.reportValidity()) throw new Error("Finish the required blog fields first");
  if (!homepageForm.reportValidity()) throw new Error("Finish the required homepage fields first");
  if (state.content.media.length && !mediaForm.reportValidity()) throw new Error("Finish the required media fields first");
  commitFormToState();
  commitMediaFormToState();
  commitBlogFormToState();
  commitSiteSettings();
  const result = await api("/api/content", { method: "POST", body: JSON.stringify(state.content) });
  state.content = result.content;
  state.dirty = false;
  renderProjectList();
  fillForm();
  renderMediaList();
  fillMediaForm();
  refreshMediaDatalist();
  renderBlogList();
  fillBlogForm();
  fillHomepageSettings();
  setStatus("SAVED LOCALLY / CONTENT JSON UPDATED");
  await refreshGitStatus();
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

document.querySelector("#add-project").addEventListener("click", () => {
  commitFormToState();
  let projectNumber = state.content.projects.length + 1;
  while (state.content.projects.some((project) => project.id === `project-${projectNumber}`)) {
    projectNumber += 1;
  }
  state.content.projects.push({
    id: `project-${projectNumber}`,
    parentId: null,
    layout: "folder",
    windowWidth: "704px",
    windowHeight: "462px",
    textWidth: "62ch",
    body: "",
    showOverview: true,
    showFolderActions: true,
    hidden: false,
    blocks: [],
    title: "NEW_PROJECT.FOLDER",
    heading: "NEW PROJECT",
    shortcutLabel: "NEW.PROJECT",
    kind: "IMAGE → ASCII → CONTENT",
    description: "Describe the project.",
    thumbnail: "",
    thumbnailType: "image",
    sourceType: "image",
    category: "EXPERIMENT",
    period: "",
    source: "assets/media/project-still.webp",
    role: "DESIGN / DEVELOPMENT",
    state: "DRAFT",
    route: "/PROJECT/NEW-PROJECT",
    status: ["OPENING FILE", "READING MEDIA", "CYCLING GLYPHS", "OPENING PROJECT"],
  });
  state.selectedIndex = state.content.projects.length - 1;
  state.dirty = true;
  renderProjectList();
  fillForm();
  setStatus("NEW UNSAVED PROJECT");
});

document.querySelector("#delete-project").addEventListener("click", () => {
  if (state.content.projects.length === 1) return setStatus("AT LEAST ONE PROJECT IS REQUIRED", true);
  if (!confirm(`Delete ${currentProject().heading}? This is not saved yet.`)) return;
  const removed = currentProject();
  state.content.projects.forEach((project) => {
    if (project.parentId === removed.id) project.parentId = removed.parentId || null;
  });
  state.content.projects.splice(state.selectedIndex, 1);
  state.selectedIndex = Math.max(0, state.selectedIndex - 1);
  state.dirty = true;
  renderProjectList();
  fillForm();
  setStatus("PROJECT REMOVED / SAVE TO CONFIRM");
});

document.querySelector("#add-media").addEventListener("click", () => {
  commitMediaFormToState();
  let number = state.content.media.length + 1;
  while (state.content.media.some((item) => item.id === `media-${number}`)) number += 1;
  state.content.media.push({
    id: `media-${number}`, type: "image", title: "NEW MEDIA", caption: "", alt: "",
    sourcePath: "", externalUrl: "", projectId: "", sectionId: "", credits: "",
    posterFrame: "", fullscreenEligible: true, fileSize: 0,
  });
  state.selectedMediaIndex = state.content.media.length - 1;
  state.dirty = true;
  renderMediaList();
  fillMediaForm();
  refreshMediaDatalist();
  setStatus("NEW UNSAVED MEDIA RECORD");
});

document.querySelector("#delete-media").addEventListener("click", () => {
  const item = currentMediaItem();
  if (!item || !confirm(`Delete ${item.title}? References to ${item.id} must also be removed.`)) return;
  state.content.media.splice(state.selectedMediaIndex, 1);
  state.selectedMediaIndex = Math.max(0, state.selectedMediaIndex - 1);
  state.dirty = true;
  renderMediaList();
  fillMediaForm();
  refreshMediaDatalist();
  setStatus("MEDIA RECORD REMOVED / SAVE TO CONFIRM");
});

mediaForm.addEventListener("input", () => {
  state.dirty = true;
  setStatus("UNSAVED LOCAL CHANGES");
  const item = currentMediaItem();
  if (item) {
    item.title = mediaForm.elements.namedItem("title").value;
    renderMediaList();
  }
});

document.querySelector("#add-blog-post").addEventListener("click", () => {
  commitBlogFormToState();
  let postNumber = state.content.blog.length + 1;
  while (state.content.blog.some((post) => post.id === `post-${postNumber}`)) postNumber += 1;
  state.content.blog.push({
    id: `post-${postNumber}`,
    title: "NEW TRANSMISSION",
    date: new Date().toISOString().slice(0, 10),
    summary: "Describe this transmission.",
    published: false,
    blocks: [],
  });
  state.selectedBlogIndex = state.content.blog.length - 1;
  state.dirty = true;
  renderBlogList();
  fillBlogForm();
  setStatus("NEW BLOG DRAFT / NOT YET SAVED");
});

document.querySelector("#delete-blog-post").addEventListener("click", () => {
  const post = currentBlogPost();
  if (!post || !confirm(`Delete ${post.title}? This is not saved yet.`)) return;
  state.content.blog.splice(state.selectedBlogIndex, 1);
  state.selectedBlogIndex = Math.max(0, state.selectedBlogIndex - 1);
  state.dirty = true;
  renderBlogList();
  fillBlogForm();
  setStatus("BLOG POST REMOVED / SAVE TO CONFIRM");
});

document.querySelector("#upload-media").addEventListener("click", async () => {
  try {
    const file = document.querySelector("#media-file").files[0];
    if (!file) throw new Error("Choose an image or video first");
    commitFormToState();
    setStatus(`ARCHIVING + OPTIMIZING ${file.name.toUpperCase()}…`);
    const result = await api("/api/upload", {
      method: "POST",
      body: JSON.stringify({ projectId: currentProject().id, fileName: file.name, base64: await fileAsBase64(file) }),
    });
    form.elements.namedItem("source").value = result.source;
    markDirty();
    setStatus(`ORIGINAL ARCHIVED / OPTIMIZED ${result.clipped ? "TO 18S / " : ""}${result.source}`);
  } catch (error) { setStatus(error.message, true); }
});

document.querySelector("#upload-thumbnail").addEventListener("click", async () => {
  try {
    const file = document.querySelector("#thumbnail-file").files[0];
    if (!file) throw new Error("Choose thumbnail media first");
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      throw new Error("Grid thumbnails must be images or videos");
    }
    commitFormToState();
    setStatus("ARCHIVING + OPTIMIZING THUMBNAIL / " + file.name.toUpperCase() + "…");
    const result = await api("/api/upload", {
      method: "POST",
      body: JSON.stringify({
        projectId: currentProject().id,
        fileName: file.name,
        base64: await fileAsBase64(file),
      }),
    });
    form.elements.namedItem("thumbnail").value = result.source;
    form.elements.namedItem("thumbnailType").value = file.type.startsWith("video/") ? "video" : "image";
    markDirty();
    setStatus("THUMBNAIL ORIGINAL ARCHIVED / OPTIMIZED / " + result.source);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector("#add-block").addEventListener("click", () => {
  const editor = document.querySelector("#content-block-editor");
  const card = createBlockCard({ type: "text", width: "full", fit: "cover" }, editor.children.length);
  editor.append(card);
  renumberBlocks();
  markDirty();
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector("#content-block-editor").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-block-action]");
  if (!action) return;
  const card = action.closest(".block-card");
  const editor = card.parentElement;

  if (action.dataset.blockAction === "up" && card.previousElementSibling) {
    editor.insertBefore(card, card.previousElementSibling);
    renumberBlocks();
    markDirty();
  } else if (action.dataset.blockAction === "down" && card.nextElementSibling) {
    editor.insertBefore(card.nextElementSibling, card);
    renumberBlocks();
    markDirty();
  } else if (action.dataset.blockAction === "delete") {
    card.remove();
    renumberBlocks();
    markDirty();
  } else if (action.dataset.blockAction === "upload") {
    try {
      const file = card.querySelector(".block-file").files[0];
      if (!file) throw new Error("Choose block media first");
      const projectId = String(form.elements.namedItem("id").value || "").trim().toLowerCase();
      if (!projectId) throw new Error("Set the project id before copying media");
      setStatus(`ARCHIVING + OPTIMIZING BLOCK MEDIA / ${file.name.toUpperCase()}…`);
      const result = await api("/api/upload", {
        method: "POST",
        body: JSON.stringify({ projectId, fileName: file.name, base64: await fileAsBase64(file) }),
      });
      card.querySelector('[data-block-field="source"]').value = result.source;
      card.querySelector('[data-block-field="type"]').value = file.type.startsWith("video/") ? "video" : "image";
      markDirty();
      setStatus(`BLOCK ORIGINAL ARCHIVED / OPTIMIZED ${result.clipped ? "TO 18S / " : "/ "}${result.source}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }
});

document.querySelector("#add-blog-block").addEventListener("click", () => {
  const editor = document.querySelector("#blog-content-block-editor");
  const card = createBlockCard({ type: "text", width: "full", fit: "cover" }, editor.children.length);
  editor.append(card);
  renumberBlocks("#blog-content-block-editor");
  markBlogDirty();
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector("#blog-content-block-editor").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-block-action]");
  if (!action) return;
  const card = action.closest(".block-card");
  const editor = card.parentElement;

  if (action.dataset.blockAction === "up" && card.previousElementSibling) {
    editor.insertBefore(card, card.previousElementSibling);
    renumberBlocks("#blog-content-block-editor");
    markBlogDirty();
  } else if (action.dataset.blockAction === "down" && card.nextElementSibling) {
    editor.insertBefore(card.nextElementSibling, card);
    renumberBlocks("#blog-content-block-editor");
    markBlogDirty();
  } else if (action.dataset.blockAction === "delete") {
    card.remove();
    renumberBlocks("#blog-content-block-editor");
    markBlogDirty();
  } else if (action.dataset.blockAction === "upload") {
    try {
      const file = card.querySelector(".block-file").files[0];
      if (!file) throw new Error("Choose block media first");
      const postId = String(blogForm.elements.namedItem("id").value || "").trim().toLowerCase();
      if (!postId) throw new Error("Set the blog id before copying media");
      setStatus(`ARCHIVING + OPTIMIZING BLOG MEDIA / ${file.name.toUpperCase()}…`);
      const result = await api("/api/upload", {
        method: "POST",
        body: JSON.stringify({ projectId: `blog-${postId}`, fileName: file.name, base64: await fileAsBase64(file) }),
      });
      card.querySelector('[data-block-field="source"]').value = result.source;
      card.querySelector('[data-block-field="type"]').value = file.type.startsWith("video/") ? "video" : "image";
      markBlogDirty();
      setStatus(`BLOG ORIGINAL ARCHIVED / OPTIMIZED ${result.clipped ? "TO 18S / " : "/ "}${result.source}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }
});

document.querySelector("#add-homepage-block").addEventListener("click", () => {
  const editor = document.querySelector("#homepage-content-block-editor");
  const card = createBlockCard({ type: "text", width: "full", fit: "cover" }, editor.children.length);
  editor.append(card);
  renumberBlocks("#homepage-content-block-editor");
  markDirty();
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector("#homepage-content-block-editor").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-block-action]");
  if (!action) return;
  const card = action.closest(".block-card");
  const editor = card.parentElement;

  if (action.dataset.blockAction === "up" && card.previousElementSibling) {
    editor.insertBefore(card, card.previousElementSibling);
    renumberBlocks("#homepage-content-block-editor");
    markDirty();
  } else if (action.dataset.blockAction === "down" && card.nextElementSibling) {
    editor.insertBefore(card.nextElementSibling, card);
    renumberBlocks("#homepage-content-block-editor");
    markDirty();
  } else if (action.dataset.blockAction === "delete") {
    card.remove();
    renumberBlocks("#homepage-content-block-editor");
    markDirty();
  } else if (action.dataset.blockAction === "upload") {
    try {
      const file = card.querySelector(".block-file").files[0];
      if (!file) throw new Error("Choose homepage block media first");
      setStatus(`ARCHIVING + OPTIMIZING HOMEPAGE MEDIA / ${file.name.toUpperCase()}â€¦`);
      const result = await api("/api/upload", {
        method: "POST",
        body: JSON.stringify({ projectId: "homepage", fileName: file.name, base64: await fileAsBase64(file) }),
      });
      card.querySelector('[data-block-field="source"]').value = result.source;
      card.querySelector('[data-block-field="type"]').value = file.type.startsWith("video/") ? "video" : "image";
      markDirty();
      setStatus(`HOMEPAGE ORIGINAL ARCHIVED / OPTIMIZED ${result.clipped ? "TO 18S / " : "/ "}${result.source}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }
});

document.querySelector("#save").addEventListener("click", () => save().catch((error) => setStatus(error.message, true)));
document.querySelector("#publish").addEventListener("click", async () => {
  try {
    await save();
    if (!confirm("Commit the saved content and project media, then push it to origin?")) return;
    setStatus("COMMITTING AND PUSHING CONTENT…");
    const result = await api("/api/publish", { method: "POST", body: "{}" });
    setStatus(result.message.toUpperCase());
    await refreshGitStatus();
  } catch (error) { setStatus(error.message, true); }
});
document.querySelector("#preview").addEventListener("click", async () => {
  try {
    await save();
    window.open(`/site/?preview=${Date.now()}&anim=off`, "portfolio-preview");
  } catch (error) {
    setStatus(error.message, true);
  }
});
form.addEventListener("input", markDirty);
blogForm.addEventListener("input", markBlogDirty);
homepageForm.addEventListener("input", markDirty);
["#site-title", "#site-status", "#contact-heading", "#contact-intro", "#contact-availability", "#contact-location"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", markDirty);
});
[
  "#transmission-header",
  "#transmission-ego",
  "#transmission-shadow",
  "#transmission-typing-speed",
  "#transmission-comma-pause",
  "#transmission-sentence-pause",
  "#transmission-phrase-pause",
].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", markDirty);
});
document.querySelectorAll("[data-studio-section]").forEach((button) => {
  button.addEventListener("click", () => {
    commitFormToState();
    commitMediaFormToState();
    commitBlogFormToState();
    document.querySelectorAll("[data-studio-section]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    document.querySelectorAll("[data-studio-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.studioPanel !== button.dataset.studioSection;
    });
  });
});
window.addEventListener("beforeunload", (event) => { if (state.dirty) event.preventDefault(); });

(async () => {
  try {
    state.content = await api("/api/content");
    state.content.media ||= [];
    refreshMediaDatalist();
    state.content.projects = state.content.projects.map((project) => ({
      thumbnail: "",
      thumbnailType: "image",
      period: "",
      ...project,
    }));
    state.content.blog ||= [];
    state.content.homepage ||= {
      title: "CHARACTER_MONITOR.EXE",
      status: "11PX / 22PX",
      blocks: [],
    };
    state.content.contact ||= {
      heading: "CONTACT",
      intro: "Tell me what you are making, breaking, or trying to understand.",
      availability: "AVAILABLE FOR SELECT PROJECTS",
      location: "OKLAHOMA / REMOTE",
    };
    state.content.transmissions ||= { ...defaultTransmissionSettings };
    document.querySelector("#site-title").value = state.content.site?.title || "";
    document.querySelector("#site-status").value = state.content.site?.status || "";
    document.querySelector("#contact-heading").value = state.content.contact.heading || "";
    document.querySelector("#contact-intro").value = state.content.contact.intro || "";
    document.querySelector("#contact-availability").value = state.content.contact.availability || "";
    document.querySelector("#contact-location").value = state.content.contact.location || "";
    fillTransmissionSettings();
    fillHomepageSettings();
    renderProjectList();
    fillForm();
    renderMediaList();
    fillMediaForm();
    renderBlogList();
    fillBlogForm();
    setStatus("LOCAL CONTENT READY");
    await refreshGitStatus();
  } catch (error) { setStatus(error.message, true); }
})();
