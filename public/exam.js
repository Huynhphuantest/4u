const settings = JSON.parse(localStorage.getItem("exam-settings")) || {
    shuffleQuestions: false,
    shuffleChoices: false,
    checkMode: "immediate",
    restartOnWrong: false
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
    if(settings.shuffleQuestions) {
        questions = shuffleQuestions(questions);
    }
    if(settings.shuffleChoices) {
        questions = shuffleChoices(questions);
    }

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

    const checkButton = document.createElement("button");
    checkButton.textContent = "Kiểm đáp án";
    $("options").append(checkButton);

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

        checkButton.textContent = "Tiếp tục";
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
    const time = Math.floor(
        (Date.now() - startTime) / 1000
    );

    try {
        const response = await fetch(
            `/api/exams/${exam}/complete`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    time,
                    score: Math.round(score*100)/10
                })
            }
        );

        if (!response.ok) {
            console.error(response)
            throw new Error("Failed to submit exam");
        }

        document
            .getElementById("completed-modal")
            .classList.remove("hidden");
    } catch (error) {
        console.error(error);
        alert("Failed to save your result. Please try again.");
    }
}