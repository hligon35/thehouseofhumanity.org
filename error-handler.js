// Error handling and performance optimization script
// Load this before other scripts to catch early errors

(function() {
    'use strict';
    
    // Prevent console errors in production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.log = console.warn = console.error = function() {};
    }
    
    // Handle missing resource errors gracefully
    window.addEventListener('error', function(e) {
        if (e.target !== window) {
            // Handle resource loading errors
            const element = e.target;
            
            if (element.tagName === 'IMG') {
                element.style.display = 'none';
                console.warn('Image failed to load:', element.src);
            } else if (element.tagName === 'LINK' && element.rel === 'icon') {
                element.remove();
                console.warn('Favicon failed to load:', element.href);
            } else if (element.tagName === 'SCRIPT') {
                console.warn('Script failed to load:', element.src);
            }
        }
    }, true);
    
    // Performance optimization: preload critical resources
    function preloadCriticalResources() {
        const criticalResources = [
            { href: 'styles.css', as: 'style' },
            { href: 'images/THOHlogo-320.webp', as: 'image' }
        ];
        
        criticalResources.forEach(resource => {
            if (!document.querySelector(`link[href="${resource.href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.href = resource.href;
                link.as = resource.as;
                if (resource.as === 'script') {
                    link.crossOrigin = 'anonymous';
                }
                document.head.appendChild(link);
            }
        });
    }
    
    // Initialize error handling when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', preloadCriticalResources);
    } else {
        preloadCriticalResources();
    }
    
})();
