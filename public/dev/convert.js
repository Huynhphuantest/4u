import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// line 55

function formatInput(input) {
    return input
        .replace(/\r\n?/g, "\n")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\u00A0/g, " ")
        .replace(/^\s*Enter one correct label:.*$/gim, "")
        .replace(
            /([^\n])\s*((?:Câu|Cau|Question)\s+\d+\s*[.:)]?)/gi,
            "$1\n$2"
        )
        .replace(
            /([^\n])\s+(\*?\s*[A-Da-d][.)]\s+)/g,
            "$1\n$2"
        )
        .trim();
}
function findEvents(input) {
    const events = [];

    const blockRegex = /^[ \t]*\[[ \t]*\r?\n[\s\S]*?^[ \t]*\][ \t]*(?=\r?$)/gm;

    for (const match of input.matchAll(blockRegex)) {
        events.push({
            type: "block",
            start: match.index,
            end: match.index + match[0].length
        });
    }

    input = input.replace(/[\[\]]/g, " ");

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
    const regex = /^\s*(\*)?([A-D])[.)]\s*/gm;
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

    const blockEvents = events.filter(e => e.type === "block");
    const questionEvents = events.filter(e => e.type === "question");

    // Parse blocks
    for (const event of blockEvents) {
        const blockText = input.slice(event.start, event.end);

        const marker = blockText.match(
            /^\s*Marker\s*:\s*(.*)$/im
        );

        const includes = questionEvents
            .filter(q => q.start > event.start && q.start < event.end)
            .map(q => {
                const match = input.slice(q.start, q.end).match(
                    /(?:Câu|Cau|Question)\s+(\d+)/i
                );

                return match ? Number(match[1]) : null;
            })
            .filter(id => id !== null);

        blocks.push({
            id: blocks.length + 1,
            content: marker ? marker[1].trim() : "",
            includes
        });
    }
    for (let i = 0; i < questionEvents.length; i++) {
        const event = questionEvents[i];
        const nextQuestion = questionEvents[i + 1];

        const containingBlock = blockEvents.find(
            b => event.start > b.start && event.start < b.end
        );

        const end = Math.min(
            nextQuestion?.start ?? input.length,
            containingBlock?.end ?? input.length
        );
        const parsed = parseHeading(input.slice(event.start, end));
        console.log(parsed)
        if (!parsed) continue;

        const id = questions.length + 1;
        const { content } = parsed;

        const result = parseOptions(content, id);
        const type = determineType(result.options, id);

        questions.push({
            id,
            originalId: parsed.id,
            type,
            question: result.question,
            options: result.options,
            answer: getMarkedAnswers(result.options, type, id)
        });
    }
    return { questions, blocks };
}
async function inputAnswers(questions) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
        for (const q of questions) {
            const labels = q.options.map(option => option.label);
            const marked = q.answer.map(index => labels[index]);

            console.log(`\nQuestion ${q.originalId} (${q.id}): ${q.question}`);

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
        title: "Kiểm tra giữa kì II",
        outdated: false
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