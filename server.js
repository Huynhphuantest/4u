const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");

const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const Database = require("better-sqlite3");
const session = require("express-session");

const db = new Database("database.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam TEXT NOT NULL,
        username TEXT NOT NULL,
        time INTEGER NOT NULL,
        score REAL NOT NULL
    )
`);

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));


app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/warn", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "warn.html"));
});

app.get("/exam/:id", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "exam.html"));
});

// app.listen(PORT, "0.0.0.0", () => {
//     console.log(`Server running at http://localhost:${PORT}`);
// });

module.exports = app;

const EXAM_DIR = path.join(__dirname, "exam");

app.get("/api/exams", async (req, res) => {
    try {
        const files = await fs.readdir(EXAM_DIR);

        const exams = await Promise.all(
            files
                .filter(file => file.endsWith(".json"))
                .map(async file => {
                    const filePath = path.join(EXAM_DIR, file);
                    const content = await fs.readFile(filePath, "utf8");
                    const exam = JSON.parse(content);

                    return {
                        id: exam.id,
                        title: exam.title,
                        subject: exam.subject
                    };
                })
        );

        res.json(exams);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load exams" });
    }
});

app.get("/api/exams/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return res.status(400).json({ error: "Invalid ID" });
        }

        const filePath = path.join(EXAM_DIR, `${id}.json`);
        const content = await fs.readFile(filePath, "utf8");

        res.json(JSON.parse(content));
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.status(404).json({ error: "Exam not found" });
        }

        if (err instanceof SyntaxError) {
            return res.status(500).json({ error: "Invalid JSON file" });
        }

        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/exams/:id/complete", (req, res) => {
    const { username, time, score } = req.body;
    const exam = req.params.id;

    if (
        !/^[a-zA-Z0-9_-]+$/.test(exam) ||
        typeof username !== "string" ||
        !username.trim() ||
        username.length > 50 ||
        !Number.isInteger(time) ||
        time < 0 ||
        typeof score !== "number" ||
        !Number.isFinite(score) ||
        score < 0
    ) {
        return res.status(400).json({ error: "Invalid data" });
    }

    db.prepare(`
        INSERT INTO completions
            (exam, username, time, score)
        VALUES (?, ?, ?, ?)
    `).run(exam, username.trim(), time, score);

    res.json({ success: true });
});

app.get("/api/completions", (req, res) => {
    const rows = db.prepare("SELECT * FROM completions").all();
    res.json(rows);
});