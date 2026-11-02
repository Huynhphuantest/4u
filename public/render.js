
export class ExamRenderer {
    constructor({
        elements,
        interactive = true,
        onCorrect = () => {},
        onAdvance = () => {},
        onRestart = () => {},
        onCelebrate = () => {},
        restartOnWrong = false,
    }) {
        this.elements = elements;
        this.interactive = interactive;
        this.onCorrect = onCorrect;
        this.onAdvance = onAdvance;
        this.onRestart = onRestart;
        this.onCelebrate = onCelebrate;
        this.restartOnWrong = restartOnWrong;
    }

    render(question, { number = 1, block = null } = {}) {
        const e = this.elements;

        e.questionBlock.style.display = block ? "block" : "none";
        e.questionBlock.replaceChildren();

        if (block) {
            // Only use innerHTML for trusted exam content.
            e.questionBlock.innerHTML = block;
            e.questionBlock.style.display = "block";
        }

        e.questionText.textContent = question.q;
        e.questionLabel.textContent = `Câu ${number}`;
        e.options.replaceChildren();

        if (question.type === "multiple_choice") {
            this.renderMultipleChoice(question);
        } else if (question.type === "correctness") {
            this.renderCorrectness(question);
        }

        e.questionTypeLabel.textContent =
            question.type === "multiple_choice"
                ? "Trắc Nghiệm"
                : "Đúng Sai";
    }

    createOption(text, index, checkbox = false) {
        const label = document.createElement("label");
        label.className = "option";

        if (checkbox && this.interactive) {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = index;

            label.append(input);
        }

        const span = document.createElement("span");
        span.textContent = `${String.fromCharCode(65 + index)}) ${text}`;

        label.append(span);
        this.elements.options.append(label);

        return label;
    }

    renderMultipleChoice(question) {
        const labels = question.a.map((answer, index) =>
            this.createOption(answer, index)
        );

        if (!this.interactive) return;

        let answered = false;

        labels.forEach((label, index) => {
            label.onclick = event => {
                if (answered) {
                    if (this.restartOnWrong) {
                        this.onRestart();
                    } else {
                        this.onAdvance();
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

                this.onCelebrate(event);
                this.onCorrect();
                this.onAdvance();
            };
        });
    }

    renderCorrectness(question) {
        const e = this.elements;
        const button = e.check;

        button.classList.remove("active");
        button.disabled = true;

        const labels = question.a.map((answer, index) =>
            this.createOption(answer, index, true)
        );

        if (!this.interactive) return;

        const selected = new Set();

        labels.forEach((label, index) => {
            const checkbox = label.querySelector("input");

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selected.add(index);
                } else {
                    selected.delete(index);
                }
            });
        });

        button.classList.add("active");
        button.disabled = false;
        button.textContent = "Kiểm tra";

        button.onclick = event => {
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

            button.textContent = "Tiếp tục";

            if (isCorrect) {
                this.onCelebrate(event);
                this.onCorrect();
            }

            button.onclick = () => {
                if (!isCorrect && this.restartOnWrong) {
                    this.onRestart();
                } else {
                    this.onAdvance();
                }
            };
        };
    }
}

export class AllModeRenderer extends ExamRenderer {
    questions = [];
    answers = [];
    currentIndex = 0;

    render(question, { number = 1, block = null } = {}) {
        super.render(question, { number, block });

        this.questions.push(question);
        this.answers.push(new Set());
        this.currentIndex++;
    }

    renderMultipleChoice(question) {
        question.a.forEach((answer, index) => {
            const label = this.createOption(answer, index, this.interactive);
            label.querySelector("span").textContent = `${String.fromCharCode(65 + index)}. ${answer}`;
            if(!this.interactive) return;
            const input = label.querySelector("input");

            input.type = "radio";
            input.name = `question-${this.currentIndex}`;

            input.addEventListener("change", () => {
                this.answers[this.currentIndex - 1] = new Set([index]);
            });
        });
    }

    renderCorrectness(question) {
        question.a.forEach((answer, index) => {
            const label = this.createOption(answer, index, this.interactive);
            if(!this.interactive) return;
            const input = label.querySelector("input");

            input.addEventListener("change", () => {
                const selected = this.answers[this.currentIndex - 1];

                if (input.checked) selected.add(index);
                else selected.delete(index);
            });
        });
    }
}