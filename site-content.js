(function () {
    function setText(id, value) {
        var element = document.getElementById(id);
        if (element && typeof value === 'string') {
            element.textContent = value;
        }
    }

    function setLink(id, label, href) {
        var element = document.getElementById(id);
        if (element && element.tagName === 'A') {
            if (typeof label === 'string') {
                element.textContent = label;
            }
            if (typeof href === 'string') {
                element.setAttribute('href', href);
            }
        }
    }

    function setImage(id, src, alt) {
        var element = document.getElementById(id);
        if (element && element.tagName === 'IMG') {
            if (typeof src === 'string') {
                element.setAttribute('src', src);
            }
            if (typeof alt === 'string') {
                element.setAttribute('alt', alt);
            }
        }
    }

    function setThemeColors(colors) {
        if (!colors) {
            return;
        }

        var root = document.documentElement;
        root.style.setProperty('--site-primary', colors.primary || '#02c9aa');
        root.style.setProperty('--site-secondary', colors.secondary || '#6c2eb7');
        root.style.setProperty('--site-accent', colors.accent || '#f4b740');
        root.style.setProperty('--site-background', colors.background || '#f7f6fa');
        root.style.setProperty('--site-surface', colors.surface || '#ffffff');
        root.style.setProperty('--site-text', colors.text || '#18212f');
    }

    function applyContent(content) {
        if (!content) {
            return;
        }

        setText('site-about-title', content.about && content.about.title);
        setText('site-about-subtitle', content.about && content.about.subtitle);
        setText('site-about-mission-heading', content.about && content.about.missionHeading);
        setText('site-about-mission-body', content.about && content.about.missionBody);
        setText('site-about-vision-heading', content.about && content.about.visionHeading);
        setText('site-about-vision-body', content.about && content.about.visionBody);

        setText('site-newsletter-title', content.newsletter && content.newsletter.title);
        setText('site-newsletter-body', content.newsletter && content.newsletter.body);
        setLink('site-newsletter-cta', content.newsletter && content.newsletter.ctaLabel, '#contact');

        setText('site-events-heading', content.events && content.events.heading);
        setText('site-events-intro', content.events && content.events.intro);

        var featuredEvent = content.events && content.events.items && content.events.items[0];
        if (featuredEvent) {
            setText('site-event-title', featuredEvent.title);
            setText('site-event-description', featuredEvent.description);
            setLink('site-event-cta', featuredEvent.ctaLabel, featuredEvent.ctaHref);
            setImage('site-event-image', featuredEvent.imageSrc, featuredEvent.imageAlt);
        }

        setText('site-shop-heading', content.shop && content.shop.heading);
        setText('site-shop-body', content.shop && content.shop.body);
        setLink('site-shop-cta', content.shop && content.shop.ctaLabel, content.shop && content.shop.ctaHref);

        setImage('site-founder-image', content.images && content.images.founder && content.images.founder.src, content.images && content.images.founder && content.images.founder.alt);
        setImage('site-newsletter-image', content.images && content.images.newsletter && content.images.newsletter.src, content.images && content.images.newsletter && content.images.newsletter.alt);

        setThemeColors(content.colors);
    }

    window.addEventListener('DOMContentLoaded', function () {
        fetch('/api/site-content?mode=published')
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Published content feed unavailable');
                }

                return response.json();
            })
            .then(applyContent)
            .catch(function () {
                return null;
            });
    });
})();