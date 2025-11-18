// Landing Page JavaScript

// Smooth scroll to waitlist
function scrollToWaitlist() {
    document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' });
}

// Waitlist form handling
document.getElementById('waitlistForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('waitlistEmail').value;
    const form = e.target;
    const successMessage = document.getElementById('successMessage');
    
    // Store in localStorage (later will be sent to backend)
    const waitlist = JSON.parse(localStorage.getItem('havhabit:waitlist') || '[]');
    
    if (waitlist.some(entry => entry.email === email)) {
        alert('You\'re already on the waitlist!');
        return;
    }
    
    waitlist.push({
        email,
        timestamp: new Date().toISOString(),
        referrer: document.referrer || 'direct',
        source: new URLSearchParams(window.location.search).get('utm_source') || 'organic'
    });
    
    localStorage.setItem('havhabit:waitlist', JSON.stringify(waitlist));
    
    // Show success message
    form.style.display = 'none';
    successMessage.style.display = 'block';
    
    // Track conversion (analytics hook for later)
    console.log('Waitlist signup:', email);
    
    // Optional: Send to backend when ready
    // await fetch('/api/waitlist', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email })
    // });
});

// Animate on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .problem-card, .testimonial-card, .pricing-card').forEach(el => {
    observer.observe(el);
});

// Sticky nav on scroll
let lastScroll = 0;
const nav = document.querySelector('.landing-nav');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Update stats dynamically (mock data for now)
function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = end;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Mobile menu toggle (add if needed)
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('mobile-active');
}
