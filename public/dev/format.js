
const fs = require("node:fs");
const readline = require("node:readline/promises");

const input = fs.readFileSync("input.txt", "utf8");

// Split the input into question blocks.
const blocks = input
  .trim()
  .split(/(?=^\s*(?:Câu|Cau|Question)\s+\d+\s*[.:)]?)/gim)
  .filter(block => block.trim());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  const output = [];

  for (let block of blocks) {
    // Move inline options onto separate lines.
    block = block.replace(
      /[ \t]+(?=\*?\s*[A-Da-d][.)]\s)/g,
      "\n"
    );

    const heading = block.match(
      /^\s*(?:Câu|Cau|Question)\s+(\d+)/i
    );

    if (!heading) {
      output.push(block);
      continue;
    }

    const number = heading[1];

    // Find options at the beginning of lines.
    const optionRegex = /^\s*(\*)?\s*([A-Da-d])[.)]\s*/gm;
    const options = [...block.matchAll(optionRegex)];

    if (options.length < 2) {
      output.push(block);
      continue;
    }

    const isCorrectness = /^[a-z]$/.test(options[0][2]);

    // If any option is already marked, leave this question unchanged.
    if (options.some(option => option[1] === "*")) {
      console.log(`\nQuestion ${number}: Already marked, skipping.`);
      output.push(block);
      continue;
    }

    console.log(`\n${block.trim()}`);
    console.log(
      isCorrectness
        ? "Enter the TRUE options (e.g. ABD). Other options will be false."
        : "Enter the correct option (A-D, a-d, or 1-4)."
    );

    const answer = (
      await rl.question("Your answer (Enter to skip): ")
    ).trim().toUpperCase();

    if (!answer) {
      output.push(block);
      continue;
    }

    let selected;

    if (isCorrectness) {
      // ABD means A, B, D are true; C is false.
      selected = [...new Set(answer.split(""))];

      if (
        selected.some(letter => !/^[A-D]$/.test(letter)) ||
        selected.some(letter =>
          !options.some(option => option[2].toUpperCase() === letter)
        )
      ) {
        console.log("Invalid answer. Leaving unchanged.");
        output.push(block);
        continue;
      }
    } else {
      // Accept A-D, a-d, or 1-4.
      const letter = answer.length === 1
        ? (/^[1-4]$/.test(answer)
            ? String.fromCharCode(64 + Number(answer))
            : answer)
        : "";

      if (
        !/^[A-D]$/.test(letter) ||
        !options.some(option => option[2].toUpperCase() === letter)
      ) {
        console.log("Invalid answer. Leaving unchanged.");
        output.push(block);
        continue;
      }

      selected = [letter];
    }

    // Add * before the selected option labels.
    block = block.replace(
      /^(\s*)(\*)?\s*([A-Da-d])([.)])/gm,
      (match, indent, star, label, punctuation) => {
        const shouldMark = selected.includes(label.toUpperCase());

        return (
          indent +
          (shouldMark ? "*" : "") +
          label +
          punctuation
        );
      }
    );

    output.push(block);
  }

  rl.close();

  fs.writeFileSync(
    "output.txt",
    output.join("\n\n").trim() + "\n",
    "utf8"
  );

  console.log("\nDone! Saved formatted questions to output.txt");
}

main().catch(error => {
  rl.close();
  console.error(error);
});
