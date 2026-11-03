/* =====================================================
   Rafiq AI – script.js
   الجزء 1 من 2: الأساسيات + اللغات + الدخول + المحادثات
   ===================================================== */
"use strict";

/* ---------- إعداد الذكاء الاصطناعي ----------
   endpoint فارغ = وضع تجريبي محلي (ليس ذكاءً اصطناعياً حقيقياً).
   للربط الحقيقي ضع رابط الخادم الوسيط الخاص بك (انظر README.md).
   لا تضع مفتاح API هنا أبداً. */
var AI_CONFIG = {
  endpoint: "",
  timeoutMs: 30000
};

/* ---------- أدوات مساعدة ---------- */
var KEY_PREFIX = "rafiq_v1_";

function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function pad(n){ return n < 10 ? "0" + n : "" + n; }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function load(key, def){
  try{
    var v = localStorage.getItem(KEY_PREFIX + key);
    return v === null ? def : JSON.parse(v);
  }catch(e){ return def; }
}
function save(key, val){
  try{ localStorage.setItem(KEY_PREFIX + key, JSON.stringify(val)); return true; }
  catch(e){ toast(t("storageFull")); return false; }
}
function todayStr(){
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function addDays(str, n){
  var p = str.split("-");
  var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function hexToRgb(h){
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) : "255,31,61";
}
function fmt12(hhmm){
  var p = String(hhmm || "00:00").split(":");
  var h = parseInt(p[0], 10) || 0;
  var m = p[1] || "00";
  var suffix = h >= 12 ? t("pm") : t("am");
  return (h % 12 || 12) + ":" + m + " " + suffix;
}
function byWhen(a, b){
  var x = a.date + " " + a.time, y = b.date + " " + b.time;
  return x < y ? -1 : (x > y ? 1 : 0);
}
function toast(msg){
  var box = $("#toasts");
  if(!box) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 2600);
}
function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ toast(t("copied")); }, function(){ fallbackCopy(text); });
  }else{
    fallbackCopy(text);
  }
}
function fallbackCopy(text){
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand("copy"); toast(t("copied")); }
  catch(e){ toast(t("copyFail")); }
  document.body.removeChild(ta);
}
function injectCSS(){
  var s = document.createElement("style");
  s.textContent =
    ".sidebar.mini{width:78px}" +
    ".sidebar.mini .nav-item span,.sidebar.mini .side-link span{display:none}";
  document.head.appendChild(s);
}

/* ---------- الصور الرمزية (SVG مدمجة، تعمل بدون إنترنت) ---------- */
function svgUri(svg){ return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }

var BOT_AVATAR = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#3a0b12"/><stop offset="1" stop-color="#12030a"/></radialGradient></defs>' +
  '<rect width="100" height="100" fill="url(#g)"/>' +
  '<line x1="50" y1="12" x2="50" y2="26" stroke="#ff3b4d" stroke-width="3"/>' +
  '<circle cx="50" cy="11" r="4" fill="#ff1f3d"/>' +
  '<rect x="22" y="26" width="56" height="42" rx="18" fill="#f4eeee"/>' +
  '<rect x="29" y="36" width="42" height="22" rx="11" fill="#14070b"/>' +
  '<circle cx="41" cy="47" r="5" fill="#ff1f3d"/><circle cx="59" cy="47" r="5" fill="#ff1f3d"/>' +
  '<rect x="30" y="72" width="40" height="22" rx="10" fill="#e8dcdc"/>' +
  '<circle cx="50" cy="83" r="4" fill="#ff1f3d"/></svg>'
);
var USER_AVATAR = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#2a0a10"/>' +
  '<circle cx="50" cy="38" r="17" fill="#0e0406"/>' +
  '<path d="M16 100c2-24 18-34 34-34s32 10 34 34z" fill="#0e0406"/></svg>'
);

