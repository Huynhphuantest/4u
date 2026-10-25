const $ = id => document.getElementById(id);

const DEFAULT_SETTINGS = {
    shuffleQuestions: false,
    shuffleChoices: false,
    checkMode: "immediate",
    restartOnWrong: false,
    skip: []
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

let questions = [];
let blocks = [];
let current = 0;
let score = 0;
let seconds = 0;
let finished = false;

let multipleChoiceAmount = 0;
let correctnessAmount = 0;

const startTime = Date.now();

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
    blocks = exam.blocks;
    if(blocks === undefined) blocks = [];

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
function render() {
    if (finished) return;

    const question = questions[current];
    $("questionBlock").style.display = "none";
    for(const block of blocks) {
        if(block.includes.includes(question.id)) {
            $("questionBlock").textContent = block.content;
            $("questionBlock").style.display = "block";
            break;
        }
    }

    $("questionText").textContent = question.q;
    $("options").replaceChildren();
    const previousOfSameType = questions
        .slice(0, current)
        .filter(item => item.type === question.type).length;

    $("questionLabel").textContent = `Câu ${previousOfSameType + 1}`;

    if (question.type === "multiple_choice") {
        renderMultipleChoice(question);
    } else {
        renderCorrectness(question);
    }
}
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
function createOption(text, index, checkbox = false) {
    const label = document.createElement("label");
    label.className = "option";

    if (checkbox) {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = index;
        label.append(input);
    }

    const span = document.createElement("span");
    span.textContent = `${String.fromCharCode(65 + index)}. ${text}`;

    label.append(span);
    $("options").append(label);

    return label;
}
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
function renderMultipleChoice(question) {
    $("questionTypeLabel").textContent = "Trắc Nghiệm";
    $("check").classList.remove("active");

    const labels = question.a.map((answer, index) =>
        createOption(answer, index)
    );

    let answered = false;

    labels.forEach((label, index) => {
        label.onclick = event => {
            if (answered) {
                if (settings.restartOnWrong) {
                    window.location.reload();
                } else {
                    advanceQuestion();
                }

                return;
            }

            if (index !== question.correct) {
                answered = true;

                label.classList.add("incorrect");
                labels[question.correct]?.classList.add("correct");

                return;
            }

            answered = true;
            label.classList.add("correct");
            celebrate(event);
            addScore();
            advanceQuestion();
        };
    });
}
function renderCorrectness(question) {
    $("questionTypeLabel").textContent = "Đúng Sai";

    const checkButton = $("check");

    checkButton.classList.add("active");
    checkButton.disabled = false;
    checkButton.textContent = "Kiểm tra";

    const selected = new Set();

    const labels = question.a.map((answer, index) => {
        const label = createOption(answer, index, true);
        const checkbox = label.querySelector("input");

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                selected.add(index);
            } else {
                selected.delete(index);
            }
        });

        return label;
    });

    checkButton.onclick = event => {
        const correct = question.correct;

        const isCorrect =
            selected.size === correct.length &&
            correct.every(index => selected.has(index));

        labels.forEach((label, index) => {
            const checkbox = label.querySelector("input");
            checkbox.disabled = true;

            if (correct.includes(index)) {
                label.classList.add("correct");
            } else if (selected.has(index)) {
                label.classList.add("incorrect");
            }
        });

        checkButton.textContent = "Tiếp tục";

        if (isCorrect) {
            celebrate(event);
            addScore();
        }

        // Replace the checking action with the continue action.
        checkButton.onclick = () => {
            if (!isCorrect && settings.restartOnWrong) {
                window.location.reload();
                return;
            }

            advanceQuestion();
        };
    };
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
                    avatar
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
