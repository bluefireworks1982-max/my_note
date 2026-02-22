const STORAGE_KEY = "drawing_text_notes_v1";

const noteListEl = document.getElementById("noteList");
const createNoteBtn = document.getElementById("createNoteBtn");
const titleInput = document.getElementById("titleInput");
const renameBtn = document.getElementById("renameBtn");
const noteText = document.getElementById("noteText");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const pickFolderBtn = document.getElementById("pickFolderBtn");
const saveLocalBtn = document.getElementById("saveLocalBtn");
const folderHint = document.getElementById("folderHint");
const drawCanvas = document.getElementById("drawCanvas");
const ctx = drawCanvas.getContext("2d");

let notes = [];
let currentNoteId = null;
let drawing = false;
let directoryHandle = null;

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowString() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function loadNotes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    notes = [createEmptyNote()];
    currentNoteId = notes[0].id;
    saveNotes();
    return;
  }

  try {
    notes = JSON.parse(raw);
    if (!Array.isArray(notes) || notes.length === 0) {
      notes = [createEmptyNote()];
    }
  } catch {
    notes = [createEmptyNote()];
  }

  currentNoteId = notes[0].id;
}

function createEmptyNote() {
  return {
    id: uid(),
    title: `新笔记 ${notes.length + 1}`,
    text: "",
    canvasData: null,
    updatedAt: nowString(),
  };
}

function getCurrentNote() {
  return notes.find((item) => item.id === currentNoteId);
}

function renderHistory() {
  noteListEl.innerHTML = "";
  notes.forEach((note) => {
    const li = document.createElement("li");
    if (note.id === currentNoteId) {
      li.classList.add("active");
    }

    const title = document.createElement("p");
    title.className = "note-title";
    title.textContent = note.title;

    const date = document.createElement("p");
    date.className = "note-date";
    date.textContent = `更新于：${note.updatedAt}`;

    li.appendChild(title);
    li.appendChild(date);
    li.addEventListener("click", () => {
      currentNoteId = note.id;
      renderAll();
    });
    noteListEl.appendChild(li);
  });
}

function renderCurrentNote() {
  const note = getCurrentNote();
  if (!note) return;

  titleInput.value = note.title;
  noteText.value = note.text;
  clearCanvas();
  if (note.canvasData) {
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, drawCanvas.width, drawCanvas.height);
    image.src = note.canvasData;
  }
}

function renderAll() {
  renderHistory();
  renderCurrentNote();
}

function markAndSaveCurrent() {
  const note = getCurrentNote();
  if (!note) return;
  note.updatedAt = nowString();
  saveNotes();
  renderHistory();
}

function createNote() {
  const newNote = createEmptyNote();
  notes.unshift(newNote);
  currentNoteId = newNote.id;
  saveNotes();
  renderAll();
}

function renameCurrentNote() {
  const note = getCurrentNote();
  if (!note) return;
  const nextTitle = titleInput.value.trim();
  note.title = nextTitle || "未命名笔记";
  markAndSaveCurrent();
}

function onTextInput() {
  const note = getCurrentNote();
  if (!note) return;
  note.text = noteText.value;
  markAndSaveCurrent();
}

function getPos(event) {
  const rect = drawCanvas.getBoundingClientRect();
  if (event.touches && event.touches.length > 0) {
    const touch = event.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startDraw(event) {
  drawing = true;
  const pos = getPos(event);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function moveDraw(event) {
  if (!drawing) return;
  const pos = getPos(event);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#26324d";
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  const note = getCurrentNote();
  if (!note) return;
  note.canvasData = drawCanvas.toDataURL("image/png");
  markAndSaveCurrent();
}

function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function clearCurrentCanvas() {
  clearCanvas();
  const note = getCurrentNote();
  if (!note) return;
  note.canvasData = drawCanvas.toDataURL("image/png");
  markAndSaveCurrent();
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "未命名笔记";
}

function dataUrlToBlob(dataUrl) {
  const [prefix, base64] = dataUrl.split(",");
  const mimeMatch = prefix.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function pickLocalFolder() {
  if (!window.showDirectoryPicker) {
    folderHint.textContent = "当前浏览器不支持选择本地文件夹（请使用新版 Chromium 浏览器）";
    return;
  }

  try {
    directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    folderHint.textContent = `当前存储位置：已选择本地文件夹（${directoryHandle.name}）`;
  } catch {
    folderHint.textContent = "未选择文件夹，仍使用浏览器本地存储（localStorage）";
  }
}

async function saveCurrentNoteToFolder() {
  const note = getCurrentNote();
  if (!note) return;
  if (!directoryHandle) {
    folderHint.textContent = "请先点击“选择本地文件夹”后再保存";
    return;
  }

  const baseName = sanitizeFilename(note.title);
  const payload = {
    id: note.id,
    title: note.title,
    text: note.text,
    updatedAt: note.updatedAt,
  };

  const jsonHandle = await directoryHandle.getFileHandle(`${baseName}.json`, { create: true });
  const jsonWriter = await jsonHandle.createWritable();
  await jsonWriter.write(JSON.stringify(payload, null, 2));
  await jsonWriter.close();

  if (note.canvasData) {
    const pngHandle = await directoryHandle.getFileHandle(`${baseName}.png`, { create: true });
    const pngWriter = await pngHandle.createWritable();
    await pngWriter.write(dataUrlToBlob(note.canvasData));
    await pngWriter.close();
  }

  folderHint.textContent = `已保存：${baseName}.json${note.canvasData ? " + .png" : ""} 到文件夹 ${directoryHandle.name}`;
}

createNoteBtn.addEventListener("click", createNote);
renameBtn.addEventListener("click", renameCurrentNote);
noteText.addEventListener("input", onTextInput);
clearCanvasBtn.addEventListener("click", clearCurrentCanvas);
pickFolderBtn.addEventListener("click", pickLocalFolder);
saveLocalBtn.addEventListener("click", saveCurrentNoteToFolder);

drawCanvas.addEventListener("mousedown", startDraw);
drawCanvas.addEventListener("mousemove", moveDraw);
window.addEventListener("mouseup", endDraw);

drawCanvas.addEventListener("touchstart", startDraw, { passive: true });
drawCanvas.addEventListener("touchmove", moveDraw, { passive: true });
window.addEventListener("touchend", endDraw);

loadNotes();
renderAll();