/* ---------- الترجمة ---------- */
var I18N = {
  ar: {
    authSub: "رفيقك الذكي في كل وقت", login: "تسجيل الدخول", signup: "إنشاء حساب",
    name: "الاسم", email: "البريد الإلكتروني", password: "كلمة المرور", guest: "المتابعة كضيف",
    authNote: "ملاحظة: الحساب هنا تجريبي ومحفوظ على هذا المتصفح فقط، ولا يوجد خادم أو مزامنة بين الأجهزة، ولا تُحفظ كلمة المرور.",
    authInvalid: "أدخل بريداً صحيحاً وكلمة مرور (4 أحرف على الأقل)", welcomeToast: "أهلاً بك في Rafiq AI", guestName: "ضيف",
    navHome: "الصفحة الرئيسية", navChats: "المحادثات", navDiscover: "اكتشف", navFav: "المفضلة",
    navStats: "إحصائياتي", navTasks: "المهام", navNotes: "الملاحظات", navFiles: "الملفات",
    navPlans: "الاشتراكات", navProfile: "الملف الشخصي", navSettings: "الإعدادات",
    switchAcc: "تبديل الحساب", logout: "الخروج", search: "ابحث...",
    hello: "مرحبا بك يا", helloSub: "مستعد دائماً لمساعدتك في أي وقت ..",
    todaySchedule: "جدولك اليوم", viewAll: "عرض الكل", typeMsg: "اكتب رسالتك هنا ...",
    newChat: "محادثة جديدة", searchChats: "ابحث في المحادثات...",
    apiNote: "الردود الحالية تجريبية (محلية). للربط بذكاء اصطناعي حقيقي راجع README.md.",
    favEmpty: "لا توجد عناصر في المفضلة بعد. اضغط ★ على أي أداة.",
    stChats: "المحادثات", stDone: "مهام مكتملة", stNotes: "الملاحظات", stMsgs: "الرسائل",
    chartWeek: "نشاط آخر 7 أيام", chartTasks: "حالة المهام",
    addTask: "مهمة جديدة", editTask: "تعديل المهمة", fAll: "الكل", fToday: "اليوم", fOpen: "غير مكتملة", fDone: "مكتملة",
    taskEmpty: "لا توجد مهام. أضف أول مهمة لك.", addNote: "ملاحظة جديدة",
    searchNotes: "ابحث في الملاحظات...", noteTitle: "عنوان الملاحظة", noteBody: "اكتب هنا... (يُحفظ تلقائياً)",
    important: "مهمة", delete: "حذف", appearance: "المظهر", theme: "الوضع", dark: "داكن", light: "فاتح",
    lang: "اللغة", accent: "لون الواجهة", fontSize: "حجم الخط", privacy: "الخصوصية والبيانات",
    notif: "الإشعارات المرئية", saveChats: "حفظ المحادثات محلياً",
    lsNote: "كل بياناتك مخزنة في LocalStorage داخل هذا المتصفح فقط: لا مزامنة بين الأجهزة، وتُحذف إذا مسحت بيانات المتصفح. حجمها محدود (حوالي 5MB).",
    export: "تصدير بياناتي", resetAll: "مسح كل البيانات", bio: "نبذة", changeAvatar: "تغيير الصورة", save: "حفظ",
    pf1: "محادثات تجريبية", pf2: "مهام وملاحظات", pf3: "تخزين محلي", currentPlan: "خطتك الحالية",
    pp1: "ربط API حقيقي", pp2: "مزامنة سحابية (مستقبلاً)", pp3: "دعم أولوية", choosePro: "اختر Pro", chooseFree: "اختر Free",
    plansNote: "هذه صفحة عرض فقط؛ لا يوجد نظام دفع حقيقي. زر الاختيار يحفظ الخطة محلياً للتجربة.",
    pickImages: "اختيار صور", pickFiles: "اختيار ملفات",
    filesNote: "الملفات المختارة تبقى في هذه الصفحة فقط ولا تُرفع إلى أي خادم إلا بعد إضافة نظام رفع حقيقي.",
    fileEmpty: "لم تختر ملفات بعد.", taskTitle: "العنوان", date: "التاريخ", time: "الوقت", priority: "الأولوية",
    pNormal: "عادية", pHigh: "مهمة", pUrgent: "مهم جداً", cancel: "إلغاء",
    /* رسائل التشغيل */
    storageFull: "التخزين ممتلئ أو غير متاح", welcome: "كيف يمكنني مساعدتك اليوم ؟ ✨", untitled: "محادثة جديدة",
    copied: "تم النسخ", copyFail: "تعذر النسخ", copy: "نسخ",
    confirmDelChat: "حذف هذه المحادثة؟", confirmDelTask: "حذف هذه المهمة؟", confirmDelNote: "حذف هذه الملاحظة؟",
    confirmReset: "سيتم مسح كل بياناتك من هذا المتصفح نهائياً. متأكد؟",
    noTasksToday: "لا توجد مهام لليوم", wait: "انتظر رد المساعد أولاً",
    aiError: "تعذر الاتصال بالخادم. تحقق من الإعداد في AI_CONFIG ومن الإنترنت.",
    demoReply: "أنا الآن في الوضع التجريبي، أي لست متصلاً بذكاء اصطناعي حقيقي بعد. أستطيع الرد على أسئلة بسيطة عن مهامك وملاحظاتك والوقت والتاريخ. لربطي بنموذج حقيقي اتبع شرح README.md.",
    today: "اليوم", tomorrow: "غداً", am: "ص", pm: "م",
    sugg1: "ما هي مهامي اليوم؟", sugg2: "كم ملاحظة عندي؟", sugg3: "كم الساعة الآن؟", sugg4: "ماذا تستطيع أن تفعل؟",
    rGreet: "أهلاً {n}! كيف أساعدك اليوم؟",
    rTasks0: "ليس لديك مهام مفتوحة لليوم 🎉",
    rTasksN: "لديك {n} مهمة مفتوحة اليوم. أقربها: {title} الساعة {time}.",
    rNotes: "لديك {n} ملاحظة محفوظة.", rTime: "الوقت الآن {time}.", rDate: "تاريخ اليوم: {date}.",
    rHelp: "في الوضع التجريبي أستطيع: إخبارك بمهام اليوم، عدد ملاحظاتك، الوقت والتاريخ. اسألني مثلاً: ما هي مهامي اليوم؟",
    emptyChats: "لا توجد محادثات", msgsCount: "رسالة"
  },
  en: {
    authSub: "Your smart companion, anytime", login: "Log in", signup: "Sign up",
    name: "Name", email: "Email", password: "Password", guest: "Continue as guest",
    authNote: "Note: this account is a demo stored in this browser only. There is no server, no sync between devices, and the password is not saved.",
    authInvalid: "Enter a valid email and a password (min 4 characters)", welcomeToast: "Welcome to Rafiq AI", guestName: "Guest",
    navHome: "Home", navChats: "Chats", navDiscover: "Discover", navFav: "Favorites",
    navStats: "My Stats", navTasks: "Tasks", navNotes: "Notes", navFiles: "Files",
    navPlans: "Plans", navProfile: "Profile", navSettings: "Settings",
    switchAcc: "Switch account", logout: "Log out", search: "Search...",
    hello: "Welcome,", helloSub: "Always ready to help you, anytime ..",
    todaySchedule: "Today's schedule", viewAll: "View all", typeMsg: "Type your message here ...",
    newChat: "New chat", searchChats: "Search chats...",
    apiNote: "Replies are currently demo (local). To connect a real AI, see README.md.",
    favEmpty: "No favorites yet. Tap ★ on any tool.",
    stChats: "Chats", stDone: "Tasks done", stNotes: "Notes", stMsgs: "Messages",
    chartWeek: "Last 7 days activity", chartTasks: "Tasks status",
    addTask: "New task", editTask: "Edit task", fAll: "All", fToday: "Today", fOpen: "Open", fDone: "Done",
    taskEmpty: "No tasks. Add your first one.", addNote: "New note",
    searchNotes: "Search notes...", noteTitle: "Note title", noteBody: "Write here... (auto-saved)",
    important: "Important", delete: "Delete", appearance: "Appearance", theme: "Mode", dark: "Dark", light: "Light",
    lang: "Language", accent: "Accent color", fontSize: "Font size", privacy: "Privacy & data",
    notif: "Visual notifications", saveChats: "Save chats locally",
    lsNote: "All your data lives in LocalStorage inside this browser only: no sync between devices, and it is erased if you clear browser data. Limited size (about 5MB).",
    export: "Export my data", resetAll: "Erase all data", bio: "Bio", changeAvatar: "Change picture", save: "Save",
    pf1: "Demo chats", pf2: "Tasks & notes", pf3: "Local storage", currentPlan: "Your current plan",
    pp1: "Real API connection", pp2: "Cloud sync (future)", pp3: "Priority support", choosePro: "Choose Pro", chooseFree: "Choose Free",
    plansNote: "Display page only; there is no real payment. The button just saves the plan locally for testing.",
    pickImages: "Choose images", pickFiles: "Choose files",
    filesNote: "Chosen files stay on this page only and are not uploaded to any server until a real upload system is added.",
    fileEmpty: "No files chosen yet.", taskTitle: "Title", date: "Date", time: "Time", priority: "Priority",
    pNormal: "Normal", pHigh: "Important", pUrgent: "Very important", cancel: "Cancel",
    storageFull: "Storage is full or unavailable", welcome: "How can I help you today? ✨", untitled: "New chat",
    copied: "Copied", copyFail: "Copy failed", copy: "Copy",
    confirmDelChat: "Delete this chat?", confirmDelTask: "Delete this task?", confirmDelNote: "Delete this note?",
    confirmReset: "All your data in this browser will be erased permanently. Sure?",
    noTasksToday: "No tasks for today", wait: "Wait for the assistant's reply first",
    aiError: "Could not reach the server. Check AI_CONFIG and your internet.",
    demoReply: "I'm in demo mode right now, so I'm not connected to a real AI yet. I can answer simple questions about your tasks, notes, time and date. To connect a real model, follow README.md.",
    today: "Today", tomorrow: "Tomorrow", am: "AM", pm: "PM",
    sugg1: "What are my tasks today?", sugg2: "How many notes do I have?", sugg3: "What time is it?", sugg4: "What can you do?",
    rGreet: "Hello {n}! How can I help you today?",
    rTasks0: "You have no open tasks for today 🎉",
    rTasksN: "You have {n} open task(s) today. Next: {title} at {time}.",
    rNotes: "You have {n} saved note(s).", rTime: "The time is {time}.", rDate: "Today's date: {date}.",
    rHelp: "In demo mode I can tell you today's tasks, your note count, the time and the date. Try: What are my tasks today?",
    emptyChats: "No chats", msgsCount: "messages"
  }
};

function t(key){
  var lang = (S && S.settings && S.settings.lang) || "ar";
  var d = I18N[lang] || I18N.ar;
  if(d[key] !== undefined) return d[key];
  return I18N.ar[key] !== undefined ? I18N.ar[key] : key;
}
function tf(key, vars){
  var s = t(key);
  for(var k in vars){ s = s.split("{" + k + "}").join(vars[k]); }
  return s;
}

