const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

const db = new Database("attendance.db");


// ===============================
// STUDENTS TABLE
// ===============================

db.prepare(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT
    )
`).run();


// ===============================
// ATTENDANCE TABLE
// ===============================

db.prepare(`
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
    )
`).run();


// Prevent duplicate attendance
db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_student_date
    ON attendance(student_id, date)
`).run();


app.use(express.json());
app.use(express.static("public"));


// ===============================
// GET ALL STUDENTS
// ===============================

app.get("/api/students", (req, res) => {

    const students = db.prepare(`
        SELECT *
        FROM students
        ORDER BY roll_number
    `).all();

    res.json(students);
});


// ===============================
// SAVE ATTENDANCE
// ===============================

app.post("/api/attendance", (req, res) => {

    const { date, attendance } = req.body;

    if (!date || !attendance) {
        return res.status(400).json({
            message: "Date and attendance are required."
        });
    }

    const insert = db.prepare(`
        INSERT INTO attendance
        (student_id, date, status)
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

    try {

        saveAttendance();

        res.json({
            message: "Attendance saved successfully!"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to save attendance."
        });

    }
});


// ======================================================
// ATTENDANCE HISTORY
// FROM MONTH → TO MONTH
// INCLUDING MONTHLY + CUMULATIVE ATTENDANCE
// ======================================================

app.get("/api/attendance-history", (req, res) => {

    const { from, to, month } = req.query;


    // --------------------------------------------------
    // OLD SINGLE-MONTH REQUEST
    // This keeps the old feature working.
    // --------------------------------------------------

    if (month && !from && !to) {

        const students = db.prepare(`
            SELECT
                s.id,
                s.roll_number,
                s.name,

                COUNT(a.id) AS working_days,

                SUM(
                    CASE
                        WHEN a.status = 'Present'
                        THEN 1
                        ELSE 0
                    END
                ) AS present_days,

                SUM(
                    CASE
                        WHEN a.status = 'Absent'
                        THEN 1
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

            const workingDays =
                student.working_days || 0;

            const presentDays =
                student.present_days || 0;

            const absentDays =
                student.absent_days || 0;


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


        return res.json(result);
    }


    // --------------------------------------------------
    // NEW FROM-MONTH TO TO-MONTH REQUEST
    // --------------------------------------------------

    if (!from || !to) {

        return res.status(400).json({
            message: "Please provide From Month and To Month."
        });

    }


    if (from > to) {

        return res.status(400).json({
            message: "From Month cannot be after To Month."
        });

    }


    // --------------------------------------------------
    // GET STUDENTS
    // --------------------------------------------------

    const students = db.prepare(`
        SELECT
    id,
    roll_number,
    name,
    phone
FROM students
        ORDER BY roll_number
    `).all();


    // --------------------------------------------------
    // GET ALL ATTENDANCE RECORDS IN SELECTED RANGE
    // --------------------------------------------------

    const attendanceRecords = db.prepare(`
        SELECT
            student_id,
            date,
            status
        FROM attendance
        WHERE substr(date, 1, 7) >= ?
        AND substr(date, 1, 7) <= ?
        ORDER BY date
    `).all(from, to);


    // --------------------------------------------------
    // CREATE MONTH LIST
    // --------------------------------------------------

    const months = [];

    let currentYear =
        parseInt(from.substring(0, 4));

    let currentMonth =
        parseInt(from.substring(5, 7));


    const endYear =
        parseInt(to.substring(0, 4));

    const endMonth =
        parseInt(to.substring(5, 7));


    while (
        currentYear < endYear ||
        (
            currentYear === endYear &&
            currentMonth <= endMonth
        )
    ) {

        const monthString =
            currentYear +
            "-" +
            String(currentMonth).padStart(2, "0");


        months.push(monthString);


        currentMonth++;


        if (currentMonth > 12) {

            currentMonth = 1;
            currentYear++;

        }

    }


    // --------------------------------------------------
    // CREATE RESULT FOR EACH STUDENT
    // --------------------------------------------------

    const result = students.map(function(student) {

        const studentRecords =
            attendanceRecords.filter(
                record =>
                    record.student_id === student.id
            );


        const monthlyData = [];


        let totalWorkingDays = 0;
        let totalPresentDays = 0;
        let totalAbsentDays = 0;


        // ----------------------------------------------
        // CALCULATE EACH MONTH
        // ----------------------------------------------

        months.forEach(function(month) {

            const monthRecords =
                studentRecords.filter(
                    record =>
                        record.date.substring(0, 7) === month
                );


            const workingDays =
                monthRecords.length;


            const presentDays =
                monthRecords.filter(
                    record =>
                        record.status === "Present"
                ).length;


            const absentDays =
                monthRecords.filter(
                    record =>
                        record.status === "Absent"
                ).length;


            const percentage =
                workingDays > 0
                    ? ((presentDays / workingDays) * 100).toFixed(2)
                    : "0.00";


            monthlyData.push({

                month: month,

                workingDays: workingDays,

                present: presentDays,

                absent: absentDays,

                percentage: percentage

            });


            // Add to cumulative totals
            totalWorkingDays += workingDays;

            totalPresentDays += presentDays;

            totalAbsentDays += absentDays;

        });


        // ------------------------------------------------
        // CUMULATIVE ATTENDANCE
        // ------------------------------------------------

        const cumulativePercentage =
            totalWorkingDays > 0
                ? (
                    (totalPresentDays / totalWorkingDays)
                    * 100
                ).toFixed(2)
                : "0.00";


        return {

            roll_number: student.roll_number,

            name: student.name,

            months: monthlyData,

            cumulative: {

                workingDays: totalWorkingDays,

                present: totalPresentDays,

                absent: totalAbsentDays,

                percentage: cumulativePercentage

            },

            cumulativePercentage: cumulativePercentage

        };

    });


    res.json(result);

});


// ===============================
// START SERVER
// ===============================

const server = app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});


server.on("error", (error) => {

    console.log(
        "Server error:",
        error
    );

});


// ===============================
// SERVER STATUS
// ===============================

setInterval(() => {

    console.log(
        "Server is running..."
    );

}, 30000);