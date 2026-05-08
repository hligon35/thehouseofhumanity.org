// House of Humanity Website JavaScript
// Enhanced functionality for interactive features with performance optimizations

// Use modern ES6+ features and optimizations
'use strict';

// Utility functions for performance
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Modern intersection observer for animations
const observeElementsInView = () => {
    const elements = document.querySelectorAll('.mission-card, .stat, .option-card');
    
    if (!elements.length) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initForms();
    initAnimations();
    initDonationFeatures();
    initAccessibility();
    initAnalytics();
    // Performance: register service worker if supported (no visual changes)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Scope will be the site root since sw.js is at root
            navigator.serviceWorker
                .register('/sw.js')
                .catch((err) => {
                    // Silently ignore to avoid console noise in production
                    // console.debug('SW registration failed', err);
                });
        });
    }
});

// Navigation functionality with performance optimizations
function initNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.querySelector('.navbar');
    const header = document.querySelector('.header');

    // Set a dynamic CSS var for header height so the menu positions correctly
    const setHeaderHeightVar = () => {
        const h1 = header ? header.getBoundingClientRect().height : 0;
        const h2 = navbar ? navbar.getBoundingClientRect().height : 0;
        const h = Math.max(h1, h2, 80);
        document.documentElement.style.setProperty('--header-h', `${Math.round(h)}px`);
    };
    setHeaderHeightVar();
    window.addEventListener('resize', debounce(setHeaderHeightVar, 150));
    window.addEventListener('orientationchange', setHeaderHeightVar);

    // Mobile menu toggle with improved accessibility
    if (navToggle && navMenu) {
        // Ensure a backdrop exists for dimming and easy outside tap close
        let backdrop = document.querySelector('.nav-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'nav-backdrop';
            document.body.appendChild(backdrop);
        }

    // Toggle off-canvas menu, backdrop, and header state
    navToggle.addEventListener('click', function() {
            const isExpanded = navMenu.classList.contains('active');

            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            backdrop.classList.toggle('active');
            if (navbar) {
                navbar.classList.toggle('menu-open', !isExpanded);
                if (!isExpanded) {
                    // Ensure no transform while menu is open
                    navbar.style.transform = '';
                }
            }

            // Update ARIA attributes
            navToggle.setAttribute('aria-expanded', String(!isExpanded));

            // Prevent body scroll when menu is open
            document.body.style.overflow = !isExpanded ? 'hidden' : '';
            document.body.style.touchAction = !isExpanded ? 'none' : '';
        });

    // Close menu when clicking a nav link (and restore state)
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
        document.body.style.touchAction = '';
                const bd = document.querySelector('.nav-backdrop');
                if (bd) bd.classList.remove('active');
                if (navbar) navbar.classList.remove('menu-open');
            });
        });

    // Close menu when clicking outside (optimized)
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target) || navToggle.contains(event.target);
            if (!isClickInsideNav && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                const bd = document.querySelector('.nav-backdrop');
                if (bd) bd.classList.remove('active');
                if (navbar) navbar.classList.remove('menu-open');
            }
        });

        // Close when tapping the backdrop
        document.querySelector('.nav-backdrop')?.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.querySelector('.nav-backdrop')?.classList.remove('active');
                if (navbar) navbar.classList.remove('menu-open');
            }
        });

    // Close on Escape for accessibility
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                navToggle.focus();
                const bd = document.querySelector('.nav-backdrop');
                if (bd) bd.classList.remove('active');
                if (navbar) navbar.classList.remove('menu-open');
            }
        });
    }

    // Optimized navbar scroll effect with throttling
    let lastScrollTop = 0;
    
    const handleScroll = throttle(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add background on scroll with better performance
        if (scrollTop > 50) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
        
        // Hide/show navbar on scroll (optional) - optimized
        if (navbar) {
            // Do not hide the navbar if the mobile menu is open
            const menuOpen = navMenu && navMenu.classList.contains('active');
            if (!menuOpen && scrollTop > lastScrollTop && scrollTop > 100) {
                navbar.style.transform = 'translateY(-100%)';
            } else {
                // Remove inline transform to avoid creating a containing block
                navbar.style.transform = '';
            }
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
    }, 16); // ~60fps

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Smooth scrolling for anchor links with improved performance
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                if (!target.hasAttribute('tabindex')) {
                    target.setAttribute('tabindex', '-1');
                }

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Update focus for accessibility
                target.focus({ preventScroll: true });
            }
        });
    });

    // Accessibility: indicate current page in nav
    const updateAriaCurrent = () => {
        try {
            const currentURL = new URL(window.location.href);
            navLinks.forEach((a) => {
                a.removeAttribute('aria-current');
                const href = a.getAttribute('href') || '';
                const linkURL = new URL(href, currentURL.origin);
                const samePath = linkURL.pathname === currentURL.pathname;
                const bothNoHash = !linkURL.hash && !currentURL.hash;
                const bothSameHash = linkURL.hash && linkURL.hash === currentURL.hash;
                if (samePath && (bothNoHash || bothSameHash)) {
                    a.setAttribute('aria-current', 'page');
                }
            });
        } catch (_) {
            // Ignore URL parsing errors
        }
    };
    updateAriaCurrent();
    window.addEventListener('hashchange', updateAriaCurrent);
    window.addEventListener('popstate', updateAriaCurrent);
}