/* ---------- الحالة العامة ---------- */
var S = {
  profile:  load("profile",  { name: "هاني", email: "", bio: "", avatar: "", plan: "free" }),
  settings: load("settings", { theme: "dark", lang: "ar", accent: "#ff1f3d", font: 16, notif: true, saveChats: true }),
  chats:    load("chats",    []),
  tasks:    load("tasks",    null),
  notes:    load("notes",    []),
  favs:     load("favs",     []),
  activity: load("activity", {}),
  user:     load("user",     null),
  currentChat: null,
  pending: null
};
if(S.tasks === null){
  var _d = todayStr();
  S.tasks = [
    { id: uid(), title: "مذاكرة مادة الأحياء", date: _d, time: "17:00", prio: "urgent", done: false },
    { id: uid(), title: "اجتماع مع صديقك",     date: _d, time: "21:00", prio: "normal", done: false }
  ];
  save("tasks", S.tasks);
}
if(S.chats.length){ S.currentChat = S.chats[0].id; }

function bump(n){
  var d = todayStr();
  S.activity[d] = (S.activity[d] || 0) + (n || 1);
  save("activity", S.activity);
}
function userAvatar(){ return S.profile.avatar || USER_AVATAR; }
function syncAvatars(){
  var a = $("#topAvatar"), b = $("#profileAvatar");
  if(a) a.src = userAvatar();
  if(b) b.src = userAvatar();
}

