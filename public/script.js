const tabs = ["hist", "geo", "gdqp", "eng", "bio", "gdkt"]
const tab_icons = ["history_edu", "globe", "military_tech", "translate", "microbiology", "balance"]
const tab_names = ["Lịch Sử", "Địa Lý", "GDQP-AN", "Tiếng Anh", "Sinh Học", "GDKT-PL"]
async function loadTab() {
    const sidebar = document.querySelector(".sidebar")
    const layout = document.querySelector(".layout");
    const tabArr = []
    tabs.forEach((tab, i) => {
        const icon = tab_icons[i];
        const name = tab_names[i];
        const main = document.createElement("main");
        main.innerHTML = `<div class="main-top">
          <div>
            <h1>${name}</h1>
          </div>
          <div class="change-page icon">trophy</div>
        </div>`
        const examList = document.createElement("div");
        examList.classList = "exam-list active loading";
        main.appendChild(examList);
        layout.appendChild(main);
        examList.id = tab;

        const button = document.createElement("div");
        button.innerHTML = `<span class="icon">${icon}</span> &nbsp; ${name}`
        sidebar.appendChild(button);

        const ranking = document.createElement("div");
        ranking.classList = "ranking loading";
        main.appendChild(ranking);
        
        tabArr.push(main);
    });

    loadAside();

    const response = await fetch("/api/completions");
    const pfps = await (await fetch("/api/pfps")).json();
    const data = await response.json();
    data.sort((a, b) => {
        let score = b.score - a.score;
        if(score === 0) return a.duration - b.duration;
        return score;
    });

    tabs.forEach((tab, i) => {
        const main = tabArr[i];
        const rankList = main.querySelector(".ranking");
        let ranks = data.filter(rank => rank.exam.split("-")[0] === tabs[i]);
        let position = ranks.filter((rank, index, arr) =>
            arr.findIndex(r => r.username === rank.username) === index
        ).slice(0, 3);
        //ranks = ranks.filter(rank => !position.includes(rank));
        ranks.forEach((rank) => {
            let pfp = pfps.find(o => o.id === rank.pfp_id);
            if(pfp) pfp = `data:image/jpeg;base64,` + pfp.image;
            else pfp = `assets/default_pfp.jpeg`;
            let rank_completed_at = rank.completed_at.replace(/[‐‑‒–—−-]/g, "/").replace("T", " ").split(".")[0].split(":");
            rankList.innerHTML += `
                <div class="rank">
                    <div class="rank-indentity">
                        <img src="${pfp}">
                        <div class="rank-username">${rank.username}</div>
                        <div class="rank-score">${rank.score}</div>
                    </div>
                    <div class="breaker"></div>
                    <div class="rank-info">
                        <div class="info">
                            <span>Thời gian làm bài:</span>
                            <span class="value">${Math.round(rank.duration * 100) / 100}s</span>
                        </div>
                        <div class="info">
                            <span>Thời gian nộp bài:</span>
                            <span class="value">${rank_completed_at[0] + ":" + rank_completed_at[1]}</span>
                        </div>
                    </div>
                </div>
            `
        });
        rankList.classList.remove("loading");
    });
}
loadTab();
function loadAside() {
    const tabs = document.querySelectorAll(".sidebar > div");
    const pages = document.querySelectorAll("main");
    pages.forEach((page, i) => {
        if(i < 2) return;
        const ranking = page.querySelector(".ranking");
        const exam = page.querySelector(".exam-list")
        const changePage = page.querySelector(".change-page")
        changePage.addEventListener("click", () => {
            ranking.classList.toggle("active");
            exam.classList.toggle("active");
            if(changePage.textContent === "trophy") changePage.textContent = "list"
            else changePage.textContent = "trophy";
        });
    });

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            pages.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            pages[index].classList.add("active");
        });
    });
}



async function getCompletions() {
    const response = await fetch("/api/completions");

    if (!response.ok) {
        throw new Error("Failed to fetch completions");
    }

    const data = await response.json();
    return data;
}
getCompletions();

async function getPfps() {
    const response = await fetch("/api/pfps");
    const pfps = await response.json();
    return pfps;
}
getPfps();

async function loadExams() {
    const response = await fetch("/api/exams");
    const exams = await response.json();

    function load(examList) {
        examList.replaceChildren();
        examList.innerHTML = "";
        exams.forEach(file => {
            const type = file.id.split("-")[0];
            if(type !== examList.id && examList.id !== "") return;
            // Nguy hiem kinh khung khiep
            examList.innerHTML += `
            <div class="exam-option" onclick='redirect("${file.id}")'>
                <div class="exam-icon icon">${tab_icons[tabs.findIndex(t => type === t)]}</div>
                <div style="display:flex;flex-direction:column;">
                    <div class="exam-name">${file.title}</div>
                    <div class="exam-subject">${file.subject}</div>
                </div>
            </div>
            `;
        });
        examList.classList.remove("loading");
    }
    
    const examLists = document.querySelectorAll(".exam-list");
    examLists.forEach(load);
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
    "restart-on-wrong",
    "skip"
];

function saveSettings() {
    const settings = {
        shuffleQuestions: $("shuffle-questions").checked,
        shuffleChoices: $("shuffle-choices").checked,
        checkMode: $("check-mode").value,
        restartOnWrong: $("restart-on-wrong").checked,
        skip: (() => {
            let skip = [];
            if($("skip_multiple_choice").classList.contains("active")) skip.push("multiple_choice");
            else if($("skip_correctness").classList.contains("active")) skip.push("correctness");
            return skip;
        })()
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
    if(settings?.skip?.includes("multiple_choice")) $("skip_multiple_choice").classList.add("active");
    if(settings?.skip?.includes("correctness")) $("skip_correctness").classList.add("active");
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
$("username").textContent = localStorage.getItem("username") || "";

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



const input = document.getElementById("pfpInput");
const preview = document.getElementById("pfp");

input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        localStorage.setItem("pfp", reader.result);
        preview.src = reader.result;
    };

    reader.readAsDataURL(file);
});

async function setDefaultPfp() {
    const response = await fetch(pfp.src);
    const blob = await response.blob();

    const reader = new FileReader();

    reader.onload = () => {
        localStorage.setItem("pfp", reader.result);
    };

    reader.readAsDataURL(blob);
}

if(!localStorage.getItem("pfp")) setDefaultPfp();
else document.getElementById("pfp").src = localStorage.getItem("pfp")