// Form handling and validation with enhanced UX
function initForms() {
    // Contact forms (support multiple and iframe-target native submissions)
    const contactForms = document.querySelectorAll('form.contact-form');
    contactForms.forEach(form => {
        const usesIframe = form.getAttribute('target') === 'formFrame';
        const iframeId = form.getAttribute('target');
        const iframe = usesIframe ? document.getElementById(iframeId) : null;

        // Populate PageURL hidden field if present
        const pageUrlField = form.querySelector('input[name="PageURL"]');
        if (pageUrlField) {
            try { pageUrlField.value = window.location.href; } catch (_) {}
        }

        // Real-time validation with debouncing
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', debounce(clearFieldError, 300));
        });

    if (usesIframe && (form.getAttribute('method') || '').toUpperCase() === 'POST') {
            form.addEventListener('submit', function(e) {
                // Honeypot check
                const honeypot = form.querySelector('input[name="website"]');
                if (honeypot && honeypot.value) {
                    e.preventDefault();
                    return;
                }

                // Validate
                const data = Object.fromEntries(new FormData(form));
        if (!validateContactForm(data, form)) {
                    e.preventDefault();
                updateFormMessage(form, 'Please fill the required fields: Name, Email, and Topic.', 'error');
            showNotification('Please fill the required fields: Name, Email, and Topic.', 'error');
                    return;
                }

                // Ensure Subject mirrors Topic for backend compatibility
                try {
                    const subj = form.querySelector('input[name="Subject"]');
                    const topicSel = form.querySelector('[name="Topic"]');
                    if (subj && topicSel) {
                        subj.value = topicSel.value || '';
                    }
                } catch (_) {}

                // Show loading state
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.textContent : '';
                if (submitBtn) {
                    submitBtn.dataset.originalText = originalText;
                    submitBtn.textContent = 'Sending...';
                    submitBtn.disabled = true;
                }

                // Fallback timer in case iframe load is blocked
                if (iframe) {
                    if (iframe._thohListener) {
                        iframe.removeEventListener('load', iframe._thohListener);
                    }
                    iframe._thohListener = function() {
                        try {
                            // Try to read iframe body text
                            const doc = iframe.contentDocument || iframe.contentWindow?.document;
                            const text = (doc && doc.body) ? doc.body.textContent.trim() : '';
                            const isOK = /(ok|success)/i.test(text);
                            const isError = /error/i.test(text);
                            if (isOK) {
                                updateFormMessage(form, 'Thanks — we got your message!', 'success');
                                showNotification('Thanks — we got your message!', 'success');
                                form.reset();
                            } else if (isError) {
                                updateFormMessage(form, 'There was an issue sending your message. Please try again.', 'error');
                                showNotification('There was an issue sending your message. Please try again.', 'error');
                            } else if (text) {
                                // Unknown non-empty response: assume success to avoid blocking users
                                updateFormMessage(form, 'Thanks — we got your message!', 'success');
                                showNotification('Thanks — we got your message!', 'success');
                                form.reset();
                            } else {
                                // Empty but loaded – assume success for Apps Script minimal responses
                                updateFormMessage(form, 'Thanks — we got your message!', 'success');
                                showNotification('Thanks — we got your message!', 'success');
                                form.reset();
                            }
                        } catch (_) {
                            // Cross-origin read may fail; assume success on load
                            updateFormMessage(form, 'Thanks — we got your message!', 'success');
                            showNotification('Thanks — we got your message!', 'success');
                            form.reset();
                        } finally {
                            // Clear fallback timer if set
                            if (form._thohTimeout) {
                                clearTimeout(form._thohTimeout);
                                form._thohTimeout = null;
                            }
                            if (submitBtn) {
                                submitBtn.textContent = submitBtn.dataset.originalText || 'Send';
                                submitBtn.disabled = false;
                            }
                        }
                    };
                    iframe.addEventListener('load', iframe._thohListener, { once: true });

                    // Also set a timeout fallback (5s) in case load never fires
                    clearTimeout(form._thohTimeout);
                    form._thohTimeout = setTimeout(() => {
                        if (submitBtn) {
                            submitBtn.textContent = submitBtn.dataset.originalText || 'Send';
                            submitBtn.disabled = false;
                        }
                        updateFormMessage(form, 'Thanks — if you do not hear from us shortly, please email info@thehouseofhumanity.org.', 'info');
                        showNotification('Thanks — if you don\'t hear from us shortly, please email info@thehouseofhumanity.org.', 'info');
                    }, 5000);
                }
                // Allow native submit into iframe
            });
        } else {
            // Legacy/dev forms without iframe
            form.addEventListener('submit', handleContactSubmit);
        }
    });

    // Donation form with enhanced security
    const donationForm = document.querySelector('.donation-form');
    if (donationForm) {
        donationForm.addEventListener('submit', handleDonationSubmit);
        initDonationAmountSelection();
        initPaymentMethodSelection();
    }

    // Newsletter signup with spam protection
    const newsletterForms = document.querySelectorAll('.newsletter-form');
    newsletterForms.forEach(form => {
        form.addEventListener('submit', handleNewsletterSubmit);
    });
}

