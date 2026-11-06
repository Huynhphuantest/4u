
import { AllModeRenderer, ExamRenderer } from "./render.js";

const $ = id => document.getElementById(id);

const DEFAULT_SETTINGS = {
    shuffleQuestions: false,
    shuffleChoices: false,
    checkMode: "immediate",
    restartOnWrong: false,
    skip: [],
    disableAudio:false
};

function loadSettings() {
    try {
        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(localStorage.getItem("exam-settings") || "{}")
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

const settings = loadSettings();
const username = localStorage.getItem("username") || "Vô danh";
const examId = window.location.pathname.split("/").filter(Boolean).at(-1);

let rawExam;
let questions = [];
let blocks = [];
let current = 0;
let score = 0;
let seconds = 0;
let finished = false;

let multipleChoiceAmount = 0;
let correctnessAmount = 0;

const startTime = Date.now();

const params = {
    elements: {
        questionBlock: $("questionBlock"),
        questionText: $("questionText"),
        questionLabel: $("questionLabel"),
        questionTypeLabel: $("questionTypeLabel"),
        options: $("options"),
        check: $("check")
    },

    interactive: true,

    onCorrect: addScore,
    onAdvance: advanceQuestion,
    onRestart: () => window.location.reload(),
    onCelebrate: celebrate,
    restartOnWrong: settings.restartOnWrong
}
let renderer = new ExamRenderer(params);

const timerInterval = setInterval(() => {
    seconds++;
    $("timer").textContent = formatTime(seconds);
}, 1000);

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}
function shuffleChoices(question) {
    const options = shuffle(
        question.a.map((text, oldIndex) => ({ text, oldIndex }))
    );

    const newIndex = oldIndex =>
        options.findIndex(option => option.oldIndex === oldIndex);

    question.a = options.map(option => option.text);

    question.correct = Array.isArray(question.correct)
        ? question.correct.map(newIndex)
        : newIndex(question.correct);

    return question;
}
function convertExam(exam) {
    return exam.questions.map(question => ({
        id: question.id,
        q: question.question,
        a: question.options,
        correct: question.answer,
        type: question.type
    }));
}
async function getExam() {
    const response = await fetch(`/api/exams/${examId}`);

    if (!response.ok) {
        throw new Error(`Failed to load exam (${response.status})`);
    }

    const exam = await response.json();
    rawExam = exam;
    blocks = exam.blocks ?? [];
    questions = prepareQuestions(exam);

    multipleChoiceAmount = questions.filter(
        q => q.type === "multiple_choice"
    ).length;

    correctnessAmount = questions.filter(
        q => q.type === "correctness"
    ).length;

    $("exam-name").textContent = `${exam.subject} - ${exam.title}`;

    const counts = [];

    if (multipleChoiceAmount) {
        counts.push(`${multipleChoiceAmount} Câu trắc nghiệm`);
    }

    if (correctnessAmount) {
        counts.push(`${correctnessAmount} Câu đúng sai`);
    }

    $("question-amount").textContent = counts.join(" · ");

    if (!questions.length) {
        finishExam();
        return;
    }

    render();
}
getExam().catch(error => {
    console.error(error);
    alert("Không thể tải đề thi. Vui lòng thử lại.");
});
function prepareQuestions(exam) {
    const questions = convertExam(exam)
        .filter(q => !settings.skip.includes(q.type));

    let groups = groupQuestions(exam, questions);

    if (settings.shuffleQuestions) {
        groups = shuffle(groups);
    }

    if (settings.shuffleChoices) {
        groups.forEach(group => {
            group.questions.forEach(shuffleChoices);
        });
    }

    return groups.flatMap(group => group.questions);
}
function groupQuestions(exam, questions) {
    const questionById = new Map(
        questions.map(question => [question.id, question])
    );

    const assigned = new Set();

    const groups = (exam.blocks ?? []).map(block => {
        const related = block.includes
            .map(id => questionById.get(id))
            .filter(Boolean);

        related.forEach(question => assigned.add(question.id));

        return {
            questions: related,
            firstId: Math.min(...related.map(q => q.id))
        };
    }).filter(group => group.questions.length > 0);

    // Questions without a block remain individual groups.
    for (const question of questions) {
        if (!assigned.has(question.id)) {
            groups.push({
                questions: [question],
                firstId: question.id
            });
        }
    }

    return groups.sort((a, b) => a.firstId - b.firstId);
}

const audio = document.getElementById("correct-sound");

function celebrate(event) {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: {
            x: event.clientX / window.innerWidth,
            y: event.clientY / window.innerHeight
        },
        ticks: 75
    });
    if(!settings.disableAudio) {
        audio.currentTime = 0;
        audio.play();
    }
}
function addScore() {
    score += 1 / questions.length;
}
function advanceQuestion() {
    if (current >= questions.length - 1) {
        finishExam();
        return;
    }

    current++;
    render();
}
function render() {
    if(settings.checkMode === "immediate") {
        renderImmediate();
    } else {
        renderer = new AllModeRenderer(params);
        renderAll();
    }
}
function renderImmediate() {
    if (finished) return;

    const question = questions[current];

    const block = blocks.find(block =>
        block.includes.includes(question.id)
    );

    const previousOfSameType = questions
        .slice(0, current)
        .filter(item => item.type === question.type).length;

    const number = settings.shuffleChoices
        ? current + 1
        : previousOfSameType + 1;

    renderer.render(question, {
        number,
        block: block?.content ?? null
    });
}
function renderAll() {
    const mainTemplate = document.getElementById("all-mode-template");
    const main = document.querySelector("main");

    main.replaceChildren();
    main.appendChild(mainTemplate.content.cloneNode(true));

    multipleChoiceAmount = questions.filter(
        q => q.type === "multiple_choice"
    ).length;
    correctnessAmount = questions.filter(
        q => q.type === "correctness"
    ).length;
    $("exam-name").textContent = `${rawExam.subject} - ${rawExam.title}`;
    const counts = [];
    if (multipleChoiceAmount) {
        counts.push(`${multipleChoiceAmount} Câu trắc nghiệm`);
    }

    if (correctnessAmount) {
        counts.push(`${correctnessAmount} Câu đúng sai`);
    }
    $("question-amount").textContent = counts.join(" · ") + " Còn đang thử nghiệm";
    const questionTemplate = document.getElementById("question-template");
    

    for (const question of questions) {
        const element = questionTemplate.content.cloneNode(true);

        const elements = {
            questionBlock: element.querySelector("#questionBlock"),
            questionText: element.querySelector("#questionText"),
            questionLabel: element.querySelector("#questionLabel"),
            questionTypeLabel: element.querySelector("#questionTypeLabel"),
            options: element.querySelector("#options"),
            check: element.querySelector("#check")
        };

        main.querySelector("#questionArea").append(element);

        renderer.elements = elements;
        const block = blocks.find(block =>
            block.includes.includes(question.id)
        );

        const previousOfSameType = questions
            .slice(0, current)
            .filter(item => item.type === question.type).length;

        const number = settings.shuffleChoices
            ? current + 1
            : previousOfSameType + 1;
        renderer.render(question, {
            number,
            block: block?.content ?? null
        });
        current++;
    }
}

