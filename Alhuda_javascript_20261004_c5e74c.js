/* ============================================
   Al-Huda Islamic Centre - Main Script
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    const CONFIG = {
        defaultCity: 'St. John\'s',
        defaultCountry: 'Canada',
        defaultLat: 47.5615,
        defaultLng: -52.7126,
        prayerApiBase: 'https://api.aladhan.com/v1',
        calculationMethod: 2, // ISNA (Islamic Society of North America)
        school: 0 // Shafi'i
    };

    // ============================================
    // Utility Functions
    // ============================================
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatTime24 = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const parseTimeString = (timeStr) => {
        // timeStr format: "HH:MM" (24-hour)
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    // ============================================
    // Header / Navigation
    // ============================================
    function initHeader() {
        const header = $('#header');
        const navToggle = $('#navToggle');
        const navMenu = $('#navMenu');
        const navLinks = $$('.nav-link');

        // Scroll effect
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScroll = currentScroll;
        }, { passive: true });

        // Mobile toggle
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });
        }

        // Close menu on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            });
        });

        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });
    }

    // ============================================
    // Dates
    // ============================================
    function initDates() {
        const gregorianEl = $('#gregorianDate');
        const islamicEl = $('#islamicDate');

        const now = new Date();

        // Gregorian date
        if (gregorianEl) {
            gregorianEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Islamic date using Intl API
        if (islamicEl) {
            try {
                const islamicDate = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(now);
                islamicEl.textContent = islamicDate + ' AH';
            } catch (e) {
                // Fallback: try to fetch from API
                fetchIslamicDate();
            }
        }
    }

    async function fetchIslamicDate() {
        const islamicEl = $('#islamicDate');
        if (!islamicEl) return;

        try {
            const today = new Date();
            const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
            const response = await fetch(
                `https://api.aladhan.com/v1/gToH?date=${dateStr}`
            );
            const data = await response.json();
            if (data.code === 200 && data.data) {
                const h = data.data.hijri;
                islamicEl.textContent = `${h.day} ${h.month.en} ${h.year} AH`;
            }
        } catch (error) {
            console.warn('Could not fetch Islamic date:', error);
            islamicEl.textContent = 'Islamic date unavailable';
        }
    }

    // ============================================
    // Prayer Times
    // ============================================
    const PrayerTimes = {
        times: null,
        nextPrayer: null,

        async init() {
            const locationText = $('#locationText');
            const locationStatus = $('#locationStatus');

            try {
                // Try geolocation first
                if (navigator.geolocation) {
                    locationText.textContent = 'Detecting location...';
                    
                    const position = await this.getPosition();
                    const { latitude, longitude } = position.coords;
                    
                    // Reverse geocode to get city name
                    const cityName = await this.reverseGeocode(latitude, longitude);
                    locationText.textContent = `📍 ${cityName}`;
                    
                    await this.fetchPrayerTimes(latitude, longitude);
                } else {
                    throw new Error('Geolocation not supported');
                }
            } catch (error) {
                console.warn('Geolocation failed, using default:', error);
                locationText.textContent = `📍 ${CONFIG.defaultCity}, ${CONFIG.defaultCountry}`;
                await this.fetchPrayerTimes(CONFIG.defaultLat, CONFIG.defaultLng);
            }

            // Start countdown updates
            this.startCountdown();
        },

        getPosition() {
            return new Promise((resolve, reject) => {
                const options = {
                    enableHighAccuracy: false,
                    timeout: 8000,
                    maximumAge: 600000 // 10 minutes
                };

                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });
        },

        async reverseGeocode(lat, lng) {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );
                const data = await response.json();
                const address = data.address || {};
                const city = address.city || address.town || address.village || 
                             address.municipality || address.county || 'Your Location';
                const country = address.country || '';
                return country ? `${city}, ${country}` : city;
            } catch (error) {
                console.warn('Reverse geocoding failed:', error);
                return 'Your Location';
            }
        },

        async fetchPrayerTimes(lat, lng) {
            try {
                const today = new Date();
                const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
                
                const url = `${CONFIG.prayerApiBase}/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${CONFIG.calculationMethod}&school=${CONFIG.school}`;
                
                const response = await fetch(url);
                const data = await response.json();

                if (data.code === 200 && data.data) {
                    this.times = data.data.timings;
                    this.updateDisplay();
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (error) {
                console.error('Failed to fetch prayer times:', error);
                this.showError();
            }
        },

        updateDisplay() {
            if (!this.times) return;

            const mapping = {
                Fajr: '#fajrTime',
                Sunrise: '#sunriseTime',
                Dhuhr: '#dhuhrTime',
                Asr: '#asrTime',
                Maghrib: '#maghribTime',
                Isha: '#ishaTime'
            };

            Object.entries(mapping).forEach(([prayer, selector]) => {
                const el = $(selector);
                if (el && this.times[prayer]) {
                    // Times come in "HH:MM" format
                    const time = parseTimeString(this.times[prayer]);
                    el.textContent = formatTime(time);
                }
            });

            // Update next prayer in hero
            this.updateNextPrayer();
            
            // Highlight current/next prayer card
            this.highlightActivePrayer();
        },

        updateNextPrayer() {
            if (!this.times) return;

            const now = new Date();
            const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            
            let next = null;
            for (const prayer of prayers) {
                const time = parseTimeString(this.times[prayer]);
                if (time > now) {
                    next = { name: prayer, time };
                    break;
                }
            }

            // If no prayer left today, next is Fajr tomorrow
            if (!next) {
                next = {
                    name: 'Fajr',
                    time: parseTimeString(this.times.Fajr)
                };
                next.time.setDate(next.time.getDate() + 1);
            }

            this.nextPrayer = next;

            const nextEl = $('#nextPrayerName');
            if (nextEl) {
                nextEl.textContent = next.name;
            }
        },

        highlightActivePrayer() {
            if (!this.times) return;

            const now = new Date();
            const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            
            // Remove all active states
            $$('.prayer-card').forEach(card => card.classList.remove('active'));

            // Find current prayer (last prayer that has passed)
            let currentPrayer = null;
            for (const prayer of prayers) {
                const time = parseTimeString(this.times[prayer]);
                if (time <= now) {
                    currentPrayer = prayer;
                }
            }

            // If no prayer has passed yet, highlight Fajr
            if (!currentPrayer) currentPrayer = 'Fajr';

            const activeCard = $(`.prayer-card[data-prayer="${currentPrayer}"]`);
            if (activeCard) {
                activeCard.classList.add('active');
            }
        },

        startCountdown() {
            // Update every minute
            setInterval(() => {
                this.updateNextPrayer();
                this.highlightActivePrayer();
            }, 60000);
        },

        showError() {
            const locationText = $('#locationText');
            if (locationText) {
                locationText.textContent = '📍 Could not load prayer times';
            }
        }
    };

    // ============================================
    // FAQ Accordion
    // ============================================
    function initFAQ() {
        const faqItems = $$('.faq-item');

        faqItems.forEach(item => {
            const question = $('.faq-question', item);
            
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all others
                faqItems.forEach(other => {
                    if (other !== item) {
                        other.classList.remove('active');
                    }
                });

                // Toggle current
                item.classList.toggle('active', !isActive);
            });
        });
    }

    // ============================================
    // Scroll Reveal
    // ============================================
    function initScrollReveal() {
        const revealElements = $$('.section, .program-card, .pillar, .prayer-card, .faq-item, .event-card');

        if (!('IntersectionObserver' in window)) {
            // Fallback: show everything
            revealElements.forEach(el => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
    }

    // ============================================
    // Smooth Scroll for Anchor Links
    // ============================================
    function initSmoothScroll() {
        $$('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#') return;

                const target = $(href);
                if (target) {
                    e.preventDefault();
                    const headerHeight = $('#header').offsetHeight;
                    const targetPosition = target.getBoundingClientRect().top + 
                                           window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ============================================
    // Stat Counter Animation
    // ============================================
    function initStatCounters() {
        const statNumbers = $$('.stat-number, .badge-number');

        const animateValue = (el, start, end, duration, suffix = '') => {
            const startTime = performance.now();
            
            const update = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease out
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const current = Math.floor(start + (end - start) * easeOut);
                
                el.textContent = current + suffix;
                
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = end + suffix;
                }
            };
            
            requestAnimationFrame(update);
        };

        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const text = el.textContent;
                    const match = text.match(/^(\d+)(\+?)$/);
                    
                    if (match) {
                        const end = parseInt(match[1], 10);
                        const suffix = match[2] || '';
                        animateValue(el, 0, end, 1500, suffix);
                    }
                    
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(el => {
            // Only animate simple numbers, not "Loading..." or prayer names
            if (/^\d+\+?$/.test(el.textContent.trim())) {
                observer.observe(el);
            }
        });
    }

    // ============================================
    // Initialize Everything
    // ============================================
    function init() {
        initHeader();
        initDates();
        PrayerTimes.init();
        initFAQ();
        initScrollReveal();
        initSmoothScroll();
        initStatCounters();

        console.log('%c Al-Huda Islamic Centre ', 
            'background: #1a5f4a; color: #c9a227; font-size: 16px; font-weight: bold; padding: 8px 16px; border-radius: 4px;');
        console.log('Website loaded successfully.');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();