function updateFormMessage(form, message, type = 'info') {
    const messageRegion = form?.querySelector('#formMessage');
    if (!messageRegion) {
        return;
    }

    const colors = {
        success: 'var(--success-color)',
        error: 'var(--danger-color)',
        info: 'var(--info-color)'
    };

    messageRegion.textContent = message;
    messageRegion.style.display = 'block';
    messageRegion.style.color = colors[type] || colors.info;
}

// Contact form submission
function handleContactSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Validate form
    if (!validateContactForm(data, form)) {
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    // Simulate form submission (replace with actual API call)
    setTimeout(() => {
        showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 2000);
    
    // Track form submission
    trackEvent('contact_form_submit', {
        subject: data.subject || data.Subject || data.topic || data.Topic,
        urgency: data.urgency
    });
}

// Donation form submission
function handleDonationSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Validate donation form
    if (!validateDonationForm(data)) {
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;
    
    // Simulate donation processing (replace with actual payment processor)
    setTimeout(() => {
        showNotification('Thank you for your generous donation!', 'success');
        showDonationConfirmation(data);
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 3000);
    
    // Track donation
    trackEvent('donation_submit', {
        amount: data.amount,
        frequency: data.frequency,
        payment_method: data.payment_method
    });
}

// Newsletter signup
function handleNewsletterSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const email = form.querySelector('input[type="email"]').value;
    
    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address.', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Subscribing...';
    submitBtn.disabled = true;
    
    // Simulate newsletter signup
    setTimeout(() => {
        showNotification('Successfully subscribed to our newsletter!', 'success');
        form.reset();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 1500);
    
    // Track newsletter signup
    trackEvent('newsletter_signup', { email_domain: email.split('@')[1] });
}

// Form validation functions
function validateContactForm(data, form) {
    const errors = [];
    const name = (data.name || data.Name || '').trim();
    const email = (data.email || data.Email || '').trim();
    const subject = (data.subject || data.Subject || data.topic || data.Topic || '').trim();
    // Message is optional; do not block submission for short messages
    // const message = (data.message || data.Message || '').trim();

    const markError = (selector, message) => {
        if (!form) return;
        const field = form.querySelector(selector);
        if (field) {
            showFieldError(field, message);
            field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    };

    if (!name || name.length < 2) {
        errors.push('Name must be at least 2 characters long.');
        markError('[name="Name"], [name="name"]', 'Please enter your name (min 2 characters).');
    }
    if (!email || !isValidEmail(email)) {
        errors.push('Please enter a valid email address.');
        markError('[name="Email"], [name="email"]', 'Please enter a valid email address.');
    }
    if (!subject) {
        errors.push('Please select how we can help you.');
        markError('[name="Topic"]', 'Please select a topic.');
    }

    if (errors.length > 0) {
        // Also add a generic notification; specific field errors are shown inline
        return false;
    }
    return true;
}

function validateDonationForm(data) {
    const errors = [];
    
    if (!data.amount || parseFloat(data.amount) < 1) {
        errors.push('Please enter a valid donation amount.');
    }
    
    if (!data.payment_method) {
        errors.push('Please select a payment method.');
    }
    
    if (!data.donor_name || data.donor_name.trim().length < 2) {
        errors.push('Please enter your full name.');
    }
    
    if (!data.donor_email || !isValidEmail(data.donor_email)) {
        errors.push('Please enter a valid email address.');
    }
    
    if (errors.length > 0) {
        showNotification(errors.join(' '), 'error');
        return false;
    }
    
    return true;
}

function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    let isValid = true;
    let message = '';
    
    // Remove existing error styling
    field.classList.remove('error');
    
    // Validate based on field type
    if (field.required && !value) {
        isValid = false;
        message = 'This field is required.';
    } else if (field.type === 'email' && value && !isValidEmail(value)) {
        isValid = false;
        message = 'Please enter a valid email address.';
    } else if (field.type === 'tel' && value && !isValidPhone(value)) {
        isValid = false;
        message = 'Please enter a valid phone number.';
    }
    
    if (!isValid) {
        showFieldError(field, message);
    }
    
    return isValid;
}

function clearFieldError(event) {
    const field = event.target;
    field.classList.remove('error');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.color = 'var(--danger-color)';
    errorElement.style.fontSize = '0.875rem';
    errorElement.style.marginTop = '0.25rem';
    
    field.parentNode.appendChild(errorElement);
}

// Donation-specific features
function initDonationFeatures() {
    initDonationAmountSelection();
    initPaymentMethodSelection();
    initRecurringDonation();
}

function initDonationAmountSelection() {
    const amountOptions = document.querySelectorAll('.amount-option');
    const customAmountInput = document.querySelector('#custom-amount');
    
    amountOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all options
            amountOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add active class to clicked option
            this.classList.add('selected');
            
            // Set the amount value
            const amount = this.dataset.amount;
            if (customAmountInput && amount !== 'custom') {
                customAmountInput.value = amount;
            }
            
            // Clear custom input if preset amount selected
            if (amount !== 'custom' && customAmountInput) {
                customAmountInput.value = amount;
            }
        });
    });
    
    // Handle custom amount input
    if (customAmountInput) {
        customAmountInput.addEventListener('input', function() {
            amountOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Select custom option if exists
            const customOption = document.querySelector('.amount-option[data-amount="custom"]');
            if (customOption) {
                customOption.classList.add('selected');
            }
        });
    }
}