function finishExam() {
    if (finished) return;

    finished = true;
    clearInterval(timerInterval);

    $("modal-timer").textContent = formatTime(seconds);
    $("modal-score").textContent =
        `${Math.round(score * 100) / 10}/10`;

    $("completed-modal").classList.remove("hidden");

    submitExam();
}

async function getCompressedAvatar() {
    const savedPfp = localStorage.getItem("pfp");

    if (!savedPfp) return undefined;

    const response = await fetch(savedPfp);

    if (!response.ok) {
        throw new Error("Failed to load avatar");
    }

    const blob = await response.blob();

    const file = new File([blob], "avatar.jpg", {
        type: blob.type || "image/jpeg"
    });

    const compressed = await imageCompression(file, {
        maxSizeMB: 0.08,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.4
    });

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result.split(",")[1]);
        };

        reader.onerror = reject;
        reader.readAsDataURL(compressed);
    });
}

async function submitExam() {
    const duration = (Date.now() - startTime) / 1000;

    try {
        const avatar = await getCompressedAvatar();
        const configuration = [...settings.skip, ...[
            settings.shuffleChoices && "shuffleChoices",
            settings.shuffleQuestions && "shuffleQuestions",
        ].filter(Boolean)]
        const response = await fetch(
            `/api/exams/${examId}/complete`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    duration,
                    score: Math.round(score * 100) / 10,
                    avatar,
                    configuration
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to submit exam (${response.status})`);
        }
    } catch (error) {
        console.error(error);
        alert("Failed to save your result. Please try again.");
    }
}
