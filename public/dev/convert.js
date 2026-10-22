
const fs = require("node:fs");

const input = fs.readFileSync("input.txt", "utf8");

const exam = {
  id: "geo-002",
  subject: "Địa Lý",
  title: "Kiểm tra giữa kì II",
  questions: []
};

// Supports: Câu 1., Cau 1., Question 1., etc.
const blocks = input
  .split(/(?=^\s*(?:Câu|Cau|Question)\s+\d+\s*[.:)]?)/gim)
  .map(block => block.trim())
  .filter(Boolean);

for (const block of blocks) {
  const heading = block.match(
    /^\s*(?:Câu|Cau|Question)\s+(\d+)\s*[.:)]?\s*/i
  );

  if (!heading) continue;

  const id = Number(heading[1]);
  const content = block.slice(heading[0].length);

  // Supports A. A) a. a), with * before the label.
  const optionRegex = /^\s*(\*)?\s*([A-Da-d])[.)]\s*/gm;
  const matches = [...content.matchAll(optionRegex)];

  if (matches.length < 2) {
    throw new Error(`Question ${id}: Not enough options.`);
  }

  const question = content.slice(0, matches[0].index).trim();

  const rawOptions = matches.map((match, i) => {
    const start = match.index + match[0].length;
    const end = matches[i + 1]?.index ?? content.length;

    return {
      label: match[2],
      text: content.slice(start, end).trim(),
      marked: Boolean(match[1])
    };
  });

  // Uppercase labels = multiple choice.
  // Lowercase labels = correctness question.
  const isCorrectness = /^[a-z]$/.test(rawOptions[0].label);
  const type = isCorrectness ? "correctness" : "multiple_choice";

  // Ensure every option uses the same label case.
  if (rawOptions.some(option =>
    /^[a-z]$/.test(option.label) !== isCorrectness
  )) {
    throw new Error(`Question ${id}: Mixed uppercase/lowercase labels.`);
  }

  const options = rawOptions.map(option => option.text);

  const answers = rawOptions
    .map((option, index) => option.marked ? index : -1)
    .filter(index => index !== -1);

  if (answers.length === 0) {
    throw new Error(`Question ${id}: No option marked with *.`);
  }

  if (type === "multiple_choice" && answers.length !== 1) {
    throw new Error(
      `Question ${id}: Multiple choice must have exactly one * answer.`
    );
  }

  exam.questions.push({
    id,
    type,
    question,
    options,
    answer: type === "correctness" ? answers : answers[0]
  });
}

exam.questions.sort((a, b) => a.id - b.id);

fs.writeFileSync(
  "output.json",
  JSON.stringify(exam, null, 2),
  "utf8"
);

console.log(
  `Successfully converted ${exam.questions.length} questions to output.json`
);