function initPaymentMethodSelection() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', function() {
            // Remove active class from all methods
            paymentMethods.forEach(m => m.classList.remove('selected'));
            
            // Add active class to clicked method
            this.classList.add('selected');
            
            // Show/hide relevant form fields
            const paymentType = this.dataset.method;
            togglePaymentFields(paymentType);
        });
    });
}

function togglePaymentFields(paymentType) {
    const cardFields = document.querySelector('.card-fields');
    const bankFields = document.querySelector('.bank-fields');
    const paypalFields = document.querySelector('.paypal-fields');
    
    // Hide all payment fields
    if (cardFields) cardFields.style.display = 'none';
    if (bankFields) bankFields.style.display = 'none';
    if (paypalFields) paypalFields.style.display = 'none';
    
    // Show relevant fields
    switch (paymentType) {
        case 'card':
            if (cardFields) cardFields.style.display = 'block';
            break;
        case 'bank':
            if (bankFields) bankFields.style.display = 'block';
            break;
        case 'paypal':
            if (paypalFields) paypalFields.style.display = 'block';
            break;
    }
}

function initRecurringDonation() {
    const recurringCheckbox = document.querySelector('#recurring-donation');
    const frequencySelect = document.querySelector('#donation-frequency');
    
    if (recurringCheckbox && frequencySelect) {
        recurringCheckbox.addEventListener('change', function() {
            frequencySelect.style.display = this.checked ? 'block' : 'none';
            frequencySelect.required = this.checked;
        });
    }
}

