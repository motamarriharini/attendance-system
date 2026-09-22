const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

const db = new Database("attendance.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
    )
`).run();

db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_student_date
    ON attendance(student_id, date)
`).run();

app.use(express.json());
app.use(express.static("public"));

app.get("/api/students", (req, res) => {

    const students = db.prepare(`
        SELECT * FROM students
        ORDER BY roll_number
    `).all();

    res.json(students);
});

app.post("/api/attendance", (req, res) => {

    const { date, attendance } = req.body;

    const insert = db.prepare(`
        INSERT INTO attendance (student_id, date, status)
        VALUES (?, ?, ?)
        ON CONFLICT(student_id, date)
        DO UPDATE SET status = excluded.status
    `);

    const saveAttendance = db.transaction(() => {

        for (const record of attendance) {

            insert.run(
                record.student_id,
                date,
                record.status
            );

        }

    });

    saveAttendance();

    res.json({
        message: "Attendance saved successfully!"
    });
});

app.get("/api/attendance-history", (req, res) => {

    const { month } = req.query;

    const students = db.prepare(`
        SELECT
            s.id,
            s.roll_number,
            s.name,

            COUNT(a.id) AS working_days,

            SUM(
                CASE
                    WHEN a.status = 'Present' THEN 1
                    ELSE 0
                END
            ) AS present_days,

            SUM(
                CASE
                    WHEN a.status = 'Absent' THEN 1
                    ELSE 0
                END
            ) AS absent_days

        FROM students s

        LEFT JOIN attendance a
        ON s.id = a.student_id
        AND substr(a.date, 1, 7) = ?

        GROUP BY s.id

        ORDER BY s.roll_number
    `).all(month);

    const result = students.map(function(student) {

        const workingDays = student.working_days || 0;
        const presentDays = student.present_days || 0;
        const absentDays = student.absent_days || 0;

        const percentage =
            workingDays > 0
                ? ((presentDays / workingDays) * 100).toFixed(2)
                : "0.00";

        return {
            roll_number: student.roll_number,
            name: student.name,
            working_days: workingDays,
            present_days: presentDays,
            absent_days: absentDays,
            percentage: percentage
        };
    });

    res.json(result);
});

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
    console.log("Server error:", error);
});

setInterval(() => {
    console.log("Server is running...");
}, 30000);