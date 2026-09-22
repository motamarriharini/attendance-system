const today = new Date();

document.getElementById("date").textContent =
    today.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

function startAttendance() {
    window.location.href = "attendance-list.html";
}