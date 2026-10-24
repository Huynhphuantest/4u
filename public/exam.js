const settings = JSON.parse(localStorage.getItem("exam-settings")) || {
    shuffleQuestions: false,
    shuffleChoices: false,
    checkMode: "immediate",
    restartOnWrong: false,
    skip: []
};

const username = localStorage.getItem("username") || "Vô danh"

const $ = id => document.getElementById(id);

let seconds = 0;

const timerInterval = setInterval(() => {
    seconds++;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    document.getElementById("timer").textContent =
        `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}, 1000);


let questions = []

const id = window.location.href.split("/").at(-1)
async function getExam() {
    const response = await fetch(`/api/exams/${id}`);
    const data = await response.json();

    questions = convertExam(data);
    questions = questions.filter((q) => !settings.skip.includes(q.type))
    if(settings.shuffleQuestions) {
        questions = shuffleQuestions(questions);
    }
    if(settings.shuffleChoices) {
        questions = shuffleChoices(questions);
    }

    document.getElementById("exam-name").textContent = data.subject + " - " + data.title;

    let correctnessAmount = 0;
    let multipleChoiceAmount = 0;

    questions.forEach((question) => {
        if(question.type === "correctness") correctnessAmount++;
        if(question.type === "multiple_choice") multipleChoiceAmount++;
    });

    if(multipleChoiceAmount > 0) document.getElementById("question-amount").textContent += `${multipleChoiceAmount} Câu trắc nghiệm`;
    if(correctnessAmount > 0) document.getElementById("question-amount").textContent += `${correctnessAmount} Câu đúng sai`;

    render()
}
function shuffleChoices(questions) {
    questions.forEach(question => {
        const options = question.a.map((text, index) => ({
            text,
            oldIndex: index
        }));

        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        question.a = options.map(option => option.text);

        const newIndex = oldIndex =>
            options.findIndex(option => option.oldIndex === oldIndex);

        if (question.type === "correctness") {
            question.correct = question.correct.map(newIndex);
        } else {
            question.correct = newIndex(question.correct);
        }
    });

    return questions;
}
function shuffleQuestions(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}
getExam();

function convertExam(exam) {
    return exam.questions.map(question => ({
        q: question.question,
        a: question.options,
        correct: question.answer,
        type: question.type
    }));
}

let current = 0;
let score = 0;

function render() {
    const item = questions[current];

    $("questionLabel").textContent = `Câu ${current + 1}`;
    $("questionText").textContent = item.q;
    $("options").innerHTML = "";

    if(item.type === "multiple_choice") { multiple_choice() }
    else if (item.type === "correctness") { correctness() }
}

function multiple_choice() {
    $("check").classList.remove("active")
    const item = questions[current];

    const labels = [];

    item.a.forEach((answer, i) => {
        const label = document.createElement("label");
        label.className = "option";
        labels.push(label);

        const text = document.createElement("span");
        text.textContent = `${String.fromCharCode(65 + i)}. ${answer}`;
        label.append(text);
        $("options").append(label);
    });
    labels.forEach((label, i) => {
        label.onclick = (e) => {
            if(item.correct !== i) {
                label.classList.add("incorrect");
                labels[item.correct].classList.add("correct");
                labels.forEach(l => l.onclick = () => {
                    if(settings.restartOnWrong) window.location.reload();
                    current++;
                    if(current + 1 > questions.length) return finished();
                    render()
                })
                return;
            }
            confetti({
                particleCount: 100,
                spread: 70,
                origin: {
                    x: e.clientX / window.innerWidth,
                    y: e.clientY / window.innerHeight
                },
                ticks:75
            });
            score += 1/questions.length
            if(current + 2 > questions.length) return finished();
            current++;
            render()
        }
    })
}
function correctness() {
    $("check").classList.add("active")
    const item = questions[current]
    const selected = new Set();
    const labels = [];

    item.a.forEach((answer, i) => {
        const label = document.createElement("label");
        label.className = "option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = i;

        const text = document.createElement("span");
        text.textContent = `${String.fromCharCode(65 + i)}. ${answer}`;

        label.append(checkbox, text);
        $("options").append(label);
        labels.push(label);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) selected.add(i);
            else selected.delete(i);
        });
    });
    const checkButton = $("check")
    checkButton.onclick = (e) => {
        const correct = item.correct;
        const isCorrect =
            selected.size === correct.length &&
            correct.every(i => selected.has(i));

        labels.forEach((label, i) => {
            label.querySelector("input").disabled = true;

            if (correct.includes(i)) {
                label.classList.add("correct");
            } else if (selected.has(i)) {
                label.classList.add("incorrect");
            }
        });

        checkButton.disabled = true;

        if (isCorrect) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: {
                    x: e.clientX / window.innerWidth,
                    y: e.clientY / window.innerHeight
                },
                ticks: 75
            });

            score += 1 / questions.length;
        }

        checkButton.innerHTML = `<span class="icon">arrow_forward</span>Tiếp tục`;
        checkButton.disabled = false;
        checkButton.onclick = () => {
            if(!isCorrect && settings.restartOnWrong) window.location.reload();
            if (current + 1 >= questions.length) return finished();
            current++;
            render();
        };
    };
}

function finished() {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    clearInterval(timerInterval)
    document.getElementById("modal-timer").textContent =
        `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    document.getElementById("modal-score").textContent =
        `${Math.round(score*100)/10}/10`
    document.getElementById("completed-modal").classList.remove("hidden");
    submitExam();
}
const startTime = Date.now();

async function submitExam() {
    const exam = id;
    const duration = (Date.now() - startTime) / 1000;

    try {
        const savedPfp = localStorage.getItem("pfp");
        let avatar;

        if (savedPfp) {
            const response = await fetch(savedPfp);
            const blob = await response.blob();

           const compressed = await imageCompression(
                new File([blob], "avatar.jpg", { type: blob.type }),
                {
                    maxSizeMB: 0.008, // target ~20 KB
                    maxWidthOrHeight: 96,
                    useWebWorker: true,
                    fileType: "image/webp",
                    initialQuality: 0.4
                }
            );

            avatar = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(compressed);
            });
        }

        const response = await fetch(`/api/exams/${exam}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                duration,
                score: Math.round(score * 100) / 10,
                avatar
            })
        });

        if (!response.ok) {
            console.error(response);
            throw new Error("Failed to submit exam");
        }

        document.getElementById("completed-modal").classList.remove("hidden");
    } catch (error) {
        console.error(error);
        alert("Failed to save your result. Please try again.");
    }
}