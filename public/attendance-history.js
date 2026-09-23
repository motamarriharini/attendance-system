document.getElementById("viewHistory").addEventListener("click", async function () {

    const fromMonth = document.getElementById("fromMonth").value;
    const toMonth = document.getElementById("toMonth").value;
    const historyDiv = document.getElementById("history");

    if (!fromMonth || !toMonth) {
        alert("Please select both months.");
        return;
    }

    if (fromMonth > toMonth) {
        alert("From Month cannot be after To Month.");
        return;
    }

    try {

        const response = await fetch(
            `/api/attendance-history?from=${fromMonth}&to=${toMonth}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error("Failed to load attendance history.");
        }

        historyDiv.innerHTML = "";

        if (data.length === 0) {
            historyDiv.innerHTML = "<p>No attendance records found.</p>";
            return;
        }

        data.forEach(student => {

            const studentDiv = document.createElement("div");
            studentDiv.className = "student-history";

            let monthlyHTML = "";

            student.months.forEach(month => {

                monthlyHTML += `
                    <div class="month-row">
                        <strong>${month.month}</strong>
                        <span>Working Days: ${month.workingDays}</span>
                        <span>Present: ${month.present}</span>
                        <span>Absent: ${month.absent}</span>
                        <span>Attendance: ${month.percentage}%</span>
                    </div>
                `;
            });

            let warningHTML = "";

            if (Number(student.cumulativePercentage) < 75) {

                const message =
                    `Dear ${student.name}, your cumulative attendance is ${student.cumulativePercentage}%. ` +
                    `Your attendance is below 75%. Condemnation fee is applicable. Please contact the college office.`;

                const whatsappLink =
                    `https://wa.me/91${student.phone}?text=${encodeURIComponent(message)}`;

                warningHTML = `
                    <div class="attendance-warning">
                        <strong>⚠ Attendance below 75%</strong>
                        <p>
                            Condemnation fee is applicable.
                        </p>

                        <a href="${whatsappLink}" target="_blank">
                            <button class="message-button">
                                Send Message
                            </button>
                        </a>
                    </div>
                `;
            }

            studentDiv.innerHTML = `
                <h2>${student.roll_number} - ${student.name}</h2>

                ${monthlyHTML}

                <div class="cumulative">
                    <strong>Cumulative Attendance:</strong>
                    ${student.cumulativePercentage}%
                </div>

                ${warningHTML}
            `;

            historyDiv.appendChild(studentDiv);
        });

    } catch (error) {

        console.error(error);

        historyDiv.innerHTML =
            "<p>Error loading attendance history.</p>";
    }
});