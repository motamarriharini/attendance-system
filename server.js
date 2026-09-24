require("dotenv").config();

const express = require("express");
const { createClient } = require("@libsql/client");

const app = express();
const PORT = process.env.PORT || 3000;

const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

app.use(express.json());
app.use(express.static("public"));


// ===============================
// GET ALL STUDENTS
// ===============================

app.get("/api/students", async (req, res) => {

    try {

        const result = await turso.execute(`
            SELECT id, roll_number, name, phone
            FROM students
            ORDER BY id
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to load students."
        });
    }
});


// ===============================
// SUBMIT ATTENDANCE
// ===============================

app.post("/api/attendance", async (req, res) => {

    try {

        const { date, attendance } = req.body;

        if (!date || !Array.isArray(attendance)) {

            return res.status(400).json({
                message: "Invalid attendance data."
            });
        }

        const statements = attendance.map(record => ({

            sql: `
                INSERT INTO attendance
                (student_id, date, status)
                VALUES (?, ?, ?)

                ON CONFLICT(student_id, date)
                DO UPDATE SET status = excluded.status
            `,

            args: [
                record.student_id,
                date,
                record.status
            ]

        }));

        await turso.batch(statements, "write");

        res.json({
            message: "Attendance submitted successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to submit attendance."
        });
    }
});


// ===============================
// ATTENDANCE HISTORY
// ===============================

app.get("/api/attendance-history", async (req, res) => {

    try {

        const { from, to, month } = req.query;

        let fromMonth = from;
        let toMonth = to;

        if (month) {
            fromMonth = month;
            toMonth = month;
        }

        if (!fromMonth || !toMonth) {

            return res.status(400).json({
                message: "Please provide from and to months."
            });
        }

        if (
            !/^\d{4}-\d{2}$/.test(fromMonth) ||
            !/^\d{4}-\d{2}$/.test(toMonth)
        ) {

            return res.status(400).json({
                message: "Invalid month format."
            });
        }

        if (fromMonth > toMonth) {

            return res.status(400).json({
                message: "From month cannot be after to month."
            });
        }


        // First day of selected starting month
        const startDate = `${fromMonth}-01`;

        // Last day of selected ending month
        const [year, monthNumber] = toMonth.split("-").map(Number);

        const lastDay = new Date(
            year,
            monthNumber,
            0
        ).getDate();

        const endDate =
            `${toMonth}-${String(lastDay).padStart(2, "0")}`;


        // Get students
        const studentsResult = await turso.execute(`
            SELECT id, roll_number, name, phone
            FROM students
            ORDER BY id
        `);

        const students = studentsResult.rows;


        // Get attendance records
        const attendanceResult = await turso.execute({

            sql: `
                SELECT student_id, date, status
                FROM attendance
                WHERE date >= ?
                AND date <= ?
                ORDER BY date
            `,

            args: [
                startDate,
                endDate
            ]

        });

        const attendanceRecords = attendanceResult.rows;


        // Create list of months
        const months = [];

        let currentYear = Number(fromMonth.substring(0, 4));
        let currentMonth = Number(fromMonth.substring(5, 7));

        const endYear = Number(toMonth.substring(0, 4));
        const endMonth = Number(toMonth.substring(5, 7));

        while (
            currentYear < endYear ||
            (
                currentYear === endYear &&
                currentMonth <= endMonth
            )
        ) {

            months.push(
                `${currentYear}-${String(currentMonth).padStart(2, "0")}`
            );

            currentMonth++;

            if (currentMonth === 13) {
                currentMonth = 1;
                currentYear++;
            }
        }


        // Prepare history for each student
        const history = students.map(student => {

            let totalWorkingDays = 0;
            let totalPresent = 0;

            const monthlyData = months.map(month => {

                const records = attendanceRecords.filter(record =>
                    record.student_id === student.id &&
                    record.date.startsWith(month)
                );

                const workingDays = records.length;

                const present = records.filter(
                    record => record.status === "Present"
                ).length;

                const absent = records.filter(
                    record => record.status === "Absent"
                ).length;

                totalWorkingDays += workingDays;
                totalPresent += present;

                const percentage =
                    workingDays > 0
                        ? ((present / workingDays) * 100).toFixed(2)
                        : "0.00";

                return {
                    month: month,
                    workingDays: workingDays,
                    present: present,
                    absent: absent,
                    percentage: percentage
                };

            });


            const cumulativePercentage =
                totalWorkingDays > 0
                    ? ((totalPresent / totalWorkingDays) * 100).toFixed(2)
                    : "0.00";


            return {
                id: student.id,
                roll_number: student.roll_number,
                name: student.name,
                phone: student.phone,
                months: monthlyData,
                cumulativePercentage: cumulativePercentage
            };

        });


        res.json(history);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to load attendance history."
        });
    }
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});