// Animation and scroll effects
// Enhanced animations with better performance
function initAnimations() {
    // Use the optimized intersection observer
    observeElementsInView();
    
    // Enhanced counter animation for statistics
    animateCounters();
    
    // Parallax effect for hero section (optional, performance-conscious)
    initParallaxEffect();
}

function animateCounters() {
    const counters = document.querySelectorAll('.stat h3, .stat-number');
    
    const counterObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const text = counter.textContent;
                const numbers = text.match(/\d+/);
                
                if (numbers) {
                    const target = parseInt(numbers[0]);
                    const duration = 2000;
                    const step = target / (duration / 16);
                    let current = 0;
                    
                    const timer = setInterval(() => {
                        current += step;
                        if (current >= target) {
                            current = target;
                            clearInterval(timer);
                        }
                        
                        // Format number and maintain any suffix (+ or %)
                        const formatted = Math.floor(current);
                        const suffix = text.replace(/\d+/, '').replace(/^[\d,]+/, '');
                        counter.textContent = formatted + suffix;
                    }, 16);
                    
                    counterObserver.unobserve(counter);
                }
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => counterObserver.observe(counter));
}

// Optional parallax effect (only if user prefers motion)
function initParallaxEffect() {
    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
        const hero = document.querySelector('.hero');
        if (!hero) return;
        
        const handleParallax = throttle(() => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            hero.style.transform = `translateY(${rate}px)`;
        }, 16);
        
        window.addEventListener('scroll', handleParallax, { passive: true });
    }
}

// Enhanced accessibility
function initAccessibility() {
    // Add skip link if it doesn't exist
    if (!document.querySelector('.skip-link')) {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-link';
        document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Add main content ID if it doesn't exist
    const main = document.querySelector('main') || document.querySelector('.hero');
    if (main && !main.id) {
        main.id = 'main-content';
    }
    
    // Social media links accessibility - uncomment when ready to use
    /*
    // Add aria-labels to social media links
    const socialLinks = document.querySelectorAll('.footer-social a');
    socialLinks.forEach(link => {
        const icon = link.textContent.trim();
        let ariaLabel = '';
        
        switch (icon) {
            case '📘':
                ariaLabel = 'Visit our Facebook page';
                break;
            case '🐦':
                ariaLabel = 'Follow us on Twitter';
                break;
            case '📸':
                ariaLabel = 'Follow us on Instagram';
                break;
            case '💼':
                ariaLabel = 'Connect with us on LinkedIn';
                break;
            default:
                ariaLabel = 'Social media link';
        }
        
        link.setAttribute('aria-label', ariaLabel);
    });
    */
    
    // Keyboard navigation for mobile menu
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    }
    
    // Focus management for modals and overlays
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close mobile menu
            const navMenu = document.getElementById('nav-menu');
            const navToggle = document.getElementById('nav-toggle');
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
                navToggle.focus();
            }
        }
    });
}