/* ---------- تطبيق الإعدادات واللغة ---------- */
function applySettings(){
  var st = S.settings, r = document.documentElement;
  r.setAttribute("data-theme", st.theme);
  r.setAttribute("lang", st.lang);
  r.setAttribute("dir", st.lang === "ar" ? "rtl" : "ltr");
  r.style.setProperty("--accent", st.accent);
  r.style.setProperty("--accent-rgb", hexToRgb(st.accent));
  r.style.setProperty("--fs", st.font + "px");
  $$("[data-i18n]").forEach(function(el){ el.textContent = t(el.getAttribute("data-i18n")); });
  $$("[data-i18n-ph]").forEach(function(el){ el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  document.title = "Rafiq AI – " + (st.lang === "ar" ? "رفيقك الذكي" : "Your AI Companion");
}

/* ---------- التنقل بين الصفحات ---------- */
var currentPage = "dashboard";

function openSidebar(){ $("#sidebar").classList.add("open"); $("#overlay").classList.add("open"); }
function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("open"); }

function showPage(name){
  if(!$("#page-" + name)) return;
  currentPage = name;
  $$(".page").forEach(function(p){ p.classList.toggle("active", p.id === "page-" + name); });
  $$(".nav-item").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-page") === name); });
  closeSidebar();
  renderCurrent();
  window.scrollTo(0, 0);
}

function renderCurrent(){
  switch(currentPage){
    case "dashboard": renderDash(); break;
    case "chats":     renderChats(); break;
    case "discover":  renderTools(); break;
    case "favorites": renderFavs(); break;
    case "stats":     renderStats(); break;
    case "tasks":     renderTasks(); break;
    case "notes":     renderNotes(); break;
    case "settings":  syncSettingsUI(); break;
    case "profile":   syncProfileUI(); break;
    case "plans":     syncPlansUI(); break;
    case "files":     renderFiles(); break;
  }
}

/* ---------- الدخول والخروج (تجريبي محلي) ---------- */
var authMode = "login";

function setAuthMode(m){
  authMode = m;
  $("#tabLogin").classList.toggle("active", m === "login");
  $("#tabSignup").classList.toggle("active", m === "signup");
  $("#nameField").style.display = m === "signup" ? "block" : "none";
  var b = $("#authSubmit");
  var key = m === "signup" ? "signup" : "login";
  b.setAttribute("data-i18n", key);
  b.textContent = t(key);
}
function showAuth(show){
  $("#authScreen").classList.toggle("hidden", !show);
  $("#app").style.display = show ? "none" : "";
}
function onAuthSubmit(e){
  e.preventDefault();
  var email = $("#authEmail").value.trim();
  var pass = $("#authPass").value;
  if(!email || pass.length < 4){ toast(t("authInvalid")); return; }
  var name = authMode === "signup" ? $("#authName").value.trim() : "";
  if(!name) name = S.profile.name || email.split("@")[0];
  loginAs(name, email);
}
function loginAs(name, email){
  S.user = { name: name, email: email };
  save("user", S.user);
  S.profile.name = name;
  if(email) S.profile.email = email;
  save("profile", S.profile);
  $("#authForm").reset();
  setAuthMode("login");
  showAuth(false);
  syncAvatars();
  showPage("dashboard");
  toast(t("welcomeToast"));
}
function logout(){
  S.user = null;
  save("user", null);
  closeSidebar();
  showAuth(true);
}

/* ---------- الصفحة الرئيسية ---------- */
function renderDash(){
  $("#helloName").textContent = S.profile.name;
  var today = todayStr();
  var list = S.tasks.filter(function(k){ return k.date === today; }).sort(byWhen);
  var box = $("#dashTasks");
  if(list.length){
    box.innerHTML = list.map(function(k){ return taskHTML(k, false); }).join("");
  }else{
    box.innerHTML = '<p class="empty">' + esc(t("noTasksToday")) + '</p>';
  }
  renderMessages($("#dashMsgs"), getChat(S.currentChat), 6);
}

/* ---------- المحادثات ---------- */
function getChat(id){
  for(var i = 0; i < S.chats.length; i++){ if(S.chats[i].id === id) return S.chats[i]; }
  return null;
}
function persistChats(){ if(S.settings.saveChats) save("chats", S.chats); }

function newChat(silent){
  var c = { id: uid(), title: "", messages: [], updated: Date.now() };
  S.chats.unshift(c);
  S.currentChat = c.id;
  persistChats();
  if(!silent){ renderChats(); $("#chatInput").focus(); }
  return c;
}
function deleteChat(id){
  if(!confirm(t("confirmDelChat"))) return;
  S.chats = S.chats.filter(function(c){ return c.id !== id; });
  if(S.currentChat === id){ S.currentChat = S.chats.length ? S.chats[0].id : null; }
  persistChats();
  renderCurrent();
}
function findMsg(id){
  if(id === "w") return t("welcome");
  for(var i = 0; i < S.chats.length; i++){
    var ms = S.chats[i].messages;
    for(var j = 0; j < ms.length; j++){ if(ms[j].id === id) return ms[j].text; }
  }
  return "";
}
function msgHTML(m){
  var isUser = m.role === "user";
  var tm = new Date(m.time);
  return '<div class="msg ' + (isUser ? "user" : "bot") + '">' +
    '<span class="msg-av"><img alt="" src="' + (isUser ? userAvatar() : BOT_AVATAR) + '"></span>' +
    '<div class="bubble">' + esc(m.text) +
    '<span class="msg-time">' + pad(tm.getHours()) + ':' + pad(tm.getMinutes()) + '</span>' +
    '<button type="button" class="msg-copy" data-act="copy" data-id="' + m.id + '">' +
    '<svg class="ic"><use href="#i-copy"/></svg>' + esc(t("copy")) + '</button>' +
    '</div></div>';
}
function renderMessages(el, chat, limit){
  var msgs = chat ? chat.messages.slice() : [];
  if(limit) msgs = msgs.slice(-limit);
  var html = "";
  if(!msgs.length){
    html += msgHTML({ id: "w", role: "bot", text: t("welcome"), time: Date.now() });
  }else{
    html += msgs.map(function(m){ return msgHTML(m); }).join("");
  }
  if(el.id === "dashMsgs" && S.pending && chat && S.pending === chat.id){
    html += '<div class="msg bot"><span class="msg-av"><img alt="" src="' + BOT_AVATAR + '"></span>' +
            '<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>';
  }
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}
function renderChatList(){
  var q = $("#chatSearch").value.trim().toLowerCase();
  var list = S.chats.slice().sort(function(a, b){ return b.updated - a.updated; }).filter(function(c){
    if(!q) return true;
    if((c.title || "").toLowerCase().indexOf(q) > -1) return true;
    return c.messages.some(function(m){ return m.text.toLowerCase().indexOf(q) > -1; });
  });
  var box = $("#chatList");
  if(!list.length){
    box.innerHTML = '<p class="empty">' + esc(t("emptyChats")) + '</p>';
    return;
  }
  box.innerHTML = list.map(function(c){
    return '<div class="chat-item' + (c.id === S.currentChat ? " active" : "") + '" data-id="' + c.id + '">' +
      '<div class="t">' + esc(c.title || t("untitled")) +
      '<small>' + c.messages.length + ' ' + esc(t("msgsCount")) + '</small></div>' +
      '<button type="button" class="icon-btn" data-act="del" data-id="' + c.id + '" aria-label="delete">' +
      '<svg class="ic"><use href="#i-trash"/></svg></button></div>';
  }).join("");
}
function renderChats(){
  if(!getChat(S.currentChat)){ S.currentChat = S.chats.length ? S.chats[0].id : null; }
  renderChatList();
  var c = getChat(S.currentChat);
  $("#chatTitle").textContent = c ? (c.title || t("untitled")) : t("untitled");
  renderMessages($("#chatMsgs"), c);
  $("#typing").classList.toggle("hidden", !(S.pending && c && S.pending === c.id));
}

/* ---------- ردود المساعد ---------- */
function localReply(text){
  var q = text.toLowerCase(), today = todayStr();
  if(/^(hi|hello|hey)\b|مرحب|السلام|اهلا|أهلا|هلا/.test(q)){
    return tf("rGreet", { n: S.profile.name });
  }
  if(/مهام|مهمة|جدول|task|todo|schedule/.test(q)){
    var open = S.tasks.filter(function(k){ return k.date === today && !k.done; }).sort(byWhen);
    if(!open.length) return t("rTasks0");
    return tf("rTasksN", { n: open.length, title: open[0].title, time: fmt12(open[0].time) });
  }
  if(/ملاحظ|note/.test(q)){
    return tf("rNotes", { n: S.notes.length });
  }
  if(/الوقت|الساعة|time|clock/.test(q)){
    var d = new Date();
    return tf("rTime", { time: fmt12(pad(d.getHours()) + ":" + pad(d.getMinutes())) });
  }
  if(/التاريخ|اليوم|date|today/.test(q)){
    var loc = S.settings.lang === "ar" ? "ar-EG" : "en-US";
    var ds = new Date().toLocaleDateString(loc, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return tf("rDate", { date: ds });
  }
  if(/مساعدة|help|ماذا تستطيع|ماذا تفعل|what can/.test(q)){
    return t("rHelp");
  }
  return t("demoReply");
}

function aiReply(chat, text){
  if(AI_CONFIG.endpoint){
    var hist = chat.messages.slice(-20).map(function(m){
      return { role: m.role === "user" ? "user" : "assistant", content: m.text };
    });
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, AI_CONFIG.timeoutMs) : null;
    return fetch(AI_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: hist }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function(r){
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(d){
      var out = d.reply || d.text || "";
      if(!out) throw new Error("empty");
      return out;
    });
  }
  return new Promise(function(resolve){
    setTimeout(function(){ resolve(localReply(text)); }, 700 + Math.random() * 600);
  });
}

function sendMessage(text){
  text = (text || "").trim();
  if(!text) return;
  if(S.pending){ toast(t("wait")); return; }
  var c = getChat(S.currentChat) || newChat(true);
  c.messages.push({ id: uid(), role: "user", text: text, time: Date.now() });
  if(!c.title){ c.title = text.length > 30 ? text.slice(0, 30) + "…" : text; }
  c.updated = Date.now();
  S.pending = c.id;
  persistChats();
  bump();
  renderCurrent();
  aiReply(c, text).then(
    function(r){ return r; },
    function(){ return t("aiError"); }
  ).then(function(reply){
    var ch = getChat(c.id);
    if(ch){
      ch.messages.push({ id: uid(), role: "bot", text: reply, time: Date.now() });
      ch.updated = Date.now();
    }
    S.pending = null;
    persistChats();
    renderCurrent();
  });
}

/* ---------- ربط أحداث الأساسيات والمحادثات ---------- */
function bindCore(){
  $("#menuOpen").addEventListener("click", openSidebar);
  $("#menuToggle").addEventListener("click", function(){
    if(window.innerWidth <= 900) closeSidebar();
    else $("#sidebar").classList.toggle("mini");
  });
  $("#overlay").addEventListener("click", closeSidebar);
  $$(".nav-item").forEach(function(b){
    b.addEventListener("click", function(){ showPage(b.getAttribute("data-page")); });
  });
  $$("[data-goto]").forEach(function(b){
    b.addEventListener("click", function(){ showPage(b.getAttribute("data-goto")); });
  });
  $("#crownBtn").addEventListener("click", function(){ showPage("plans"); });
  $("#avatarBtn").addEventListener("click", function(){ showPage("profile"); });
  $("#logoutBtn").addEventListener("click", logout);
  $("#switchAccount").addEventListener("click", logout);

  $("#tabLogin").addEventListener("click", function(){ setAuthMode("login"); });
  $("#tabSignup").addEventListener("click", function(){ setAuthMode("signup"); });
  $("#authForm").addEventListener("submit", onAuthSubmit);
  $("#guestBtn").addEventListener("click", function(){ loginAs(S.profile.name || t("guestName"), ""); });
}

function bindChat(){
  $("#dashComposer").addEventListener("submit", function(e){
    e.preventDefault();
    var inp = $("#dashInput"), v = inp.value;
    if(!v.trim()) return;
    inp.value = "";
    sendMessage(v);
  });
  $("#chatComposer").addEventListener("submit", function(e){
    e.preventDefault();
    var inp = $("#chatInput"), v = inp.value;
    if(!v.trim()) return;
    inp.value = "";
    sendMessage(v);
  });
  $("#newChatBtn").addEventListener("click", function(){ newChat(false); });
  $("#chatSearch").addEventListener("input", renderChatList);

  $("#chatList").addEventListener("click", function(e){
    var del = e.target.closest('[data-act="del"]');
    if(del){ deleteChat(del.getAttribute("data-id")); return; }
    var item = e.target.closest(".chat-item");
    if(item){ S.currentChat = item.getAttribute("data-id"); renderChats(); }
  });

  [$("#dashMsgs"), $("#chatMsgs")].forEach(function(box){
    box.addEventListener("click", function(e){
      var b = e.target.closest('[data-act="copy"]');
      if(b) copyText(findMsg(b.getAttribute("data-id")));
    });
  });

  /* زر ●● : يضع اقتراح سؤال جاهز في خانة الكتابة */
  var suggIndex = 0;
  $$(".dots-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      suggIndex = (suggIndex % 4) + 1;
      var inp = btn.parentNode.querySelector("input");
      if(inp){ inp.value = t("sugg" + suggIndex); inp.focus(); }
    });
  });
}

