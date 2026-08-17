// Shared contact form handler for news.html and dashboard.html
(function(){
  const contactForm = document.getElementById("contact-form");
  const contactStatus = document.getElementById("contact-status");

  if(!contactForm || !contactStatus) return;

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("contact-name").value.trim();
    const email = document.getElementById("contact-email").value.trim();
    const subject = document.getElementById("contact-subject").value.trim();
    const message = document.getElementById("contact-message").value.trim();

    if(!name || !email || !message){
      contactStatus.style.color = "red";
      contactStatus.textContent = "⚠️ Please fill in all required fields.";
      return;
    }

    // Keep the user informed - disable button while sending
    const submitBtn = contactForm.querySelector('.submit-btn') || contactForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    try{
      contactStatus.style.display = "block";
      contactStatus.style.color = "#666";
      contactStatus.textContent = "📨 Sending your message, please wait...";

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });

      const data = await response.json();

      if(response.ok && data.ok){
        if(data.emailSent){
          contactStatus.style.color = "green";
          contactStatus.textContent = "✓ Message sent successfully! Thanks for reaching out. We'll get back to you soon.";
        } else {
          contactStatus.style.color = "#b45309";
          contactStatus.textContent = "✓ Message received! Email delivery isn't configured yet, but we've saved your message.";
        }
        contactForm.reset();
      } else {
        contactStatus.style.color = "red";
        contactStatus.textContent = "✗ Failed to send message: " + (data.message || "Unknown error");
      }
    } catch(error){
      contactStatus.style.color = "red";
      contactStatus.textContent = "✗ Error sending message: " + error.message + ". Please try again.";
      console.error("Contact form error:", error);
    } finally {
      // Re-enable the submit button so the user can try again if needed
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText || "Send Message";
      }
    }
  });
})();
