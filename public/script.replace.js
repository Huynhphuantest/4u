
const TABS = [
    { id: "hist", icon: "history_edu", name: "Lịch Sử" },
    { id: "geo", icon: "globe", name: "Địa Lý" },
    { id: "gdqp", icon: "military_tech", name: "GDQP-AN" },
    { id: "eng", icon: "translate", name: "Tiếng Anh" },
    { id: "bio", icon: "microbiology", name: "Sinh Học" },
    { id: "gdkt", icon: "balance", name: "GDKT-PL" }
];

const $ = id => document.getElementById(id);
const SELECTORS = {
    sidebar: ".sidebar",
    layout: ".layout"
};

const DEFAULT_PFP = "assets/default_pfp.jpeg";
const PFP_CACHE = new Map();

let completions = [];
let exams = [];

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

function createTabs() {
    const sidebar = document.querySelector(SELECTORS.sidebar);
    const layout = document.querySelector(SELECTORS.layout);

    sidebar.replaceChildren();

    TABS.forEach((tab, index) => {
        const main = document.createElement("main");
        main.classList.toggle("active", index === 0);

        const top = document.createElement("div");
        top.className = "main-top";

        const heading = document.createElement("h1");
        heading.textContent = tab.name;

        const changePage = document.createElement("div");
        changePage.className = "change-page icon";
        changePage.textContent = "trophy";

        const examList = document.createElement("div");
        examList.className = "exam-list active loading";
        examList.id = tab.id;

        const ranking = document.createElement("div");
        ranking.className = "ranking loading";

        top.append(heading, changePage);
        main.append(top, examList, ranking);
        layout.append(main);

        const button = document.createElement("div");
        button.classList.toggle("active", index === 0);

        const icon = document.createElement("span");
        icon.className = "icon";
        icon.textContent = tab.icon;

        button.append(icon, document.createTextNode(` ${tab.name}`));
        sidebar.append(button);
    });
}

function setupTabNavigation() {
    const sidebar = document.querySelector(SELECTORS.sidebar);
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
    document.querySelectorAll(".layout > main").forEach(main => {
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

// ─────────────────────────────────────────────
// Completions and rankings
// ─────────────────────────────────────────────

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
    const card = document.createElement("div");
    card.className = "rank";

    const identity = document.createElement("div");
    identity.className = "rank-indentity";

    const img = document.createElement("img");
    img.src = rank.pfp_id
        ? await getPfp(rank.pfp_id)
        : DEFAULT_PFP;
    img.alt = "";

    const username = document.createElement("div");
    username.className = "rank-username";
    username.textContent = rank.username;

    const score = document.createElement("div");
    score.className = "rank-score";
    score.textContent = rank.score;

    identity.append(img, username, score);

    const breaker = document.createElement("div");
    breaker.className = "breaker";

    const info = document.createElement("div");
    info.className = "rank-info";

    info.append(
        createInfoRow("Thời gian làm bài:",
            `${Math.round(rank.duration * 100) / 100}s`),
        createInfoRow("Thời gian nộp bài:",
            formatCompletionDate(rank.completed_at))
    );

    card.append(identity, breaker, info);
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

// ─────────────────────────────────────────────
// Exams
// ─────────────────────────────────────────────

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

    const card = document.createElement("div");
    card.className = `exam-option${exam.outdated ? " outdated" : ""}`;

    const icon = document.createElement("div");
    icon.className = "exam-icon icon";
    icon.textContent = tab?.icon ?? "description";

    const details = document.createElement("div");
    details.style.cssText = "display:flex;flex-direction:column";

    const title = document.createElement("div");
    title.className = "exam-name";
    title.textContent = exam.title;

    const subject = document.createElement("div");
    subject.className = "exam-subject";
    subject.textContent = exam.subject;

    details.append(title, subject);
    card.append(icon, details);

    card.addEventListener("click", () => redirect(exam.id));

    return card;
}

function redirect(id) {
    window.location.href = `/exam/${encodeURIComponent(id)}`;
}

// ─────────────────────────────────────────────
// Profile picture cache
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────

const SETTING_IDS = [
    "shuffle-questions",
    "shuffle-choices",
    "check-mode",
    "restart-on-wrong"
];

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

// ─────────────────────────────────────────────
// Username
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Mobile menu
// ─────────────────────────────────────────────

function setupMenu() {
    const toggle = $("menu-toggle");
    const sidebar = document.querySelector(SELECTORS.sidebar);

    toggle.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("open");

        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "✕" : "☰";
    });
}

function closeMenu() {
    const sidebar = document.querySelector(SELECTORS.sidebar);
    const toggle = $("menu-toggle");

    sidebar.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";
}

// ─────────────────────────────────────────────
// Profile picture upload
// ─────────────────────────────────────────────

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