/* ===== نهاية الجزء الأول – الصق الجزء الثاني تحت هذا السطر مباشرة ===== */
/* =====================================================
   الجزء 2-أ: ترجمات إضافية + المهام + الملاحظات + الأدوات
   ===================================================== */

/* ---------- ترجمات إضافية ---------- */
(function extendI18N(){
  var ar = {
    saved: "تم الحفظ ✓", untitledNote: "ملاحظة بدون عنوان", noNotes: "لا توجد ملاحظات",
    noResults: "لا نتائج مطابقة", exported: "تم تجهيز ملف البيانات",
    remindTitle: "⏰ تذكير: {title}", tryTool: "جرّب",
    catAll: "الكل", catWrite: "كتابة", catStudy: "دراسة", catWork: "عمل", catFun: "إبداع",
    lblDone: "مكتملة", lblOpen: "مفتوحة", lblLate: "متأخرة",
    tipDefault: "اضغط على عمود لعرض التفاصيل", tipBar: "{d}: {n} رسالة",
    planSaved: "تم حفظ الخطة محلياً", profileSaved: "تم حفظ الملف الشخصي",
    taskSaved: "تم حفظ المهمة", fileAdded: "تمت إضافة الملفات", fileOpen: "معاينة"
  };
  var en = {
    saved: "Saved ✓", untitledNote: "Untitled note", noNotes: "No notes",
    noResults: "No matching results", exported: "Data file is ready",
    remindTitle: "⏰ Reminder: {title}", tryTool: "Try it",
    catAll: "All", catWrite: "Writing", catStudy: "Study", catWork: "Work", catFun: "Creative",
    lblDone: "Done", lblOpen: "Open", lblLate: "Late",
    tipDefault: "Tap a bar to see details", tipBar: "{d}: {n} messages",
    planSaved: "Plan saved locally", profileSaved: "Profile saved",
    taskSaved: "Task saved", fileAdded: "Files added", fileOpen: "Preview"
  };
  var k;
  for(k in ar){ I18N.ar[k] = ar[k]; }
  for(k in en){ I18N.en[k] = en[k]; }
})();

/* ---------- المهام ---------- */
var taskFilter = "all";
var editingTask = null;
var notified = {};

function dayLabel(d){
  if(d === todayStr()) return t("today");
  if(d === addDays(todayStr(), 1)) return t("tomorrow");
  return d;
}

function taskHTML(k, actions){
  var mark = k.done ? "✓" : (k.prio === "urgent" ? "!" : "");
  var tag = "";
  if(k.prio === "urgent") tag = '<span class="task-tag">★ ' + esc(t("pUrgent")) + '</span>';
  else if(k.prio === "high") tag = '<span class="task-tag high">' + esc(t("pHigh")) + '</span>';
  var acts = "";
  if(actions){
    acts = '<div class="task-actions">' +
      '<button type="button" class="icon-btn" data-act="edit" aria-label="edit"><svg class="ic"><use href="#i-edit"/></svg></button>' +
      '<button type="button" class="icon-btn" data-act="del" aria-label="delete"><svg class="ic"><use href="#i-trash"/></svg></button>' +
      '</div>';
  }
  return '<div class="task ' + esc(k.prio) + (k.done ? " done" : "") + '" data-id="' + k.id + '">' +
    '<button type="button" class="task-check" data-act="toggle" aria-label="done">' + mark + '</button>' +
    '<div class="task-info"><div class="task-title">' + esc(k.title) + '</div>' +
    '<div class="task-meta"><svg class="ic"><use href="#i-clock"/></svg>' +
    esc(dayLabel(k.date)) + ' - ' + esc(fmt12(k.time)) + '</div></div>' +
    tag + acts + '</div>';
}

function renderTasks(){
  var today = todayStr();
  var list = S.tasks.filter(function(k){
    if(taskFilter === "today") return k.date === today;
    if(taskFilter === "open") return !k.done;
    if(taskFilter === "done") return k.done;
    return true;
  }).sort(byWhen);
  $("#taskList").innerHTML = list.map(function(k){ return taskHTML(k, true); }).join("");
  $("#taskEmpty").classList.toggle("hidden", list.length > 0);
  $$("#taskFilters .chip").forEach(function(c){
    c.classList.toggle("active", c.getAttribute("data-filter") === taskFilter);
  });
}

function getTask(id){
  for(var i = 0; i < S.tasks.length; i++){ if(S.tasks[i].id === id) return S.tasks[i]; }
  return null;
}
function openTaskModal(id){
  editingTask = id;
  var k = id ? getTask(id) : null;
  var title = $("#modalTitle");
  var key = k ? "editTask" : "addTask";
  title.setAttribute("data-i18n", key);
  title.textContent = t(key);
  var now = new Date();
  $("#tkTitle").value = k ? k.title : "";
  $("#tkDate").value = k ? k.date : todayStr();
  $("#tkTime").value = k ? k.time : (pad(now.getHours()) + ":" + pad(now.getMinutes()));
  $("#tkPrio").value = k ? k.prio : "normal";
  $("#modal").classList.remove("hidden");
  $("#tkTitle").focus();
}
function closeTaskModal(){
  $("#modal").classList.add("hidden");
  editingTask = null;
}
function saveTaskForm(e){
  e.preventDefault();
  var title = $("#tkTitle").value.trim();
  if(!title) return;
  var data = {
    title: title,
    date: $("#tkDate").value || todayStr(),
    time: $("#tkTime").value || "09:00",
    prio: $("#tkPrio").value
  };
  if(editingTask){
    var k = getTask(editingTask);
    if(k){ k.title = data.title; k.date = data.date; k.time = data.time; k.prio = data.prio; }
  }else{
    S.tasks.push({ id: uid(), title: data.title, date: data.date, time: data.time, prio: data.prio, done: false });
  }
  save("tasks", S.tasks);
  closeTaskModal();
  renderCurrent();
  toast(t("taskSaved"));
}
function toggleTask(id){
  var k = getTask(id);
  if(!k) return;
  k.done = !k.done;
  save("tasks", S.tasks);
  renderCurrent();
}
function deleteTask(id){
  if(!confirm(t("confirmDelTask"))) return;
  S.tasks = S.tasks.filter(function(k){ return k.id !== id; });
  save("tasks", S.tasks);
  renderCurrent();
}
function onTaskClick(e){
  var b = e.target.closest("[data-act]");
  if(!b) return;
  var row = b.closest(".task");
  if(!row) return;
  var id = row.getAttribute("data-id");
  var act = b.getAttribute("data-act");
  if(act === "toggle") toggleTask(id);
  else if(act === "edit") openTaskModal(id);
  else if(act === "del") deleteTask(id);
}
function checkReminders(){
  if(!S.settings.notif) return;
  var now = new Date();
  var d = todayStr();
  var nowM = now.getHours() * 60 + now.getMinutes();
  S.tasks.forEach(function(k){
    if(k.done || k.date !== d || k.prio === "normal") return;
    var key = k.id + k.date + k.time;
    if(notified[key]) return;
    var p = k.time.split(":");
    var m = (+p[0]) * 60 + (+p[1]);
    if(m <= nowM && nowM - m <= 5){
      notified[key] = true;
      toast(tf("remindTitle", { title: k.title }));
    }
  });
}
function bindTasks(){
  $("#addTaskBtn").addEventListener("click", function(){ openTaskModal(null); });
  $("#modalCancel").addEventListener("click", closeTaskModal);
  $("#taskForm").addEventListener("submit", saveTaskForm);
  $("#modal").addEventListener("click", function(e){ if(e.target === this) closeTaskModal(); });
  $("#taskFilters").addEventListener("click", function(e){
    var c = e.target.closest(".chip");
    if(!c) return;
    taskFilter = c.getAttribute("data-filter");
    renderTasks();
  });
  $("#taskList").addEventListener("click", onTaskClick);
  $("#dashTasks").addEventListener("click", onTaskClick);
  setInterval(checkReminders, 30000);
  setTimeout(checkReminders, 1500);
}

