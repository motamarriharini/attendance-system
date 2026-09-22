const Database = require("better-sqlite3");

const db = new Database("attendance.db");

const students = [
    ["323136412001", "M.Harini", "8885811224"],
    ["323136412002", "S.Hema", "7569496808"],
    ["323136412003", "M.Rupa", "8897333090"],
    ["323136412004", "P.Harika", "8639152987"],
    ["323136412005", "T.Harshini", "8520926144"]
];

const update = db.prepare(`
    UPDATE students
    SET name = ?, phone = ?
    WHERE roll_number = ?
`);

for (const student of students) {
    update.run(student[1], student[2], student[0]);
}

console.log("Student details updated successfully!");

db.close();