const tabs = document.querySelectorAll(".sidebar > div");
const pages = document.querySelectorAll("main");

async function getCompletions() {
    const response = await fetch("/api/completions");

    if (!response.ok) {
        throw new Error("Failed to fetch completions");
    }

    const data = await response.json();
    console.log(data);
    return data;
}

getCompletions();

tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        pages.forEach(p => p.classList.remove("active"));

        tab.classList.add("active");
        pages[index].classList.add("active");
    });
});

const examList = document.querySelector("#exam-list");
async function loadExams() {
    const response = await fetch("/api/exams");
    const exams = await response.json();

    examList.replaceChildren();

    exams.forEach(file => {
        // Nguy hiem kinh khung khiep
        examList.innerHTML = `
        <div class="exam-option" onclick='redirect("${file.id}")'>
            <div class="exam-name">${file.title}</div>
            <div class="exam-subject">${file.subject}</div>
        </div>
        `;
    });
}

loadExams();

const $ = id => document.getElementById(id);

function redirect(id) {
    window.location.href = `/exam/${id}`;
}

const settingIds = [
    "shuffle-questions",
    "shuffle-choices",
    "check-mode",
    "restart-on-wrong"
];

function saveSettings() {
    const settings = {
        shuffleQuestions: $("shuffle-questions").checked,
        shuffleChoices: $("shuffle-choices").checked,
        checkMode: $("check-mode").value,
        restartOnWrong: $("restart-on-wrong").checked
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
}

settingIds.forEach(id => {
    $(id).addEventListener("change", saveSettings);
});

loadSettings();

const nameInput = $("name-input");
const nameError = $("name-error");

function sanitizeName(value) {
    return value
        .normalize("NFC")
        .replace(/\p{Cc}/gu, "")
        .trim();
}

function validateName(value) {
    if (!value) return "Tên không được để trống.";
    if ([...value].length > 30) return "Tên tối đa 30 ký tự.";

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

function getValidUsername() {
    const name = sanitizeName(nameInput.value);
    const result = getNameError(name);

    if (result.redirect) {
        window.location.href = "/warn";
        return null;
    }

    nameError.textContent = result.error;

    if (result.error) {
        nameInput.focus();
        return null;
    }

    localStorage.setItem("username", name);
    return name;
}

// Load saved username
nameInput.value = localStorage.getItem("username") || "";

// Validate while typing
nameInput.addEventListener("input", () => {
    const name = sanitizeName(nameInput.value);
    const result = getNameError(name);

    if (result.redirect) {
        window.location.href = "/warn";
        return;
    }

    nameError.textContent = result.error;

    if (!result.error) {
        localStorage.setItem("username", name);
        $("username").textContent = `${name}`
    }
});

const menuToggle = document.querySelector("#menu-toggle");
const sidebar = document.querySelector(".sidebar");

menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.textContent = isOpen ? "✕" : "☰";
});
sidebar.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.textContent = isOpen ? "✕" : "☰";
})