import * as THREE from "three";

/**
 * Creates simple floating text labels in 3D space
 */
export class FloatingLabels {
	/**
	 * @param {Object} viewer - The viewer instance
	 * @param {Array} labelsData - Array of label data objects
	 */
	constructor(viewer, labelsData = []) {
		this.viewer = viewer;
		this.scene = viewer.threeScene;
		this.camera = viewer.camera;
		this.labels = new Map(); // Store labels by ID

		// Create a group to hold all labels
		this.labelsGroup = new THREE.Group();
		this.scene.add(this.labelsGroup);

		// Add labels from initial data
		if (labelsData && labelsData.length > 0) {
			this.addLabels(labelsData);
		}

		// Set up integration with viewer update cycle
		this.setupViewerIntegration();
	}

	/**
	 * Add multiple labels from an array of data
	 * @param {Array} labelsData - Array of label data objects
	 */
	addLabels(labelsData) {
		if (!labelsData || !Array.isArray(labelsData)) return;

		labelsData.forEach((labelData) => {
			this.addLabel(labelData.id, labelData.position, labelData.text, labelData.options || {});
		});
	}

	/**
	 * Add a single label to the scene
	 * @param {string} id - Unique identifier for the label
	 * @param {Array|THREE.Vector3} position - 3D position [x,y,z] or Vector3
	 * @param {string} text - Text content for the label
	 * @param {Object} options - Customization options
	 * @returns {Object} - The created label object
	 */
	addLabel(id, position, text, options = {}) {
		// Convert position array to Vector3 if needed
		const labelPosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();

		// Create the label 3D object
		const label = this.createLabelObject(labelPosition, text, options);

		// Store in our map for future reference
		this.labels.set(id, label);

		// Add to our group in the scene
		this.labelsGroup.add(label.container);

		return label;
	}

	/**
	 * Create a 3D label object
	 * @private
	 */
	createLabelObject(position, text, options = {}) {
		// Create a group to hold all label parts
		const container = new THREE.Group();
		container.position.copy(position);

		// Apply offset if provided
		if (options.offset) {
			const offset = Array.isArray(options.offset) ? new THREE.Vector3(...options.offset) : options.offset;
			container.position.add(offset);
		}

		// Set label dimensions
		const width = options.width || 1.5;
		const height = options.height || 0.5;

		// Create background plane
		const backgroundColor = options.backgroundColor
			? new THREE.Color(options.backgroundColor)
			: new THREE.Color(0x333333);
		const backgroundOpacity = options.opacity !== undefined ? options.opacity : 0.8;

		const backgroundGeometry = new THREE.PlaneGeometry(width, height);
		const backgroundMaterial = new THREE.MeshBasicMaterial({
			color: backgroundColor,
			transparent: true,
			opacity: backgroundOpacity,
			side: THREE.DoubleSide,
			depthTest: options.depthTest !== undefined ? options.depthTest : true,
		});

		const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);

		// Create text using canvas texture
		const textSprite = this.createTextSprite(text, {
			width,
			height,
			textColor: options.textColor || "#ffffff",
			font: options.font || "Bold 20px Helvetica",
			padding: options.padding || 16,
		});

		// Position text slightly in front of background to prevent z-fighting
		textSprite.position.z = 0.005;

		// Add connector line if requested
		let connector = null;
		if (options.showConnector) {
			connector = this.createConnector(options);
			container.add(connector);
		}

		// Add components to container
		container.add(background);
		container.add(textSprite);

		// Set initial visibility
		container.visible = options.visible !== undefined ? options.visible : true;