/* ---------- الملاحظات ---------- */
var currentNote = null;
var noteTimer = null;

function getNote(id){
  for(var i = 0; i < S.notes.length; i++){ if(S.notes[i].id === id) return S.notes[i]; }
  return null;
}
function renderNoteList(){
  var q = $("#noteSearch").value.trim().toLowerCase();
  var list = S.notes.slice().sort(function(a, b){ return b.updated - a.updated; }).filter(function(n){
    if(!q) return true;
    return (n.title || "").toLowerCase().indexOf(q) > -1 || (n.body || "").toLowerCase().indexOf(q) > -1;
  });
  var box = $("#noteList");
  if(!list.length){
    box.innerHTML = '<p class="empty">' + esc(t("noNotes")) + '</p>';
    return;
  }
  box.innerHTML = list.map(function(n){
    return '<div class="note-item' + (n.star ? " star" : "") + (n.id === currentNote ? " active" : "") + '" data-id="' + n.id + '">' +
      '<div class="t">' + esc(n.title || t("untitledNote")) + '</div>' +
      '<small>' + esc((n.body || "").slice(0, 40)) + '</small></div>';
  }).join("");
}
function fillEditor(){
  var n = getNote(currentNote);
  $("#noteTitle").value = n ? n.title : "";
  $("#noteBody").value = n ? n.body : "";
  $("#noteStar").classList.toggle("primary", !!(n && n.star));
  $("#noteSaved").textContent = "";
}
function renderNotes(){
  if(!getNote(currentNote)){ currentNote = S.notes.length ? S.notes[0].id : null; }
  renderNoteList();
  fillEditor();
}
function newNote(){
  var n = { id: uid(), title: "", body: "", star: false, updated: Date.now() };
  S.notes.unshift(n);
  currentNote = n.id;
  save("notes", S.notes);
  renderNotes();
  $("#noteTitle").focus();
}
function onNoteInput(){
  if(!currentNote){
    var n0 = { id: uid(), title: "", body: "", star: false, updated: Date.now() };
    S.notes.unshift(n0);
    currentNote = n0.id;
  }
  clearTimeout(noteTimer);
  noteTimer = setTimeout(function(){
    var n = getNote(currentNote);
    if(!n) return;
    n.title = $("#noteTitle").value;
    n.body = $("#noteBody").value;
    n.updated = Date.now();
    save("notes", S.notes);
    renderNoteList();
    $("#noteSaved").textContent = t("saved");
  }, 350);
}
function bindNotes(){
  $("#addNoteBtn").addEventListener("click", newNote);
  $("#noteSearch").addEventListener("input", renderNoteList);
  $("#noteTitle").addEventListener("input", onNoteInput);
  $("#noteBody").addEventListener("input", onNoteInput);
  $("#noteList").addEventListener("click", function(e){
    var it = e.target.closest(".note-item");
    if(!it) return;
    currentNote = it.getAttribute("data-id");
    renderNoteList();
    fillEditor();
  });
  $("#noteStar").addEventListener("click", function(){
    var n = getNote(currentNote);
    if(!n) return;
    n.star = !n.star;
    n.updated = Date.now();
    save("notes", S.notes);
    renderNoteList();
    $("#noteStar").classList.toggle("primary", n.star);
  });
  $("#noteDelete").addEventListener("click", function(){
    var n = getNote(currentNote);
    if(!n) return;
    if(!confirm(t("confirmDelNote"))) return;
    S.notes = S.notes.filter(function(x){ return x.id !== n.id; });
    currentNote = null;
    save("notes", S.notes);
    renderNotes();
  });
}

/* ---------- الأدوات الذكية ---------- */
var TOOLS = [
  { id: "writer", e: "✍️", cat: "write",
    ar: ["مساعد الكتابة", "حسّن نصوصك وأعد صياغتها بأسلوب أفضل", "ساعدني في تحسين هذا النص: "],
    en: ["Writing assistant", "Polish and rephrase your text", "Help me improve this text: "] },
  { id: "summ", e: "📝", cat: "write",
    ar: ["تلخيص النصوص", "اختصر المقالات الطويلة في نقاط", "لخّص لي النص التالي: "],
    en: ["Summarizer", "Shorten long articles into key points", "Summarize the following text: "] },
  { id: "trans", e: "🌐", cat: "write",
    ar: ["الترجمة", "ترجمة بين العربية والإنجليزية", "ترجم النص التالي: "],
    en: ["Translator", "Translate between Arabic and English", "Translate the following text: "] },
  { id: "studyplan", e: "📚", cat: "study",
    ar: ["خطة مذاكرة", "جدول مذاكرة مناسب لوقتك", "ضع لي خطة مذاكرة لمادة: "],
    en: ["Study plan", "A study schedule that fits your time", "Make me a study plan for: "] },
  { id: "quiz", e: "❓", cat: "study",
    ar: ["اختبرني", "أسئلة سريعة لقياس فهمك", "اختبرني بخمسة أسئلة في: "],
    en: ["Quiz me", "Quick questions to test your understanding", "Quiz me with five questions on: "] },
  { id: "day", e: "📅", cat: "work",
    ar: ["تنظيم اليوم", "رتّب مهامك حسب الأولوية", "نظّم لي يومي بناءً على مهامي"],
    en: ["Plan my day", "Order your tasks by priority", "Organize my day based on my tasks"] },
  { id: "mail", e: "✉️", cat: "work",
    ar: ["كتابة رسالة", "رسائل رسمية وودية جاهزة", "اكتب لي رسالة رسمية عن: "],
    en: ["Write a message", "Formal and friendly messages", "Write me a formal message about: "] },
  { id: "ideas", e: "💡", cat: "fun",
    ar: ["عصف ذهني", "أفكار جديدة لأي موضوع", "أعطني 10 أفكار حول: "],
    en: ["Brainstorm", "Fresh ideas for any topic", "Give me 10 ideas about: "] }
];
var toolCat = "all";

function toolText(tool){ return tool[S.settings.lang === "en" ? "en" : "ar"]; }

