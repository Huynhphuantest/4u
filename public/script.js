const $ = (id) => document.getElementById(id);

const TABS = [
    { id: "hist", icon: "history_edu", name: "Lịch Sử" },
    { id: "geo", icon: "globe", name: "Địa Lý" },
    { id: "gdqp", icon: "military_tech", name: "GDQP-AN" },
    { id: "eng", icon: "translate", name: "Tiếng Anh" },
    { id: "bio", icon: "microbiology", name: "Sinh Học" },
    { id: "gdkt", icon: "balance", name: "GDKT-PL" },
    { id: "chem", icon: "experiment", name: "Hóa Học"}
];
const TAB_ELEMENTS = [];

const DEFAULT_PFP = "assets/default_pfp.jpeg";
const sidebar = document.querySelector(".sidebar");
const layout = document.querySelector(".layout");


const SETTING_IDS = [
    "shuffle-questions",
    "shuffle-choices",
    "check-mode",
    "restart-on-wrong"
];

let completions = [];
let exams = [];

async function init() {
    createTabs();
    setupTabNavigation();
    setupRankingToggles();
    setupSettings();
    setupUsername();
    setupMenu();
    setupProfilePicture();

    await Promise.all([
        loadExams(),
        loadCompletions()
    ]);
}

init().catch(console.error);

function createTabs() {
    const tabTemplate = document.querySelector("#tab-template");
    const sidebarTemplate = document.querySelector("#sidebar-button-template");

    TABS.forEach((tab, index) => {
        // Main tab
        const main = tabTemplate.content.firstElementChild.cloneNode(true);

        main.querySelector("h1").textContent = tab.name;
        main.querySelector(".exam-list").id = tab.id;

        TAB_ELEMENTS.push(main);
        layout.append(main);

        // Sidebar button
        const button = sidebarTemplate.content.firstElementChild.cloneNode(true);

        button.querySelector(".icon").textContent = tab.icon;
        button.querySelector(".name").textContent = tab.name;

        sidebar.append(button);
    });
}
function setupTabNavigation() {
    const buttons = [...sidebar.children];
    const pages = [...document.querySelectorAll(".layout > main")];

    buttons.forEach((button, index) => {
        button.addEventListener("click", () => {
            buttons.forEach(item => item.classList.remove("active"));
            pages.forEach(page => page.classList.remove("active"));

            button.classList.add("active");
            pages[index]?.classList.add("active");

            closeMenu();
        });
    });
}
function setupRankingToggles() {
    TAB_ELEMENTS.forEach(main => {
        const toggle = main.querySelector(".change-page");
        const ranking = main.querySelector(".ranking");
        const examList = main.querySelector(".exam-list");

        toggle.addEventListener("click", () => {
            const showingRanking = ranking.classList.toggle("active");

            examList.classList.toggle("active", !showingRanking);
            toggle.textContent = showingRanking ? "list" : "trophy";
        });
    });
}
async function loadExams() {
    try {
        const response = await fetch("/api/exams");

        if (!response.ok) {
            throw new Error("Failed to fetch exams");
        }

        exams = await response.json();
        renderExams();
    } catch (error) {
        console.error("Failed to load exams:", error);

        document.querySelectorAll(".exam-list").forEach(list => {
            list.classList.remove("loading");
            list.textContent = "Không thể tải danh sách đề thi.";
        });
    }
}