		return {
			container,
			background,
			textSprite,
			connector,
			text,
			options,
		};
	}

	/**
	 * Create a text sprite using canvas
	 * @private
	 */
	createTextSprite(text, options = {}) {
		// Create canvas for rendering text
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");

		// Set higher resolution for better text quality
		canvas.width = options.canvasWidth || 512;
		canvas.height = options.canvasHeight || 256;

		// Clear canvas
		context.clearRect(0, 0, canvas.width, canvas.height);

		// Set up text styling
		context.font = options.font || "Bold 20px Arial";
		context.fillStyle = options.textColor || "#ffffff";
		context.textAlign = options.textAlign || "center";
		context.textBaseline = "middle";

		// Handle multiline text
		const lines = text.split("\\n");
		const lineHeight = options.lineHeight || 32;
		const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

		// Draw each line of text
		lines.forEach((line, i) => {
			context.fillText(line, canvas.width / 2, startY + i * lineHeight);
		});

		// Create texture from canvas
		const texture = new THREE.CanvasTexture(canvas);
		// Use better filtering for text sharpness
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		// Create sprite material
		const spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: options.depthTest !== undefined ? options.depthTest : true,
		});

		// Create sprite
		const sprite = new THREE.Sprite(spriteMaterial);

		// Scale sprite to match desired dimensions
		sprite.scale.set(options.width || 1.5, options.height || 0.5, 1);

		return sprite;
	}

	/**
	 * Create a connector line
	 * @private
	 */
	createConnector(options = {}) {
		const length = options.connectorLength || 0.5;
		const color = options.connectorColor
			? new THREE.Color(options.connectorColor)
			: new THREE.Color(0xffffff);

		const geometry = new THREE.BufferGeometry();
		const lineStart = new THREE.Vector3(0, 0, 0);
		const lineEnd = new THREE.Vector3(0, -length, 0);

		geometry.setFromPoints([lineStart, lineEnd]);

		const material = new THREE.LineBasicMaterial({
			color: color,
			transparent: true,
			opacity: options.opacity || 0.8,
		});

		return new THREE.Line(geometry, material);
	}

	/**
	 * Remove a label by ID
	 * @param {string} id - Label identifier
	 */
	removeLabel(id) {
		const label = this.labels.get(id);
		if (!label) return;

		// Remove from scene
		this.labelsGroup.remove(label.container);

		// Clean up resources
		if (label.textSprite && label.textSprite.material) {
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
		}

		if (label.background && label.background.material) {
			label.background.material.dispose();
			label.background.geometry.dispose();
		}

		// Remove from our map
		this.labels.delete(id);
	}

	/**
	 * Remove all labels
	 */
	clearAllLabels() {
		// Remove all labels one by one
		for (const id of this.labels.keys()) {
			this.removeLabel(id);
		}
	}

	/**
	 * Set label visibility
	 * @param {string} id - Label identifier
	 * @param {boolean} visible - Visibility state
	 */
	setLabelVisibility(id, visible) {
		const label = this.labels.get(id);
		if (label) {
			label.container.visible = visible;
		}
	}

	/**
	 * Update a label's position
	 * @param {string} id - Label identifier
	 * @param {Array|THREE.Vector3} newPosition - New position
	 */
	updateLabelPosition(id, newPosition) {
		const label = this.labels.get(id);
		if (!label) return;

		// Update position
		if (Array.isArray(newPosition)) {
			label.container.position.set(newPosition[0], newPosition[1], newPosition[2]);
		} else {
			label.container.position.copy(newPosition);
		}
	}

	/**
	 * Update a label's text
	 * @param {string} id - Label identifier
	 * @param {string} newText - New text content
	 * @param {Object} newOptions - Optional updated options
	 */
	updateLabelText(id, newText, newOptions = {}) {
		const label = this.labels.get(id);
		if (!label) return;

		// Update text
		label.text = newText;

		// Clean up old text sprite
		if (label.textSprite && label.textSprite.material) {
			label.container.remove(label.textSprite);
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
		}

		// Merge options
		const mergedOptions = { ...label.options, ...newOptions };
		label.options = mergedOptions;

		// Create new text sprite
		label.textSprite = this.createTextSprite(newText, {
			width: mergedOptions.width || 1.5,
			height: mergedOptions.height || 0.5,
			textColor: mergedOptions.textColor || "#ffffff",
			font: mergedOptions.font || "Bold 20px Arial",
		});

		label.textSprite.position.z = 0.005;
		label.container.add(label.textSprite);
	}

	/**
	 * Update all labels (called during render loop)
	 */
	update() {
		if (!this.camera) return;

		this.labels.forEach((label) => {
			// Make label face the camera (billboard effect)
			label.container.quaternion.copy(this.camera.quaternion);
		});
	}

	/**
	 * Setup integration with the viewer's render/update loop
	 * @private
	 */
	setupViewerIntegration() {
		// If the viewer has a self-driven update loop
		if (this.viewer.update) {
			const originalUpdate = this.viewer.update;
			const self = this;

			this.viewer.update = function (renderer, camera) {
				originalUpdate.call(this, renderer, camera);
				self.update();
			};
		}
	}

	/**
	 * Show all labels
	 */
	show() {
		this.labelsGroup.visible = true;
	}

	/**
	 * Hide all labels
	 */
	hide() {
		this.labelsGroup.visible = false;
	}

	/**
	 * Clean up resources and remove labels
	 */
	dispose() {
		// Clean up all labels
		this.clearAllLabels();

		// Remove group from scene
		if (this.labelsGroup) {
			this.scene.remove(this.labelsGroup);
			this.labelsGroup = null;
		}

		// Clear references
		this.viewer = null;
		this.scene = null;
		this.camera = null;
	}
}
