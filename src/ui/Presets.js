export class Presets {
    /**
     * This component shows buttons for preset views that users can click or press
     * @param {HTMLElement} container - The container to append the controls to
     * @param {Object} options - Configuration options
     * @param {boolean} [options.hide=false] - Whether to hide the controls initially
     * @param {[{label?: string; lookAt: number[]; position: number[];}]} [options.presets=[]] - Array of preset configurations
     * @param {Function} [options.onPresetSelected] - Callback when preset is selected
     */
    constructor(container, options = {}) {
        this.container = container || document.body;
        this.keysPressed = {};
        this.presets = options.presets || [];
        this.onPresetSelected = options.onPresetSelected || ((preset) => console.log(`Preset ${preset.id} selected`));
        
        // Check if device is mobile
        this.isMobile = this.detectMobile();
        
        // Create controls container
        this.controlsElement = document.createElement('div');
        this.controlsElement.className = 'preset-controls-panel';
        
        // If no presets, don't create the UI
        if (this.presets.length === 0) {
            // Just create the element but don't append it to the container
            return;
        }
        
        // Set initial display state
        this.controlsElement.style.display = options.hide ? 'none' : 'flex';
        
        // Limit to maximum 9 presets
        this.presets = this.presets.slice(0, 9).map((preset, index) => {
            return {
                ...preset,
                id: index + 1,
                key: `Digit${index + 1}`,
                label: `${preset?.label ?? index + 1}`,
            };
        });
        
        // Create the preset buttons layout in a single row
        let buttonsHTML = '';
        for (let i = 0; i < this.presets.length; i++) {
            const preset = this.presets[i];
            buttonsHTML += `
                <div class="preset-button-container">
                    <div class="preset-button" data-key="${preset.key}" data-preset-index="${i}">
                        ${preset.label}
                    </div>
                </div>
            `;
        }
        
        this.controlsElement.innerHTML = buttonsHTML;
        
        // Add styles
        const style = document.createElement('style');
        style.innerHTML = `
            .preset-controls-panel {
                position: absolute;
                display: flex;
                flex-direction: row;
                gap: 5px;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                background-color: rgba(0, 0, 0, 0.5);
                padding: 10px;
                border-radius: 8px;
                flex-wrap: wrap;
                justify-content: center;
                max-width: 90vw;
            }
            
            @media (max-width: 768px) {
                .preset-controls-panel {
                    max-width: 95vw;
                }
            }
            
            .preset-row {
                display: flex;
                gap: 5px;
            }
            
            .preset-button-container {
                width: 40px;
                height: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .preset-button {
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
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                transition: all 0.1s ease;
            }
            
            .preset-button:hover {
                background-color: rgba(255, 255, 255, 0.9);
            }
            
            .preset-button.pressed {
                background-color: #C27BFF;
                transform: translateY(2px);
                box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
            }
        `;
        
        this.controlsElement.appendChild(style);
        this.container.appendChild(this.controlsElement);
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Set up keyboard and click event listeners
     */
    setupEventListeners() {
        // If no presets, don't set up listeners
        if (this.presets.length === 0) return;
        
        // Don't set up keyboard listeners if on mobile
        if (!this.isMobile) {
            // Keydown event - highlight key and trigger preset
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            
            // Keyup event - remove highlight
            document.addEventListener('keyup', this.handleKeyUp.bind(this));
        }
        
        // Click event for buttons
        const buttons = this.controlsElement.querySelectorAll('.preset-button');
        buttons.forEach(button => {
            button.addEventListener('click', this.handleButtonClick.bind(this));
        });
    }
    
    /**
     * Handle keydown event
     */
    handleKeyDown(event) {
        // If no presets, don't handle events
        if (this.presets.length === 0) return;
        
        // Find preset that matches the pressed key
        const presetIndex = this.presets.findIndex(preset => preset.key === event.code);
        
        if (presetIndex !== -1) {
            this.keysPressed[event.code] = true;
            this.updateHighlights();
            
            // Get the preset and invoke the callback
            const preset = this.presets[presetIndex];
            this.onPresetSelected(preset);
        }
    }
    
    /**
     * Handle keyup event
     */
    handleKeyUp(event) {
        // If no presets, don't handle events
        if (this.presets.length === 0) return;
        
        // Find preset that matches the released key
        const presetIndex = this.presets.findIndex(preset => preset.key === event.code);
        
        if (presetIndex !== -1) {
            this.keysPressed[event.code] = false;
            this.updateHighlights();
        }
    }
    
    /**
     * Handle button click event
     */
    handleButtonClick(event) {
        const button = event.currentTarget;
        const presetIndex = parseInt(button.getAttribute('data-preset-index'));
        
        if (presetIndex >= 0 && presetIndex < this.presets.length) {
            // Visual feedback
            button.classList.add('pressed');
            setTimeout(() => {
                button.classList.remove('pressed');
            }, 200);
            
            // Invoke the callback with the preset object
            this.onPresetSelected(this.presets[presetIndex]);
        }
    }
    
    /**
     * Update the visual highlighting of buttons based on pressed state
     */
    updateHighlights() {
        // If no presets, don't update highlights
        if (this.presets.length === 0) return;
        
        // Get all button elements
        const buttonElements = this.controlsElement.querySelectorAll('.preset-button');
        
        // Update each button's appearance
        buttonElements.forEach(button => {
            const keyCode = button.getAttribute('data-key');
            if (this.keysPressed[keyCode]) {
                button.classList.add('pressed');
            } else {
                button.classList.remove('pressed');
            }
        });
    }
    
    /**
     * Detect if device is a mobile device (phone/tablet)
     * @returns {boolean} True if mobile device
     */
    detectMobile() {
        // Check if it's a mobile device based on user agent
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check screen size - typical cutoff for tablets is around 768px width
        const isSmallScreen = window.innerWidth <= 1024; 
        
        // Only hide on mobile devices, not just any touch-enabled device
        return isMobile && isSmallScreen;
    }
    
    /**
     * Show the controls - only if there are presets
     */
    show() {
        if (this.presets.length > 0 && this.controlsElement) {
            this.controlsElement.style.display = 'flex';
        }
    }
    
    /**
     * Hide the controls
     */
    hide() {
        if (this.controlsElement) {
            this.controlsElement.style.display = 'none';
        }
    }
    
    /**
     * Remove the component and clean up event listeners
     */
    dispose() {
        // Only clean up if we have presets
        if (this.presets.length > 0) {
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
            
            // Remove click listeners
            const buttons = this.controlsElement.querySelectorAll('.preset-button');
            buttons.forEach(button => {
                button.removeEventListener('click', this.handleButtonClick);
            });
            
            if (this.controlsElement && this.controlsElement.parentNode) {
                this.container.removeChild(this.controlsElement);
            }
        }
    }
}