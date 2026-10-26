
const fs = require("node:fs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

function formatInput(input) {
    return input
        .replace(/\r\n?/g, "\n")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\u00A0/g, " ")
        .replace(/^\s*\[\s*$/gm, "")
        .replace(/^\s*\]\s*$/gm, "")
        .replace(/^\s*Enter one correct label:.*$/gim, "")
        .replace(
            /([^\n])\s*((?:Câu|Cau|Question)\s+\d+\s*[.:)]?)/gi,
            "$1\n$2"
        )
        .replace(
            /([^\n])\s+(\*?\s*[A-Da-d][.)]\s+)/g,
            "$1\n$2"
        )
        .replace(/^\s*\[?\s*Marker\s*:/gim, "Marker:")
        .trim();
}
function findEvents(input) {
    const events = [];

    const regex =
      /^[ \t]*(Marker\s*:|(?:Câu|Cau|Question)\s+\d+\s*[.:)]?)/gim;

    for (const match of input.matchAll(regex)) {
        const isMarker = /^Marker\s*:/i.test(match[1]);

        events.push({
            type: isMarker ? "marker" : "question",
            start: match.index,
            end: match.index + match[0].length
        });
    }

    return events;
}
function parseHeading(block) {
    const heading = block.match(
        /^\s*(?:Câu|Cau|Question)\s+(\d+)\s*[.:)]?\s*/i
    );

    if (!heading) return null;

    return {
        id: Number(heading[1]),
        content: block.slice(heading[0].length)
    };
}
function parseOptions(content, id) {
    const regex = /^\s*(\*)?([A-Da-d])[.)]\s*/gm;
    const matches = [...content.matchAll(regex)];

    if (matches.length < 2) {
        throw new Error(`Question ${id}: Not enough options.`);
    }

    const question = content.slice(0, matches[0].index).trim();

    const options = matches.map((match, i) => {
        const start = match.index + match[0].length;
        const end = matches[i + 1]?.index ?? content.length;

        return {
            label: match[2],
            text: content.slice(start, end).trim(),
            marked: Boolean(match[1])
        };
    });

    return { question, options };
}
function determineType(options, id) {
    const firstLabel = options[0].label;
    console.log(firstLabel, id)

    if (!/^[A-Da-d]$/.test(firstLabel)) {
        throw new Error(`Question ${id}: Invalid option label.`);
    }

    const isCorrectness = firstLabel === firstLabel.toLowerCase();

    if (options.some(option => {
        const isLowercase = option.label === option.label.toLowerCase();
        return isLowercase !== isCorrectness;
    })) {
        throw new Error(
            `Question ${id}: Mixed option label cases: ${
                options.map(option => option.label).join(", ")
            }`
        );
    }

    return isCorrectness ? "correctness" : "multiple_choice";
}
function getMarkedAnswers(options, type, id) {
    const answers = options
        .map((option, index) => option.marked ? index : -1)
        .filter(index => index !== -1);

    if (type === "multiple_choice" && answers.length > 1) {
        throw new Error(`Question ${id}: Multiple marked answers.`);
    }

    return answers;
}
function parseExam(input) {
    const events = findEvents(input);
    const questions = [];
    const blocks = [];

    let activeBlock = null;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const next = events[i + 1];
        const end = next ? next.start : input.length;

        if (event.type === "marker") {
            const content = input.slice(event.end, end)
                .replace(/^\s*\[|\]\s*$/g, "")
                .trim();

            if (!content) {
                throw new Error("Found an empty Marker section.");
            }

            const match = content.match(
                /câu hỏi?\s+([\d\s, và]+)/i
            );

            const includes = match
                ? [...match[1].matchAll(/\d+/g)].map(m => Number(m[0]))
                : [];

            activeBlock = {
                id: blocks.length + 1,
                content: content.replace(
                    /^Đọc thông tin và trả lời.*?:\s*/i,
                    ""
                ).trim(),
                includes
            };

            blocks.push(activeBlock);
            continue;
        }

        const parsed = parseHeading(input.slice(event.start, end));
        if (!parsed) continue;

        const { id, content } = parsed;
        const result = parseOptions(content, id);
        const type = determineType(result.options, id);

        const question = {
            id,
            type,
            question: result.question,
            options: result.options,
            answer: getMarkedAnswers(result.options, type, id)
        };

        questions.push(question);
    }

    questions.sort((a, b) => a.id - b.id);
    blocks.forEach(block => {
        block.includes.sort((a, b) => a - b);
    });

    return { questions, blocks };
}
async function inputAnswers(questions) {
    const rl = readline.createInterface({ input: stdin, output: stdout });

    try {
        for (const q of questions) {
            const labels = q.options.map(option => option.label);
            const marked = q.answer.map(index => labels[index]);

            console.log(`\nQuestion ${q.id}: ${q.question}`);

            q.options.forEach(option => {
                console.log(`  ${option.label}. ${option.text}`);
            });

            while (true) {
                const hint = q.type === "correctness"
                    ? "Enter correct labels separated by commas"
                    : "Enter one correct label";

                const existing = marked.length
                    ? ` [marked: ${marked.join(", ")}; Enter to keep]`
                    : "";

                const input = (await rl.question(
                    `${hint}${existing}: `
                )).trim();

                let answers;

                if (!input && marked.length) {
                    answers = marked;
                } else if (input) {
                    answers = q.type === "correctness"
                        ? [...input.replace(/[\s,]+/g, "").toUpperCase()]
                            .map(char => /^[1-4]$/.test(char)
                                ? String.fromCharCode(64 + Number(char))
                                : char)
                        : input.split(",").map(s => {
                            const value = s.trim();
                            return /^[1-4]$/.test(value)
                                ? String.fromCharCode(64 + Number(value))
                                : value.toUpperCase();
                        });
                } else {
                    console.log("Please enter an answer.");
                    continue;
                }

                const indexes = answers.map(label =>
                    labels.findIndex(
                        option => option.toLowerCase() === label.toLowerCase()
                    )
                );

                if (indexes.some(index => index === -1)) {
                    console.log(`Choose: ${labels.join(", ")}`);
                    continue;
                }

                if (new Set(indexes).size !== indexes.length) {
                    console.log("Duplicate answers are not allowed.");
                    continue;
                }

                if (q.type === "multiple_choice" && indexes.length !== 1) {
                    console.log("Enter exactly one answer.");
                    continue;
                }

                q.answer = indexes;
                break;
            }
        }
    } finally {
        rl.close();
    }
}

// 9. Build the final JSON.
function buildExam(questions, blocks, metadata) {
    return {
        ...metadata,

        blocks: blocks.map(block => ({
            id: block.id,
            content: block.content,
            includes: block.includes
        })),

        questions: questions.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options.map(option => option.text),
            answer: q.type === "correctness"
                ? q.answer
                : q.answer[0]
        }))
    };
}

// 10. Run the converter.
async function main() {
    const input = fs.readFileSync("input.txt", "utf8");
    const formatted = formatInput(input);

    const { questions, blocks } = parseExam(formatted);

    if (!questions.length) {
        throw new Error("No questions found in input.txt.");
    }

    await inputAnswers(questions);

    const exam = buildExam(questions, blocks, {
        id: "geo-002",
        subject: "Địa Lý",
        title: "Kiểm tra giữa kì II"
    });

    fs.writeFileSync(
        "output.json",
        JSON.stringify(exam, null, 2),
        "utf8"
    );

    console.log(
        `\nSuccessfully converted ${questions.length} questions and ` +
        `${blocks.length} blocks to output.json`
    );
}

main().catch(error => {
    console.error("\nConversion failed:", error.message);
    process.exitCode = 1;
});
