const ball = document.getElementById("ball");
const hero = document.getElementById("hero");
const message = document.getElementById("message");
const left = document.getElementById("left");
const right = document.getElementById("right");
const shortcuts = document.querySelectorAll(".shortcut");
const searchForm = document.getElementById("news-search-form");
const searchInput = document.getElementById("news-search");

const typoMap = {
    goverment: "government",
    govermentt: "government",
    presdient: "president",
    elction: "election",
    enviroment: "environment",
    technolgy: "technology",
    acdemic: "academic",
    cliate: "climate",
    uiniversity: "university",
    sport: "sports",
    goverment: "government",
    chnage: "change",
    poltics: "politics",
    econmics: "economics",
    busines: "business",
    benefi: "benefit"
};

let darkMode = true;

function correctSearchQuery(rawQuery) {
    if (!rawQuery) return "";

    let corrected = rawQuery
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!corrected) return "";

    corrected = corrected
        .split(" ")
        .map((word) => typoMap[word] || word)
        .join(" ");

    return corrected
        .split(" ")
        .filter(Boolean)
        .join(" ");
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function openCustomSearch(searchTerm) {
    const normalized = correctSearchQuery(searchTerm);
    if (!normalized) return;

    const dateString = getLocalDateString(new Date());
    const newsUrl = new URL("news.html", window.location.href);
    newsUrl.searchParams.set("category", "custom");
    newsUrl.searchParams.set("date", dateString);
    newsUrl.searchParams.set("query", normalized);
    window.location.href = newsUrl.toString();
}

function switchmode() {
    darkMode = !darkMode;

    if (darkMode) {
        ball.style.transform = "translateX(28px)";
        ball.style.transition = "transform 0.5s ease-in-out";
        message.innerText = "Dark Mode";
        message.style.transition = "all 0.5s ease-in";
        hero.style.background = "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 34%), radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 28%), linear-gradient(180deg, #020617 0%, #101012 48%, #111827 100%)";
        left.style.color = "#e5e7eb";
        left.style.borderRadius = "0";
        left.style.boxShadow = "none";
        shortcuts.forEach((shortcut) => {
            shortcut.style.background = "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 34%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #111827 100%)";
            shortcut.style.color = "#fff";
        });
        right.style.background = "linear-gradient(180deg, #020617 0%, #101012 48%, #111827 100%)";
        right.style.boxShadow = "0 24px 80px rgba(49, 52, 58, 0.45)";
        right.style.color = "#e5e7eb";
    } else {
        ball.style.transform = "translateX(0)";
        ball.style.transition = "transform 0.5s ease-in-out";
        message.innerText = "Light Mode";
        message.style.transition = "all 0.5s ease-in";
        hero.style.background = "#fff";
        left.style.color = "#1a1a1a";
        left.style.borderRadius = "20px";
        left.style.boxShadow = "0 24px 80px rgba(62, 64, 69, 0.45)";
        shortcuts.forEach((shortcut) => {
            shortcut.style.background = "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 48%, #cbd5e1 100%)";
            shortcut.style.color = "#1a1a1a";
        });
        right.style.background = "#fff";
        right.style.boxShadow = "0 24px 80px rgba(62, 64, 69, 0.45)";
        right.style.color = "#1a1a1a";
    }
}

if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = searchInput.value;
        if (!query.trim()) return;
        openCustomSearch(query);
    });
}
    
// Contact Form Handler
const contactForm = document.getElementById("contact-form");
const contactStatus = document.getElementById("contact-status");

if (contactForm && !document.querySelector('script[src*="contact.js"]')) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const name = document.getElementById("contact-name").value.trim();
        const email = document.getElementById("contact-email").value.trim();
        const subject = document.getElementById("contact-subject").value.trim();
        const message = document.getElementById("contact-message").value.trim();
        
        if (!name || !email || !message) {
            contactStatus.style.color = "red";
            contactStatus.textContent = "Please fill in all required fields.";
            return;
        }
        
        try {
            contactStatus.textContent = "Sending...";
            contactStatus.style.color = "#666";
            
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, subject, message })
            });
            
            const data = await response.json();
            
            if (response.ok && data.ok) {
                contactStatus.textContent = "✓ Message sent successfully! We'll get back to you soon.";
                contactStatus.style.color = data.emailSent ? "green" : "#b45309";
                contactForm.reset();
            } else {
                contactStatus.textContent = "✗ Failed to send message: " + (data.message || "Unknown error");
                contactStatus.style.color = "red";
            }
        } catch (error) {
            contactStatus.textContent = "✗ Error sending message: " + error.message;
            contactStatus.style.color = "red";
            console.error("Contact form error:", error);
        }
    });
}

// Hamburger nav toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        navToggle.classList.toggle("active", isOpen);
        navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
}