function toolCardHTML(tool){
  var tx = toolText(tool);
  var fav = S.favs.indexOf(tool.id) > -1;
  return '<div class="tool-card glass" data-id="' + tool.id + '">' +
    '<button type="button" class="icon-btn tool-fav' + (fav ? " on" : "") + '" data-act="fav" aria-label="favorite">' +
    '<svg class="ic"><use href="#i-star"/></svg></button>' +
    '<div class="tool-emoji">' + tool.e + '</div>' +
    '<h4>' + esc(tx[0]) + '</h4><p>' + esc(tx[1]) + '</p>' +
    '<button type="button" class="btn ghost sm" data-act="use">' + esc(t("tryTool")) + '</button></div>';
}
function renderTools(){
  var cats = [["all", "catAll"], ["write", "catWrite"], ["study", "catStudy"], ["work", "catWork"], ["fun", "catFun"]];
  $("#toolChips").innerHTML = cats.map(function(c){
    return '<button type="button" class="chip' + (toolCat === c[0] ? " active" : "") + '" data-cat="' + c[0] + '">' + esc(t(c[1])) + '</button>';
  }).join("");
  var list = TOOLS.filter(function(x){ return toolCat === "all" || x.cat === toolCat; });
  $("#toolGrid").innerHTML = list.map(toolCardHTML).join("");
}
function renderFavs(){
  var list = TOOLS.filter(function(x){ return S.favs.indexOf(x.id) > -1; });
  $("#favGrid").innerHTML = list.map(toolCardHTML).join("");
  $("#favEmpty").classList.toggle("hidden", list.length > 0);
}
function toggleFav(id){
  var i = S.favs.indexOf(id);
  if(i > -1) S.favs.splice(i, 1); else S.favs.push(id);
  save("favs", S.favs);
  renderCurrent();
}
function useTool(id){
  var tool = null;
  for(var i = 0; i < TOOLS.length; i++){ if(TOOLS[i].id === id) tool = TOOLS[i]; }
  if(!tool) return;
  showPage("chats");
  var inp = $("#chatInput");
  inp.value = toolText(tool)[2];
  inp.focus();
}
function onToolClick(e){
  var card = e.target.closest(".tool-card");
  if(!card) return;
  var id = card.getAttribute("data-id");
  var b = e.target.closest("[data-act]");
  if(b && b.getAttribute("data-act") === "fav"){ toggleFav(id); return; }
  useTool(id);
}
function bindTools(){
  $("#toolGrid").addEventListener("click", onToolClick);
  $("#favGrid").addEventListener("click", onToolClick);
  $("#toolChips").addEventListener("click", function(e){
    var c = e.target.closest(".chip");
    if(!c) return;
    toolCat = c.getAttribute("data-cat");
    renderTools();
  });
}

/* ===== نهاية الجزء 2-أ – الصق الجزء 2-ب تحت هذا السطر مباشرة ===== */
/* =====================================================
   الجزء 2-ب: الإحصائيات + الإعدادات + الملف الشخصي
   + الاشتراكات + الملفات + البحث + التشغيل
   ===================================================== */

/* ---------- الإحصائيات ---------- */
var weekBars = [];

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function nowStr(){
  var d = new Date();
  return todayStr() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function renderStats(){
  var msgs = 0;
  S.chats.forEach(function(c){ msgs += c.messages.length; });
  var done = S.tasks.filter(function(k){ return k.done; }).length;
  $("#stChats").textContent = S.chats.length;
  $("#stDone").textContent = done;
  $("#stNotes").textContent = S.notes.length;
  $("#stMsgs").textContent = msgs;
  $("#chartTip").textContent = t("tipDefault");
  drawWeek();
  drawTasksChart();
}

function drawWeek(){
  var cv = $("#chartWeek"), ctx = cv.getContext("2d");
  var W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  var days = [], i;
  for(i = 6; i >= 0; i--){ days.push(addDays(todayStr(), -i)); }
  var vals = days.map(function(d){ return S.activity[d] || 0; });
  var max = Math.max(4, Math.max.apply(null, vals));
  var padL = 30, padB = 34, padT = 24;
  var cw = (W - padL - 10) / 7;
  var accent = cssVar("--accent") || "#ff1f3d";
  var rgb = cssVar("--accent-rgb") || "255,31,61";
  var muted = cssVar("--muted") || "#999";
  var loc = S.settings.lang === "ar" ? "ar-EG" : "en-US";

  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.fillStyle = muted;
  for(i = 0; i <= 4; i++){
    var gy = padT + (H - padT - padB) * i / 4;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - 6, gy); ctx.stroke();
  }
  weekBars = [];
  for(i = 0; i < 7; i++){
    var bh = (H - padT - padB) * vals[i] / max;
    var x = padL + i * cw + cw * 0.2, w = cw * 0.6, y = H - padB - bh;
    var g = ctx.createLinearGradient(0, y, 0, H - padB);
    g.addColorStop(0, accent);
    g.addColorStop(1, "rgba(" + rgb + ",.25)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, bh);
    ctx.fillStyle = muted;
    var p = days[i].split("-");
    var lbl = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(loc, { weekday: "short" });
    ctx.fillText(lbl, x + w / 2, H - 12);
    if(vals[i] > 0){ ctx.fillText(String(vals[i]), x + w / 2, y - 6); }
    weekBars.push({ from: padL + i * cw, to: padL + (i + 1) * cw, d: days[i], n: vals[i] });
  }
}

function drawTasksChart(){
  var cv = $("#chartTasks"), ctx = cv.getContext("2d");
  var W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  var now = nowStr();
  var done = 0, late = 0, open = 0;
  S.tasks.forEach(function(k){
    if(k.done) done++;
    else if((k.date + " " + k.time) < now) late++;
    else open++;
  });
  var total = Math.max(1, done + late + open);
  var rows = [
    [t("lblDone"), done, "#19d38a"],
    [t("lblOpen"), open, cssVar("--accent") || "#ff1f3d"],
    [t("lblLate"), late, "#ffc01f"]
  ];
  var muted = cssVar("--muted") || "#999";
  ctx.font = "15px sans-serif";
  ctx.textBaseline = "middle";
  rows.forEach(function(r, i){
    var y = 30 + i * 62;
    var bw = (W - 200) * r[1] / total;
    ctx.textAlign = "left";
    ctx.fillStyle = muted;
    ctx.fillText(r[0], 10, y + 14);
    ctx.fillStyle = "rgba(255,255,255,.07)";
    ctx.fillRect(130, y, W - 200, 28);
    ctx.fillStyle = r[2];
    ctx.fillRect(130, y, bw, 28);
    ctx.fillStyle = muted;
    ctx.fillText(String(r[1]), W - 56, y + 14);
  });
}

function bindStats(){
  $("#chartWeek").addEventListener("click", function(e){
    var cv = this, r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) * cv.width / r.width;
    for(var i = 0; i < weekBars.length; i++){
      if(x >= weekBars[i].from && x <= weekBars[i].to){
        $("#chartTip").textContent = tf("tipBar", { d: weekBars[i].d, n: weekBars[i].n });
        return;
      }
    }
  });
}

/* ---------- الإعدادات ---------- */
function syncSettingsUI(){
  var st = S.settings;
  $$("#themeSeg button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-theme") === st.theme); });
  $$("#langSeg button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-lang") === st.lang); });
  $$("#accentSwatches button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-accent") === st.accent); });
  $("#fontRange").value = st.font;
  $("#notifToggle").checked = !!st.notif;
  $("#saveChatsToggle").checked = !!st.saveChats;
}
function saveSettings(){ save("settings", S.settings); }

