export class Controls {
    constructor(container, hide) {
        this.container = container || document.body;
        this.keysPressed = {};
        this.toggleStates = {
            'KeyZ': false, // Orbit mode
            'KeyO': false, // Orthographic mode
            'KeyP': false, // Point cloud mode
            'KeyI': false  // Info panel
        };
        
        // Check if device is mobile or touch-enabled
        this.isMobileOrTouch = this.detectMobileOrTouch();
        
        // Create controls container
        this.controlsElement = document.createElement('div');
        this.controlsElement.className = 'controls-panel';
        this.controlsElement.style.display = hide || this.isMobileOrTouch ? 'none' : 'flex';
        
        // Create the key layout
        this.controlsElement.innerHTML = `
            <div class="controls-row">
                <div class="key-container">
                    <div class="key" data-key="KeyQ">Q</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyW">W</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyE">E</div>
                </div>
            </div>
            <div class="controls-row">
                <div class="key-container">
                    <div class="key" data-key="KeyA">A</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyS">S</div>
                </div>
                <div class="key-container">
                    <div class="key" data-key="KeyD">D</div>
                </div>
            </div>
            <div class="controls-row controls-toggle-row">
                <div class="key-container toggle-container">
                    <div class="key toggle-key" data-key="KeyZ" data-toggle="true">Z</div>
                    <div class="key-label">Orbit</div>
                </div>
                <div class="key-container toggle-container">
                    <div class="key toggle-key" data-key="KeyO" data-toggle="true">O</div>
                    <div class="key-label">Ortho</div>
                </div>
                <div class="key-container toggle-container">
                    <div class="key toggle-key" data-key="KeyP" data-toggle="true">P</div>
                    <div class="key-label">Point</div>
                </div>
                <div class="key-container toggle-container">
                    <div class="key toggle-key" data-key="KeyI" data-toggle="true">I</div>
                    <div class="key-label">Info</div>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.innerHTML = `
            .controls-panel {
                position: absolute;
                display: flex;
                flex-direction: column;
                gap: 5px;
                bottom: 20px;
                left: 20px;
                z-index: 1000;
                background-color: rgba(0, 0, 0, 0.5);
                padding: 10px;
                border-radius: 8px;
            }
            
            .controls-row {
                display: flex;
                justify-content: center;
                gap: 5px;
            }
            
            .controls-toggle-row {
                margin-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.3);
                padding-top: 10px;
            }
            
            .key-container {
                width: 40px;
                height: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .toggle-container {
                display: flex;
                flex-direction: column;
                height: auto;
                align-items: center;
                gap: 2px;
            }
            
            .key {
                width: 36px;
                height: 36px;
                background-color: rgba(255, 255, 255, 0.8);
                color: #333;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 4px;
                font-family: Arial, sans-serif;
                font-weight: bold;
                user-select: none;
                cursor: default;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .toggle-key {
                transition: background-color 0.2s, transform 0.1s, box-shadow 0.1s;
            }
            
            .toggle-key.toggled {
                background-color: #4CD964;
                color: white;
                box-shadow: 0 0 5px rgba(76, 217, 100, 0.5);
            }
            
            .key.pressed {
                background-color: #C27BFF;
                transform: translateY(2px);
                box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
            }
            
            .key-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.9);
                font-family: Arial, sans-serif;
                margin-top: 2px;
                text-align: center;
            }
        `;
        
        this.controlsElement.appendChild(style);
        this.container.appendChild(this.controlsElement);
        
        // Set up event listeners
        this.setupKeyListeners();
    }
    
    /**
     * Set up keyboard event listeners to highlight pressed keys
     */
    setupKeyListeners() {
        // Don't set up listeners if on mobile/touch
        if (this.isMobileOrTouch) return;
        
        // Store bound handlers to use in disposal
        this.keydownHandler = (event) => {
            this.keysPressed[event.code] = true;
            this.updateKeyHighlights();
        };
        
        this.keyupHandler = (event) => {
            this.keysPressed[event.code] = false;
            this.updateKeyHighlights();
        };
        
        // Add event listeners
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        
        // Add click handlers for toggle keys
        const toggleKeys = this.controlsElement.querySelectorAll('.toggle-key');
        toggleKeys.forEach(key => {
            key.addEventListener('click', () => {
                const keyCode = key.getAttribute('data-key');
                if (this.toggleStates.hasOwnProperty(keyCode)) {
                    this.toggleStates[keyCode] = !this.toggleStates[keyCode];
                    this.updateToggleKeys();
                    // Simulate a key press to trigger the viewer's handlers
                    const event = new KeyboardEvent('keydown', { code: keyCode });
                    document.dispatchEvent(event);
                }
            });
        });
    }
    
    /**
     * Update the toggle states from external changes
     */
    updateToggleState(keyCode, state) {
        if (this.toggleStates.hasOwnProperty(keyCode)) {
            this.toggleStates[keyCode] = state;
            this.updateToggleKeys();
        }
    }
    
    /**
     * Update the visual highlighting of keys based on pressed state
     */
    updateKeyHighlights() {
        // Get all regular key elements
        const keyElements = this.controlsElement.querySelectorAll('.key:not([data-toggle="true"])');
        
        // Update each key's appearance
        keyElements.forEach(key => {
            const keyCode = key.getAttribute('data-key');
            if (this.keysPressed[keyCode]) {
                key.classList.add('pressed');
            } else {
                key.classList.remove('pressed');
            }
        });
    }
    
    /**
     * Update the visual state of toggle keys
     */
    updateToggleKeys() {
        // Get all toggle key elements
        const toggleKeyElements = this.controlsElement.querySelectorAll('.toggle-key');
        
        // Update each toggle key's appearance
        toggleKeyElements.forEach(key => {
            const keyCode = key.getAttribute('data-key');
            if (this.toggleStates[keyCode]) {
                key.classList.add('toggled');
            } else {
                key.classList.remove('toggled');
            }
        });
    }
    
    /**
     * Show the controls (only if not on mobile/touch device)
     */
    show() {
        if (!this.isMobileOrTouch) {
            this.controlsElement.style.display = 'flex';
        }
    }
    
    /**
     * Hide the controls
     */
    hide() {
        this.controlsElement.style.display = 'none';
    }
    
    /**
     * Detect if device is a mobile device (phone/tablet)
     * @returns {boolean} True if mobile device
     */
    detectMobileOrTouch() {
        // Check if it's a mobile device based on user agent
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check screen size - typical cutoff for tablets is around 768px width
        const isSmallScreen = window.innerWidth <= 1024; 
        
        // Only hide on mobile devices, not just any touch-enabled device
        return isMobile && isSmallScreen;
    }
    
    /**
     * Remove the component and clean up event listeners
     */
    dispose() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
            this.keyupHandler = null;
        }
        
        if (this.controlsElement.parentNode) {
            this.container.removeChild(this.controlsElement);
        }
    }
}