// Analytics and tracking
function initAnalytics() {
    // Track page views
    trackEvent('page_view', {
        page: window.location.pathname,
        title: document.title
    });
    
    // Track scroll depth
    let maxScroll = 0;
    const scrollMilestones = [25, 50, 75, 90];
    
    window.addEventListener('scroll', debounce(function() {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            
            scrollMilestones.forEach(milestone => {
                if (scrollPercent >= milestone && !window[`milestone_${milestone}_tracked`]) {
                    trackEvent('scroll_depth', { depth: milestone });
                    window[`milestone_${milestone}_tracked`] = true;
                }
            });
        }
    }, 250));
    
    // Track external link clicks
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link) {
            console.log('Link clicked:', link.textContent.trim(), 'href:', link.href, 'hostname:', link.hostname, 'current hostname:', window.location.hostname);
        }
        if (link && link.hostname !== window.location.hostname) {
            trackEvent('external_link_click', {
                url: link.href,
                text: link.textContent.trim()
            });
        }
    });
    
    // Track donation button clicks
    const donationButtons = document.querySelectorAll('a[href*="donate"], .btn-primary');
    donationButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            console.log('Button clicked:', this.textContent.trim(), 'href:', this.href);
            trackEvent('donation_button_click', {
                location: this.closest('section')?.className || 'unknown',
                text: this.textContent.trim()
            });
            // Don't prevent default navigation
        });
    });
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone);
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    notification.setAttribute('aria-atomic', 'true');
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" aria-label="Close notification">&times;</button>
        </div>
    `;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--info-color)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function showDonationConfirmation(data) {
    const modal = document.createElement('div');
    modal.className = 'donation-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thank You for Your Donation!</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="confirmation-icon">💚</div>
                <p>Your generous donation of <strong>$${data.amount}</strong> will help us continue our mission of making a way for those who need it most.</p>
                <p>A confirmation email has been sent to <strong>${data.donor_email}</strong>.</p>
                <div class="next-steps">
                    <h4>What happens next?</h4>
                    <ul>
                        <li>You'll receive a tax-deductible receipt via email</li>
                        <li>Your donation will be put to work immediately</li>
                        <li>We'll keep you updated on our impact</li>
                    </ul>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary modal-close">Close</button>
            </div>
        </div>
    `;
    
    // Style the modal
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // Add close functionality
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            modal.remove();
        });
    });
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

function trackEvent(eventName, parameters = {}) {
    // Google Analytics 4 tracking (replace with your actual tracking ID)
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, parameters);
    }
    
    // Facebook Pixel tracking
    if (typeof fbq !== 'undefined') {
        fbq('track', eventName, parameters);
    }
    
    // Console log for development (remove in production)
    console.log('Event tracked:', eventName, parameters);
}

// Add CSS animations
const animationCSS = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .field-error {
        color: var(--danger-color);
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
    
    .form-group input.error,
    .form-group select.error,
    .form-group textarea.error {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
    }
    
    .notification {
        animation: slideInRight 0.3s ease;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        margin-left: 1rem;
        opacity: 0.8;
    }
    
    .notification-close:hover {
        opacity: 1;
    }
    
    .modal-content {
        background: white;
        border-radius: var(--radius-lg);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-body {
        padding: 1.5rem;
        text-align: center;
    }
    
    .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color);
        text-align: right;
    }
    
    .confirmation-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }
    
    .next-steps {
        text-align: left;
        margin-top: 1.5rem;
        padding: 1rem;
        background: var(--background-color);
        border-radius: var(--radius-md);
    }
    
    .next-steps ul {
        margin: 0.5rem 0 0 1rem;
    }
    
    .next-steps li {
        margin-bottom: 0.5rem;
    }
`;

// Inject animation CSS
const style = document.createElement('style');
style.textContent = animationCSS;
document.head.appendChild(style);

// Service Worker registration for PWA features (optional)
// Commented out until service-worker.js is implemented
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed');
            });
    });
}
*/