function renderExams() {
    document.querySelectorAll(".exam-list").forEach(list => {
        const fragment = document.createDocumentFragment();

        const filtered = exams.filter(exam =>
            exam.id.split("-")[0] === list.id
        );

        filtered.forEach(exam => {
            fragment.append(createExamCard(exam));
        });

        list.replaceChildren(fragment);
        list.classList.remove("loading");
    });
}
function createExamCard(exam) {
    const type = exam.id.split("-")[0];
    const tab = TABS.find(item => item.id === type);

    const template = document.getElementById("exam-card-template");
    const card = template.content.firstElementChild.cloneNode(true);

    if (exam.outdated) card.classList.add("outdated");

    card.querySelector(".exam-icon").textContent = tab?.icon ?? "description";
    card.querySelector(".exam-name").textContent = exam.title;
    card.querySelector(".exam-subject").textContent = exam.subject;

    card.addEventListener("click", () => redirect(exam.id));

    return card;
}
async function loadCompletions() {
    try {
        const response = await fetch("/api/completions");

        if (!response.ok) {
            throw new Error("Failed to fetch completions");
        }

        completions = await response.json();
        renderRankings();
    } catch (error) {
        console.error("Failed to load rankings:", error);

        document.querySelectorAll(".ranking").forEach(element => {
            element.classList.remove("loading");
            element.textContent = "Không thể tải bảng xếp hạng.";
        });
    }
}
function sortCompletions(data) {
    return [...data].sort((a, b) =>
        b.score - a.score || a.duration - b.duration
    );
}
function getBestCompletions(data) {
    const seen = new Set();

    return data.filter(item => {
        if (seen.has(item.username)) return false;

        seen.add(item.username);
        return true;
    });
}
function redirect(id) {
    window.location.href = `/exam/${encodeURIComponent(id)}`;
}
async function renderRankings() {
    const sorted = sortCompletions(completions);

    await Promise.all(TABS.map(async tab => {
        const ranking = document.querySelector(
            `#${tab.id} + .ranking`
        );

        // Keep the best result for each user within this subject.
        const subjectRanks = getBestCompletions(
            sorted.filter(item => item.exam.split("-")[0] === tab.id)
        );

        const cards = await Promise.all(
            subjectRanks.map(createRankCard)
        );

        ranking.replaceChildren(...cards);
        ranking.classList.remove("loading");
    }));
}

async function createRankCard(rank) {
    const template = document.getElementById("rank-card-template");
    const card = template.content.firstElementChild.cloneNode(true);

    const img = card.querySelector("img");
    if(!rank.pfp_id) img.src = DEFAULT_PFP;
    else getPfp(rank.pfp_id).then(pfp => {
        img.src = pfp
        ? pfp
        : DEFAULT_PFP;
    })

    card.querySelector(".rank-username").textContent = rank.username;
    card.querySelector(".rank-score").textContent = rank.score;

    const info = card.querySelector(".rank-info");

    info.append(
        createInfoRow(
            "Thời gian làm bài:",
            `${Math.round(rank.duration * 100) / 100}s`
        ),
        createInfoRow(
            "Thời gian nộp bài:",
            formatCompletionDate(rank.completed_at)
        )
    );

    return card;
}

function createInfoRow(label, value) {
    const row = document.createElement("div");
    row.className = "info";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "value";
    valueElement.textContent = value;

    row.append(labelElement, valueElement);
    return row;
}

function formatCompletionDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}
const PFP_CACHE = new Map(); // May no longer be nessecary
async function getPfp(id) {
    if (PFP_CACHE.has(id)) {
        return PFP_CACHE.get(id);
    }

    const promise = fetch(`/api/pfps/${encodeURIComponent(id)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load profile picture: ${id}`);
            }

            return response.text();
        })
        .then(base64 => `data:image/jpeg;base64,${base64}`)
        .catch(error => {
            console.error(error);
            return DEFAULT_PFP;
        });

    PFP_CACHE.set(id, promise);
    return promise;
}
function setupMenu() {
    const toggle = $("menu-toggle");

    toggle.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("open");

        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "✕" : "☰";
    });
}
function closeMenu() {
    const toggle = $("menu-toggle");

    sidebar.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";
}
function setupSettings() {
    loadSettings();

    SETTING_IDS.forEach(id => {
        $(id)?.addEventListener("change", saveSettings);
    });

    ["skip_multiple_choice", "skip_correctness"].forEach(id => {
        $(id)?.addEventListener("click", () => {
            saveSettings();
        });
    });
}
function saveSettings() {
    const settings = {
        shuffleQuestions: $("shuffle-questions").checked,
        shuffleChoices: $("shuffle-choices").checked,
        checkMode: $("check-mode").value,
        restartOnWrong: $("restart-on-wrong").checked,
        skip: [
            $("skip_multiple_choice").classList.contains("active")
                ? "multiple_choice"
                : null,
            $("skip_correctness").classList.contains("active")
                ? "correctness"
                : null
        ].filter(Boolean)
    };

    localStorage.setItem("exam-settings", JSON.stringify(settings));
}
function loadSettings() {
    const settings = JSON.parse(
        localStorage.getItem("exam-settings") || "{}"
    );

    $("shuffle-questions").checked = settings.shuffleQuestions ?? false;
    $("shuffle-choices").checked = settings.shuffleChoices ?? false;
    $("check-mode").value = settings.checkMode ?? "immediate";
    $("restart-on-wrong").checked = settings.restartOnWrong ?? false;

    $("skip_multiple_choice").classList.toggle(
        "active", settings.skip?.includes("multiple_choice") ?? false
    );

    $("skip_correctness").classList.toggle(
        "active", settings.skip?.includes("correctness") ?? false
    );
}
function sanitizeName(value) {
    return value.normalize("NFC").replace(/\p{Cc}/gu, "").trim();
}
function validateName(value) {
    if (!value) return "Tên không được để trống.";
    if ([...value].length > 20) return "Tên tối đa 20 ký tự.";

    if (!/^[\p{L}\p{M}\p{N} _.-]+$/u.test(value)) {
        return "Tên chứa ký tự không hợp lệ.";
    }

    return "";
}
function getNameError(name) {
    const lower = name.toLowerCase();

    if (lower.includes("tèo")) {
        return { redirect: true, error: "" };
    }

    if (lower.includes("teo") || lower.includes("oanh")) {
        return { redirect: false, error: "Con mẹ mày nha." };
    }

    return { redirect: false, error: validateName(name) };
}
function setupUsername() {
    const input = $("name-input");
    const error = $("name-error");

    input.value = localStorage.getItem("username") || "";
    $("username").textContent = input.value;

    input.addEventListener("input", () => {
        const name = sanitizeName(input.value);
        const result = getNameError(name);

        if (result.redirect) {
            window.location.href = "/warn";
            return;
        }

        error.textContent = result.error;

        if (!result.error) {
            localStorage.setItem("username", name);
            $("username").textContent = name;
        }
    });
}
function getValidUsername() {
    const input = $("name-input");
    const name = sanitizeName(input.value);
    const result = getNameError(name);

    if (result.redirect) {
        window.location.href = "/warn";
        return null;
    }

    $("name-error").textContent = result.error;

    if (result.error) {
        input.focus();
        return null;
    }

    localStorage.setItem("username", name);
    return name;
}
function setupProfilePicture() {
    const input = $("pfpInput");
    const preview = $("pfp");

    const savedPfp = localStorage.getItem("pfp");

    if (savedPfp) {
        preview.src = savedPfp;
    } else {
        saveDefaultPfp(preview);
    }

    input.addEventListener("change", () => {
        const file = input.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            input.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            localStorage.setItem("pfp", reader.result);
            preview.src = reader.result;
        };

        reader.readAsDataURL(file);
    });
}
async function saveDefaultPfp(preview) {
    try {
        const response = await fetch(DEFAULT_PFP);

        if (!response.ok) {
            throw new Error("Failed to load default profile picture");
        }

        const blob = await response.blob();

        const reader = new FileReader();

        reader.onload = () => {
            localStorage.setItem("pfp", reader.result);
        };

        reader.readAsDataURL(blob);
    } catch (error) {
        console.error(error);
    }
}
