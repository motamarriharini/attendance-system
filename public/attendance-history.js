const monthInput = document.getElementById("month");
const history = document.getElementById("history");

const today = new Date();

const currentMonth =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0");

monthInput.value = currentMonth;

monthInput.addEventListener("change", loadHistory);

async function loadHistory() {

    history.innerHTML = "Loading...";

    const month = monthInput.value;

    const response = await fetch(
        `/api/attendance-history?month=${month}`
    );

    const data = await response.json();

    history.innerHTML = "";

    data.forEach(function(student) {

        const card = document.createElement("div");

        card.className = "student-card";

        card.innerHTML = `
            <div class="student-name">
                ${student.name}
            </div>

            <div class="roll">
                ${student.roll_number}
            </div>

            <div class="attendance-info">
                Working Days: ${student.working_days}<br>
                Present: ${student.present_days}<br>
                Absent: ${student.absent_days}<br>
                <span class="percentage">
                    Attendance: ${student.percentage}%
                </span>
            </div>
        `;

        history.appendChild(card);
    });
}

loadHistory();