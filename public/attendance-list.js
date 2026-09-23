let students = [];
const absentStudents = [];

const today = new Date();

document.getElementById("date").textContent =
    today.toLocaleDateString("en-IN");

async function loadStudents() {

    const response = await fetch("/api/students");

    students = await response.json();

    displayStudents();
}

function displayStudents(list = students) {

    const studentList = document.getElementById("studentList");

    studentList.innerHTML = "";

    list.forEach(function(student) {

        const isAbsent = absentStudents.includes(student.id);

        const div = document.createElement("div");

        div.className = "student-row";

        let contactButtons = "";

        if (isAbsent) {

            const message =
                `Dear Parent, your ward ${student.name} (${student.roll_number}) is absent today. Please take note of the attendance.`;

            const whatsappLink =
                `https://wa.me/91${student.phone}?text=${encodeURIComponent(message)}`;

            contactButtons = `
                <div class="phone">
                    Phone: ${student.phone}
                </div>

                <div class="contact-buttons">

                    <a class="call-btn" href="tel:${student.phone}">
                        Call
                    </a>

                    <a class="message-btn"
                       href="${whatsappLink}"
                       target="_blank">
                        Message
                    </a>

                </div>
            `;
        }

        div.innerHTML = `
            <div class="student-details">

                <div class="roll">
                    ${student.roll_number}
                </div>

                <div class="name">
                    ${student.name}
                </div>

                ${contactButtons}

            </div>

            <button
                class="status-btn ${isAbsent ? "absent" : "present"}"
                onclick="markAbsent(${student.id})"
            >
                ${isAbsent ? "ABSENT" : "PRESENT"}
            </button>
        `;

        studentList.appendChild(div);
    });

    updateCount();
}

function markAbsent(studentId) {

    const index = absentStudents.indexOf(studentId);

    if (index === -1) {
        absentStudents.push(studentId);
    } else {
        absentStudents.splice(index, 1);
    }

    displayStudents();
}

function updateCount() {

    document.getElementById("total").textContent =
        students.length;

    document.getElementById("present").textContent =
        students.length - absentStudents.length;

    document.getElementById("absent").textContent =
        absentStudents.length;
}

function searchStudent() {

    const search =
        document.getElementById("search").value.toLowerCase();

    const filtered = students.filter(function(student) {

        return student.roll_number
            .toLowerCase()
            .includes(search)

            ||

            student.name
            .toLowerCase()
            .includes(search);
    });

    displayStudents(filtered);
}

async function submitAttendance() {

    const attendance = students.map(function(student) {

        return {
            student_id: student.id,
            status: absentStudents.includes(student.id)
                ? "Absent"
                : "Present"
        };

    });

    const response = await fetch("/api/attendance", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            date: today.toISOString().split("T")[0],

            attendance: attendance

        })

    });

    const result = await response.json();

    alert(result.message);
}

loadStudents();