function exportData(){
  var data = {
    exportedAt: new Date().toISOString(),
    profile: S.profile, settings: S.settings, chats: S.chats,
    tasks: S.tasks, notes: S.notes, favs: S.favs, activity: S.activity
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "rafiq-data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast(t("exported"));
}
function resetAll(){
  if(!confirm(t("confirmReset"))) return;
  Object.keys(localStorage).forEach(function(k){
    if(k.indexOf(KEY_PREFIX) === 0) localStorage.removeItem(k);
  });
  location.reload();
}

function bindSettings(){
  $("#themeSeg").addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b) return;
    S.settings.theme = b.getAttribute("data-theme");
    saveSettings(); applySettings(); syncSettingsUI();
  });
  $("#langSeg").addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b) return;
    S.settings.lang = b.getAttribute("data-lang");
    saveSettings(); applySettings(); setAuthMode(authMode); renderCurrent();
  });
  $("#accentSwatches").addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b) return;
    S.settings.accent = b.getAttribute("data-accent");
    saveSettings(); applySettings(); syncSettingsUI();
  });
  $("#fontRange").addEventListener("input", function(){
    S.settings.font = parseInt(this.value, 10) || 16;
    saveSettings(); applySettings();
  });
  $("#notifToggle").addEventListener("change", function(){
    S.settings.notif = this.checked; saveSettings();
  });
  $("#saveChatsToggle").addEventListener("change", function(){
    S.settings.saveChats = this.checked; saveSettings();
    if(this.checked) save("chats", S.chats);
  });
  $("#exportBtn").addEventListener("click", exportData);
  $("#resetBtn").addEventListener("click", resetAll);
}

/* ---------- الملف الشخصي ---------- */
function syncProfileUI(){
  $("#pfName").value = S.profile.name || "";
  $("#pfEmail").value = S.profile.email || "";
  $("#pfBio").value = S.profile.bio || "";
  syncAvatars();
}
function resizeImage(file, size, cb){
  var reader = new FileReader();
  reader.onload = function(){
    var img = new Image();
    img.onload = function(){
      var cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      var ctx = cv.getContext("2d");
      var s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      cb(cv.toDataURL("image/jpeg", 0.8));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function bindProfile(){
  $("#pfSave").addEventListener("click", function(){
    S.profile.name = $("#pfName").value.trim() || S.profile.name;
    S.profile.email = $("#pfEmail").value.trim();
    S.profile.bio = $("#pfBio").value.trim();
    save("profile", S.profile);
    $("#helloName").textContent = S.profile.name;
    toast(t("profileSaved"));
  });
  $("#pfAvatar").addEventListener("change", function(){
    var f = this.files && this.files[0];
    if(!f) return;
    resizeImage(f, 200, function(url){
      S.profile.avatar = url;
      save("profile", S.profile);
      syncAvatars();
      toast(t("profileSaved"));
    });
    this.value = "";
  });
}

/* ---------- الاشتراكات (عرض فقط) ---------- */
function syncPlansUI(){
  $$("[data-plan]").forEach(function(b){
    var plan = b.getAttribute("data-plan");
    var isCur = plan === S.profile.plan;
    var key = isCur ? "currentPlan" : (plan === "pro" ? "choosePro" : "chooseFree");
    b.setAttribute("data-i18n", key);
    b.textContent = t(key);
    b.classList.toggle("primary", !isCur);
    b.classList.toggle("ghost", isCur);
  });
}
function bindPlans(){
  $$("[data-plan]").forEach(function(b){
    b.addEventListener("click", function(){
      S.profile.plan = b.getAttribute("data-plan");
      save("profile", S.profile);
      syncPlansUI();
      toast(t("planSaved"));
    });
  });
}

/* ---------- إدارة الملفات (في الذاكرة فقط، لا رفع لأي خادم) ---------- */
var pickedFiles = [];

function fmtSize(b){
  if(b < 1024) return b + " B";
  if(b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
function renderFiles(){
  var box = $("#fileList");
  box.innerHTML = pickedFiles.map(function(f){
    var isImg = f.type.indexOf("image/") === 0;
    var thumb = isImg
      ? '<img alt="" src="' + f.url + '" data-act="view">'
      : '<div class="file-ico"><svg class="ic"><use href="#i-file"/></svg></div>';
    return '<div class="file-item" data-id="' + f.id + '">' +
      '<button type="button" class="file-del" data-act="del" aria-label="delete"><svg class="ic"><use href="#i-close"/></svg></button>' +
      thumb +
      '<div class="file-name">' + esc(f.name) + '</div>' +
      '<div class="file-size">' + fmtSize(f.size) + '</div></div>';
  }).join("");
  $("#fileEmpty").classList.toggle("hidden", pickedFiles.length > 0);
}
function addFiles(list){
  if(!list || !list.length) return;
  for(var i = 0; i < list.length; i++){
    var f = list[i];
    pickedFiles.push({ id: uid(), name: f.name, size: f.size, type: f.type || "", url: URL.createObjectURL(f) });
  }
  renderFiles();
  toast(t("fileAdded"));
}
function bindFiles(){
  $("#imgInput").addEventListener("change", function(){ addFiles(this.files); this.value = ""; });
  $("#fileInput").addEventListener("change", function(){ addFiles(this.files); this.value = ""; });
  $("#fileList").addEventListener("click", function(e){
    var item = e.target.closest(".file-item");
    if(!item) return;
    var id = item.getAttribute("data-id");
    var b = e.target.closest("[data-act]");
    if(!b) return;
    var act = b.getAttribute("data-act");
    if(act === "del"){
      pickedFiles = pickedFiles.filter(function(f){
        if(f.id === id){ URL.revokeObjectURL(f.url); return false; }
        return true;
      });
      renderFiles();
    }else if(act === "view"){
      for(var i = 0; i < pickedFiles.length; i++){
        if(pickedFiles[i].id === id){
          $("#previewImg").src = pickedFiles[i].url;
          $("#preview").classList.remove("hidden");
        }
      }
    }
  });
  $("#preview").addEventListener("click", function(){ this.classList.add("hidden"); });
}

/* ---------- البحث العام ---------- */
function bindSearch(){
  var pill = $("#searchPill"), inp = $("#globalSearch");
  $("#searchBtn").addEventListener("click", function(){
    pill.classList.toggle("open");
    if(pill.classList.contains("open")) inp.focus();
  });
  inp.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    var q = inp.value.trim().toLowerCase();
    if(!q) return;
    var hasNote = S.notes.some(function(n){ return (n.title + " " + n.body).toLowerCase().indexOf(q) > -1; });
    var hasChat = S.chats.some(function(c){
      return (c.title || "").toLowerCase().indexOf(q) > -1 ||
        c.messages.some(function(m){ return m.text.toLowerCase().indexOf(q) > -1; });
    });
    var hasTask = S.tasks.some(function(k){ return k.title.toLowerCase().indexOf(q) > -1; });
    if(hasNote){ showPage("notes"); $("#noteSearch").value = inp.value.trim(); renderNoteList(); }
    else if(hasChat){ showPage("chats"); $("#chatSearch").value = inp.value.trim(); renderChatList(); }
    else if(hasTask){ showPage("tasks"); }
    else{ toast(t("noResults")); return; }
    inp.value = "";
    pill.classList.remove("open");
  });
}

/* ---------- التشغيل ---------- */
function init(){
  injectCSS();
  applySettings();
  bindCore();
  bindChat();
  bindTasks();
  bindNotes();
  bindTools();
  bindStats();
  bindSettings();
  bindProfile();
  bindPlans();
  bindFiles();
  bindSearch();
  setAuthMode("login");
  syncAvatars();
  showAuth(!S.user);
  showPage("dashboard");
}
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
}else{
  init();
}