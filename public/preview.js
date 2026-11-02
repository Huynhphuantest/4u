import { AllModeRenderer, ExamRenderer } from "./render.js";

const $ = id => document.getElementById(id);
const examId = window.location.pathname.split("/").filter(Boolean).at(-1);

let rawExam;
let questions = [];
let blocks = [];
let current = 0;

let multipleChoiceAmount = 0;
let correctnessAmount = 0;

const params = {
    elements: {
        questionBlock: $("questionBlock"),
        questionText: $("questionText"),
        questionLabel: $("questionLabel"),
        questionTypeLabel: $("questionTypeLabel"),
        options: $("options"),
        check: $("check")
    },

    interactive: false,
}
let renderer = new AllModeRenderer(params);

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

    $("exam-name").textContent = `${exam.subject} - ${exam.title}`;

    render();
}
getExam().catch(error => {
    console.error(error);
    alert("Không thể tải đề thi. Vui lòng thử lại.");
});
function prepareQuestions(exam) {
    const questions = convertExam(exam);

    let groups = groupQuestions(exam, questions);

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
function render() {
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
    $("question-amount").textContent = counts.join(" · ");
    const questionTemplate = document.getElementById("question-template");
    

    for (const question of questions) {
        const element = questionTemplate.content.cloneNode(true);
        const options = element.querySelector("#options");

        const elements = {
            questionBlock: element.querySelector("#questionBlock"),
            questionText: element.querySelector("#questionText"),
            questionLabel: element.querySelector("#questionLabel"),
            questionTypeLabel: element.querySelector("#questionTypeLabel"),
            options: element.querySelector("#options"),
            check: element.querySelector("#check")
        };

        $("questionContainer").append(element);

        renderer.elements = elements;
        const block = blocks.find(block =>
            block.includes.includes(question.id)
        );

        const number = current + 1;
        renderer.render(question, {
            number,
            block: block?.content ?? null
        });
        const corrects = Array.isArray(question.correct) ? question.correct : [question.correct];
        corrects.forEach((_, index) => {
            options.children[index].classList.add("correct");
        });
        current++;
    }
}