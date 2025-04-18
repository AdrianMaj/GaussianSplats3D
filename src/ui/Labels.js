import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";

export class FloatingLabels {
	constructor(viewer, labelsData = [], callbacks = {}) {
		this.viewer = viewer;
		this.scene = viewer.threeScene;
		this.camera = viewer.camera;
		this.renderer = viewer.renderer; // Store renderer if needed for resolution updates
		this.labels = new Map();
		this.editMode = false;
		this.selectedLabelId = null;

		this.callbacks = {
			onLabelsUpdate: callbacks.onLabelsUpdate, // The single update callback
			onModalOpen: callbacks.onModalOpen,
			onModalClose: callbacks.onModalClose,
		};

		// Create a group to hold all labels
		this.labelsGroup = new THREE.Group();
		this.scene.add(this.labelsGroup);

		// --- Temporary vectors for update loop ---
		this._tempVec3 = new THREE.Vector3();
		this._cameraRight = new THREE.Vector3();
		// ---

		// Create UI for label editing/creation
		this.createEditUI();

		// Add labels from initial data
		if (labelsData && labelsData.length > 0) {
			this.addLabels(labelsData);
		}

		// Set up integration with viewer update cycle
		this.setupViewerIntegration();

		// Set up click handler for label selection
		this.setupClickHandler();
	}

	// --- NEW Internal Method to Notify Viewer ---
	/**
	 * Gathers the current state of all labels and calls the onLabelsUpdate callback.
	 * @private
	 */
	_notifyUpdate() {
		if (this.callbacks.onLabelsUpdate) {
			const allCurrentLabelsData = [];
			this.labels.forEach((labelInstance, id) => {
				allCurrentLabelsData.push({
					id: id,
					// Use the connectorTarget as the persistent position
					position:
						labelInstance.options.connectorTarget?.toArray() || labelInstance.container.position.toArray(),
					text: labelInstance.text,
					options: labelInstance.options,
				});
			});
			console.log(`[FloatingLabels] Notifying update with ${allCurrentLabelsData.length} labels.`);
			try {
				this.callbacks.onLabelsUpdate(allCurrentLabelsData);
			} catch (e) {
				console.error("[FloatingLabels] Error executing onLabelsUpdate callback:", e);
			}
		}
	}

	setupClickHandler() {
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		this.clickHandler = (event) => {
			if (!this.editMode) return;

			const rect = this.viewer.renderer.domElement.getBoundingClientRect();
			this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			this.raycaster.setFromCamera(this.mouse, this.camera);

			const labelObjects = [];
			this.labels.forEach((label, id) => {
				if (label.background) {
					labelObjects.push({ id, object: label.background });
				}
			});

			const intersects = this.raycaster.intersectObjects(labelObjects.map((item) => item.object));

			if (intersects.length > 0) {
				const clickedObject = intersects[0].object;
				const labelInfo = labelObjects.find((item) => item.object === clickedObject);

				if (labelInfo) {
					this.selectLabel(labelInfo.id);
					this.showEditUI(labelInfo.id);
					event.stopPropagation();
					return;
				}
			}

			this.deselectLabel();
			this.hideEditUI();
		};

		this.viewer.renderer.domElement.addEventListener("click", this.clickHandler);
	}

	createEditUI() {
		// Create modal container
		this.editUI = document.createElement("div");
		this.editUI.className = "label-edit-ui";
		this.editUI.style.display = "none";
		this.editUI.style.position = "absolute";
		this.editUI.style.top = "50%";
		this.editUI.style.left = "50%";
		this.editUI.style.transform = "translate(-50%, -50%)";
		this.editUI.style.backgroundColor = "#2a2a2a";
		this.editUI.style.color = "white";
		this.editUI.style.padding = "20px";
		this.editUI.style.borderRadius = "8px";
		this.editUI.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.5)";
		this.editUI.style.zIndex = "1000";
		this.editUI.style.minWidth = "370px";
		this.editUI.style.fontFamily = "Arial, sans-serif";

		// Create UI content
		this.editUI.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px;" id="label-modal-title">Edit Label</h3>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Text:</label>
                <input type="text" id="label-text-input" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Background Color:</label>
                    <input type="color" id="label-bg-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Text Color:</label>
                    <input type="color" id="label-text-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Width:</label>
                    <input type="number" id="label-width" min="0.5" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Height:</label>
                    <input type="number" id="label-height" min="0.3" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Connector:</label>
                <input type="checkbox" id="label-connector" checked style="margin-right: 5px;">
                <label for="label-connector">Show connector</label>
            </div>
			<div style="margin-bottom: 15px;">
				<label style="display: block; margin-bottom: 5px;">Anchor Point Coordinates:</label>
				<div style="display: flex; gap: 10px;">
					<div style="flex: 1;">
						<label style="display: block; margin-bottom: 5px;">X:</label>
						<input type="number" id="anchor-x" step="0.01" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
					</div>
					<div style="flex: 1;">
						<label style="display: block; margin-bottom: 5px;">Y:</label>
						<input type="number" id="anchor-y" step="0.01" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
					</div>
					<div style="flex: 1;">
						<label style="display: block; margin-bottom: 5px;">Z:</label>
						<input type="number" id="anchor-z" step="0.01" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
					</div>
				</div>
			</div>
            <div id="connector-options" style="margin-bottom: 15px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">Position:</label>
                    <select id="connector-position" style="width: 100%; padding: 8px; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                        <option value="bottom">Below Target</option>
                        <option value="top">Above Target</option>
                        <option value="left">Visually Right of Target</option> <!-- Changed Label -->
                        <option value="right">Visually Left of Target</option> <!-- Changed Label -->
                    </select>
                </div>
                <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px;">Width (px):</label>
                        <input type="number" id="connector-width" min="1" max="10" step="1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px;">Length:</label>
                        <input type="number" id="connector-length" min="0.1" step="0.1" style="width: 100%; padding: 8px; box-sizing: border-box; background: #3a3a3a; color: white; border: 1px solid #555; border-radius: 4px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px;">Color:</label>
                    <input type="color" id="connector-color" style="width: 100%; height: 30px; background: #3a3a3a; border: 1px solid #555; border-radius: 4px;">
                </div>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <button id="label-delete-btn" style="padding: 8px 15px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                <div>
                    <button id="label-cancel-btn" style="padding: 8px 15px; margin-right: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="label-save-btn" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                </div>
            </div>
        `;

		document.body.appendChild(this.editUI);

		document.getElementById("label-connector").addEventListener("change", (e) => {
			document.getElementById("connector-options").style.display = e.target.checked ? "block" : "none";
		});
		document.getElementById("label-cancel-btn").addEventListener("click", () => this.hideEditUI());
		document.getElementById("label-save-btn").addEventListener("click", () => this.saveEditUIData());
		document.getElementById("label-delete-btn").addEventListener("click", () => {
			if (this.selectedLabelId) {
				this.removeLabel(this.selectedLabelId);
				this.hideEditUI();
			}
		});
		this.editUI.addEventListener("click", (event) => event.stopPropagation());
	}

	showEditUI(labelId = null) {
		this.selectedLabelId = labelId;
		const isCreating = !labelId;
		document.getElementById("label-modal-title").textContent = isCreating ? "Create Label" : "Edit Label";
		document.getElementById("label-delete-btn").style.display = isCreating ? "none" : "block";

		if (isCreating) {
			document.getElementById("label-text-input").value = "New Label";
			document.getElementById("label-bg-color").value = "#333333";
			document.getElementById("label-text-color").value = "#ffffff";
			document.getElementById("label-width").value = "1.5";
			document.getElementById("label-height").value = "0.4";
			document.getElementById("label-connector").checked = true;
			document.getElementById("connector-position").value = "top";
			document.getElementById("connector-width").value = "2";
			document.getElementById("connector-length").value = "0.5";
			document.getElementById("connector-color").value = "#ffffff";
			document.getElementById("anchor-x").value = this.pendingCursorPosition?.x.toFixed(2) || "0.00";
			document.getElementById("anchor-y").value = this.pendingCursorPosition?.y.toFixed(2) || "0.00";
			document.getElementById("anchor-z").value = this.pendingCursorPosition?.z.toFixed(2) || "0.00";
		} else {
			const label = this.labels.get(labelId);
			if (!label) return;
			const options = label.options || {};
			const currentTargetPos = options.connectorTarget || label.container.position;
			document.getElementById("label-text-input").value = label.text || "";
			document.getElementById("label-bg-color").value = this.colorToHex(options.backgroundColor || "#333333");
			document.getElementById("label-text-color").value = this.colorToHex(options.textColor || "#ffffff");
			document.getElementById("label-width").value = options.width || "1.5";
			document.getElementById("label-height").value = options.height || "0.4";
			document.getElementById("label-connector").checked = options.showConnector !== false;
			document.getElementById("connector-position").value = options.connectorPosition || "top";
			document.getElementById("connector-width").value = options.connectorWidth || "2";
			document.getElementById("connector-length").value = options.connectorLength || "0.5";
			document.getElementById("connector-color").value = this.colorToHex(options.connectorColor || "#ffffff");
			document.getElementById("anchor-x").value = currentTargetPos.x.toFixed(2);
			document.getElementById("anchor-y").value = currentTargetPos.y.toFixed(2);
			document.getElementById("anchor-z").value = currentTargetPos.z.toFixed(2);
		}

		document.getElementById("connector-options").style.display = document.getElementById("label-connector")
			.checked
			? "block"
			: "none";
		this.editUI.style.display = "block";

		if (this.callbacks.onModalOpen) this.callbacks.onModalOpen();

		const textInput = document.getElementById("label-text-input");
		textInput.focus();
		textInput.select();
	}

	colorToHex(color) {
		if (typeof color === "string" && color.startsWith("#")) {
			return color;
		}
		if (color instanceof THREE.Color) {
			return "#" + color.getHexString();
		}
		const tempDiv = document.createElement("div");
		tempDiv.style.color = color;
		document.body.appendChild(tempDiv);
		const computedColor = window.getComputedStyle(tempDiv).color;
		document.body.removeChild(tempDiv);
		const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (match) {
			const r = parseInt(match[1]).toString(16).padStart(2, "0");
			const g = parseInt(match[2]).toString(16).padStart(2, "0");
			const b = parseInt(match[3]).toString(16).padStart(2, "0");
			return `#${r}${g}${b}`;
		}
		return "#333333"; // Default fallback
	}

	hideEditUI(calledAfterSave = false) {
		if (this.editUI.style.display !== "none") {
			this.editUI.style.display = "none";
			this.deselectLabel(calledAfterSave);
			if (this.callbacks.onModalClose) {
				this.callbacks.onModalClose();
			}
		}
	}

	saveEditUIData() {
		const text = document.getElementById("label-text-input").value;
		const currentOptions = {
			backgroundColor: document.getElementById("label-bg-color").value,
			textColor: document.getElementById("label-text-color").value,
			width: parseFloat(document.getElementById("label-width").value) || 1.5,
			height: parseFloat(document.getElementById("label-height").value) || 0.4,
			showConnector: document.getElementById("label-connector").checked,
			connectorPosition: document.getElementById("connector-position").value,
			connectorWidth: parseFloat(document.getElementById("connector-width").value) || 2,
			connectorLength: parseFloat(document.getElementById("connector-length").value) || 0.5,
			connectorColor: document.getElementById("connector-color").value,
		};

		let changed = false;

		const anchorX = parseFloat(document.getElementById("anchor-x").value) || 0;
		const anchorY = parseFloat(document.getElementById("anchor-y").value) || 0;
		const anchorZ = parseFloat(document.getElementById("anchor-z").value) || 0;

		console.log(`[saveEditUIData] Form values: X=${anchorX}, Y=${anchorY}, Z=${anchorZ}`);

		const newAnchorPos = new THREE.Vector3(anchorX, anchorY, anchorZ);

		if (this.selectedLabelId) {
			const label = this.labels.get(this.selectedLabelId);
			if (label) {
				const oldOptions = label.options || {};
				const appearanceChanged =
					currentOptions.width !== oldOptions.width ||
					currentOptions.height !== oldOptions.height ||
					currentOptions.backgroundColor !== oldOptions.backgroundColor ||
					currentOptions.opacity !== oldOptions.opacity ||
					currentOptions.showConnector !== oldOptions.showConnector ||
					currentOptions.connectorPosition !== oldOptions.connectorPosition ||
					currentOptions.connectorWidth !== oldOptions.connectorWidth ||
					currentOptions.connectorLength !== oldOptions.connectorLength ||
					currentOptions.connectorColor !== oldOptions.connectorColor ||
					currentOptions.textColor !== oldOptions.textColor ||
					currentOptions.font !== oldOptions.font;

				const textChanged = text !== label.text;

				const currentPos = label.options.connectorTarget || label.container.position;
				const anchorChanged = !currentPos.equals(newAnchorPos);

				if (anchorChanged) {
					// Update container position to new anchor
					label.container.position.copy(newAnchorPos);

					// Update stored target in options
					currentOptions.connectorTarget = newAnchorPos.clone();

					changed = true;
				} else {
					// Only if NOT changed, preserve the existing target position
					currentOptions.connectorTarget =
						label.options.connectorTarget?.clone() || label.container.position.clone();
				}

				this.updateLabelText(this.selectedLabelId, text, currentOptions, appearanceChanged || textChanged);

				delete label.originalColor; // Clear selection highlight tracker
				delete label.originalOpacity;
				changed = true;
			}
		} else if (this.pendingCursorPosition) {
			const id = `label-${Date.now()}`;
			currentOptions.connectorTarget = newAnchorPos.clone();
			this.addLabel(id, newAnchorPos, text, currentOptions);
			changed = false;
			this.pendingCursorPosition = null;
		}

		if (this.selectedLabelId && changed) {
			// Only notify if an existing label was changed and saved
			this._notifyUpdate();
		}

		this.hideEditUI(true); // Pass true to keep saved color if needed
	}

	toggleEditMode() {
		this.editMode = !this.editMode;
		console.log(`[toggleEditMode] Set editMode to: ${this.editMode}`);

		this.labels.forEach((label, id) => {
			if (label.background && label.background.material) {
				if (this.editMode) {
					if (label.originalColor === undefined) {
						// Store current OPTIONS color/opacity
						label.originalColor = this.colorToHex(label.options.backgroundColor);
						label.originalOpacity = label.options.opacity;
						console.log(`[toggleEditMode ON] Stored original color: ${label.originalColor} for ${id}`);
					}
					// Set edit mode style (purple)
					label.background.material.color.setHex(0x9966ff);
					label.background.material.opacity = 0.9;
					console.log(`[toggleEditMode ON] Set edit mode purple for ${id}`);
				} else {
					// --- Turning Edit Mode OFF ---
					// Restore directly from the label's SAVED options
					const optionsColor = this.colorToHex(label.options.backgroundColor);
					const optionsOpacity = label.options.opacity;
					label.background.material.color.set(optionsColor);
					label.background.material.opacity = optionsOpacity;
					console.log(`[toggleEditMode OFF] Restored color from options: ${optionsColor} for ${id}`);

					// Clear the stored original state now that edit mode is off
					delete label.originalColor;
					delete label.originalOpacity;
				}
			} else {
				console.warn(`[toggleEditMode] Label ${id} missing background or material.`);
			}
		});

		if (!this.editMode) {
			this.deselectLabel(false); // Deselect will restore from options
			this.hideEditUI(false);
		}
		return this.editMode;
	}

	selectLabel(id) {
		if (!this.editMode) return;

		this.deselectLabel(); // Deselect previous

		this.selectedLabelId = id;
		const label = this.labels.get(id);

		if (label && label.background) {
			// Store the color IT CURRENTLY HAS (which should be edit purple)
			// if switching selection within edit mode.
			if (label.originalColor === undefined) {
				label.originalColor = label.background.material.color.getHexString(); // Get current hex
				label.originalColor = "#" + label.originalColor; // Add hash if missing
				label.originalOpacity = label.background.material.opacity;
			}
			// Highlight selected label (orange)
			label.background.material.color.setHex(0xffaa55);
			label.background.material.opacity = 0.95;
		}
	}

	deselectLabel(keepSavedColor = false) {
		if (this.selectedLabelId) {
			const label = this.labels.get(this.selectedLabelId);
			if (label && label.background && label.background.material) {
				console.log(
					`[deselectLabel] EditMode: ${this.editMode}, KeepSaved: ${keepSavedColor}, LabelID: ${this.selectedLabelId}`,
				);

				if (!this.editMode) {
					// Exiting edit mode entirely: Restore from SAVED OPTIONS
					const optionsColor = this.colorToHex(label.options.backgroundColor);
					label.background.material.color.set(optionsColor);
					label.background.material.opacity = label.options.opacity;
					console.log(`[deselectLabel] Exiting edit mode. Restored color from options: ${optionsColor}`);
					delete label.originalColor; // Clear tracker
					delete label.originalOpacity;
				} else {
					// Still in edit mode, just deselecting this one
					if (!keepSavedColor && label.originalColor !== undefined) {
						// Restore to standard edit mode color (purple), NOT the saved options color
						label.background.material.color.setHex(0x9966ff);
						label.background.material.opacity = 0.9;
						console.log("[deselectLabel] Still edit mode. Set color to standard edit purple.");
					} else {
						// Keep the current color (likely orange selection or just saved options color)
						console.log(
							`[deselectLabel] Still edit mode. Keeping current color (keepSavedColor=${keepSavedColor}).`,
						);
					}
					// Don't delete originalColor here, as we might re-select it
				}
			}
			this.selectedLabelId = null;
		}
	}

	createLabelAtCursor() {
		if (!this.editMode || !this.viewer.showMeshCursor) return false;

		this.pendingCursorPosition = this.viewer.sceneHelper.meshCursor.position.clone();
		if (this.pendingCursorPosition.y < 0.1) {
			this.pendingCursorPosition.y = 0.1;
		}

		this.deselectLabel();
		this.showEditUI(null); // Show UI for creation

		return true;
	}

	addLabels(labelsData, notify = true) {
		if (!labelsData || !Array.isArray(labelsData)) return;
		let changed = false;
		labelsData.forEach((labelData) => {
			const added = this._addLabelInternal(
				labelData.id,
				labelData.position,
				labelData.text,
				labelData.options,
			);
			if (added) changed = true;
		});
		if (changed && notify) {
			this._notifyUpdate();
		}
	}

	addLabel(id, position, text, options = {}) {
		const label = this._addLabelInternal(id, position, text, options);
		if (label) {
			this._notifyUpdate(); // Notify after successful addition/replacement
		}
		return label;
	}

	_addLabelInternal(id, position, text, options = {}) {
		if (this.labels.has(id)) {
			this.removeLabel(id, false); // Remove existing without notifying yet
		}
		const targetPosition = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
		const finalOptions = { ...this.getDefaultLabelOptions(), ...options };

		// IMPORTANT: Ensure connectorTarget is set from the input position
		finalOptions.connectorTarget = targetPosition.clone();

		const label = this.createLabelObject(targetPosition, text, finalOptions);
		this.labels.set(id, label);
		this.labelsGroup.add(label.container);
		return label;
	}

	createLabelObject(targetPosition, text, options = {}) {
		// Options should already be merged with defaults here
		const container = new THREE.Group();
		container.position.copy(targetPosition); // Container is at the target/anchor point
		container.quaternion.copy(this.camera.quaternion); // Initial face camera

		const width = options.width;
		const height = options.height;

		// Calculate initial offset based on user's intended position
		const initialVisualOffset = this.calculateVisualOffset(options);
		options.calculatedVisualOffset = initialVisualOffset.clone(); // Store initial calculation for reference
		// connectorTarget is already set in options during add/update

		console.log(
			`[createLabelObject ${targetPosition
				.toArray()
				.map((p) => p.toFixed(2))}] TargetPos, Initial VisualOffset: ${initialVisualOffset
				.toArray()
				.map((p) => p.toFixed(2))}`,
		);

		// --- Create Visual Elements ---
		const background = this.createBackgroundMesh(width, height, options);
		background.position.copy(initialVisualOffset); // Position relative to container
		container.add(background);

		const textSprite = this.createTextSprite(text, options);
		textSprite.position.copy(initialVisualOffset); // Position relative to container
		container.add(textSprite);

		let connector = null;
		if (options.showConnector) {
			// Create connector using the initial offset
			connector = this.createConnector(initialVisualOffset, options);
			container.add(connector);
		}

		container.visible = options.visible;

		// --- Store state for dynamic positioning ---
		const labelInstance = {
			container,
			background,
			textSprite,
			connector,
			text,
			options, // Contains connectorTarget, calculatedVisualOffset etc.
			currentAppliedOffset: initialVisualOffset.clone(), // Track the offset currently applied visually
		};
		// ---

		console.log(
			`[createLabelObject] Final container settings. Visible: ${
				container.visible
			}, Position: ${container.position.toArray().map((p) => p.toFixed(2))}`,
		);

		return labelInstance; // Return the enhanced label instance
	}

	createBackgroundMesh(width, height, options) {
		const geometry = new THREE.PlaneGeometry(width, height);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(options.backgroundColor),
			transparent: true,
			opacity: options.opacity,
			side: THREE.DoubleSide,
			depthTest: true,
			depthWrite: true,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.renderOrder = options.renderOrderBackground; // Will be set via default options
		return mesh;
	}

	createTextSprite(text, options = {}) {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		const font = options.font;
		const textColor = options.textColor;
		const width = options.width; // Desired world width of the background
		const height = options.height; // Desired world height of the background
		const padding = options.padding || 10;

		// Increase resolution scale for sharper text
		const scale = 8; // Higher scale for better text clarity

		// Set font on context for text measurements
		context.font = font;

		// Handle multi-line text
		const lines = text ? text.split("\\n") : [""];

		// Calculate text dimensions
		let maxTextWidth = 0;
		lines.forEach((line) => {
			maxTextWidth = Math.max(maxTextWidth, context.measureText(line).width);
		});

		// Extract font size from the font string
		const fontSize = parseInt(font, 10) || 24;
		const estimatedLineHeight = fontSize * 1.2;
		const totalTextHeight = estimatedLineHeight * lines.length;

		// Calculate canvas dimensions with padding
		const canvasWidthPixels = Math.max(100, Math.ceil(maxTextWidth + padding * 2));
		const canvasHeightPixels = Math.max(50, Math.ceil(totalTextHeight + padding * 2));

		// Scale canvas for higher resolution
		canvas.width = canvasWidthPixels * scale;
		canvas.height = canvasHeightPixels * scale;

		// Clear and prepare canvas
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.scale(scale, scale);
		context.font = font;
		context.fillStyle = textColor;
		context.textAlign = "center";
		context.textBaseline = "middle";

		// Draw text centered in canvas
		const startX = canvasWidthPixels / 2;
		const startY = canvasHeightPixels / 2 - (totalTextHeight - estimatedLineHeight) / 2;

		lines.forEach((line, i) => {
			context.fillText(line, startX, startY + i * estimatedLineHeight);
		});

		// Create texture from canvas
		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.needsUpdate = true;

		// Create sprite material with the texture
		const spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: options.depthTest,
			sizeAttenuation: options.sizeAttenuation,
		});

		// Create the sprite
		const sprite = new THREE.Sprite(spriteMaterial);

		// Calculate aspect ratio to maintain text proportion
		const textureAspect = canvas.width / canvas.height;

		// Scale sprite to fit the background while maintaining aspect ratio
		// Use a consistent approach to avoid very small text
		let spriteWidth, spriteHeight;

		// Make text fill most of the background area with a small margin
		const margin = 0.05; // 5% margin
		spriteWidth = width * (1 - margin * 2);
		spriteHeight = spriteWidth / textureAspect;

		// If height exceeds background, constrain by height instead
		if (spriteHeight > height * (1 - margin * 2)) {
			spriteHeight = height * (1 - margin * 2);
			spriteWidth = spriteHeight * textureAspect;
		}

		// Apply calculated scale
		sprite.scale.set(spriteWidth, spriteHeight, 1);

		// Ensure sprite renders on top
		sprite.renderOrder = options.renderOrderText;

		return sprite;
	}

	// Helper to create connector line - uses the provided visualOffset
	createConnector(visualOffset, options = {}) {
		const lineWidth = options.connectorWidth;
		const color = new THREE.Color(options.connectorColor);
		// const width = options.width;
		// const height = options.height;
		// // Intended position helps determine which edge to connect FROM
		// const connectorPosition = options.connectorPosition;

		// Calculate start point based on the CURRENT visualOffset and intended position
		const startPoint = this.calculateConnectorStartPoint(visualOffset, options);
		const endPoint = new THREE.Vector3(0, 0, 0); // Target point (container origin)

		const geometry = new LineGeometry();
		geometry.setPositions([startPoint.x, startPoint.y, startPoint.z, endPoint.x, endPoint.y, endPoint.z]);

		const resolution = new THREE.Vector2();
		if (this.renderer) this.renderer.getDrawingBufferSize(resolution);
		else resolution.set(window.innerWidth, window.innerHeight);

		const material = new LineMaterial({
			color: color,
			linewidth: lineWidth * 0.005,
			worldUnits: true,
			resolution: resolution,
			transparent: true,
			opacity: options.opacity,
			dashed: false,
			depthTest: options.depthTest,
		});
		const connector = new Line2(geometry, material);
		connector.position.z = -0.01;
		connector.computeLineDistances();
		connector.renderOrder = options.renderOrderConnector;

		return connector;
	}

	// --- NEW HELPER: Calculate connector start based on offset and intended position ---
	calculateConnectorStartPoint(visualOffset, options) {
		const startPoint = visualOffset.clone();
		const width = options.width;
		const height = options.height;
		// Use the INTENDED position to determine which edge of the label box to connect FROM.
		// This ensures the connector starts correctly even if the visualOffset is flipped.
		switch (options.connectorPosition) {
			case "top": // Label is intended to be above target -> Connect TO label's bottom edge
				startPoint.y -= height / 2;
				break;
			case "bottom": // Label is intended to be below target -> Connect TO label's top edge
				startPoint.y += height / 2;
				break;
			case "left": // Label is intended to be visually right of target -> Connect TO label's left edge
				startPoint.x -= width / 2;
				break;
			case "right": // Label is intended to be visually left of target -> Connect TO label's right edge
				startPoint.x += width / 2;
				break;
			default: // Fallback
				startPoint.y -= height / 2; // Default to bottom edge
				break;
		}
		return startPoint;
	}
	// ---

	// --- Update and Removal ---

	updateLabelText(id, newText, newOptions = {}, forceFullRedraw = false) {
		const label = this.labels.get(id);
		if (!label) return;

		const oldOptions = { ...label.options };
		label.text = newText;
		// Merge options: Start with defaults, layer old, layer new
		const mergedOptions = {
			...this.getDefaultLabelOptions(),
			...oldOptions, // Include potentially existing connectorTarget etc.
			...newOptions, // Overwrite with changes from UI
		};
		label.options = mergedOptions; // Store final merged options

		const appearanceChanged =
			forceFullRedraw ||
			mergedOptions.width !== oldOptions.width ||
			mergedOptions.height !== oldOptions.height ||
			mergedOptions.backgroundColor !== oldOptions.backgroundColor ||
			mergedOptions.opacity !== oldOptions.opacity ||
			mergedOptions.showConnector !== oldOptions.showConnector ||
			mergedOptions.connectorPosition !== oldOptions.connectorPosition ||
			mergedOptions.connectorWidth !== oldOptions.connectorWidth ||
			mergedOptions.connectorLength !== oldOptions.connectorLength ||
			mergedOptions.connectorColor !== oldOptions.connectorColor ||
			mergedOptions.textColor !== oldOptions.textColor ||
			mergedOptions.font !== oldOptions.font ||
			mergedOptions.offset !== oldOptions.offset; // Check explicit offset change

		if (appearanceChanged) {
			console.log(`[updateLabelText - ${id}] Appearance changed, full redraw.`);
			this.cleanupLabelElements(label);

			// Recalculate the initial visual offset based on potentially changed options
			const newInitialVisualOffset = this.calculateVisualOffset(mergedOptions);
			mergedOptions.calculatedVisualOffset = newInitialVisualOffset.clone(); // Update stored initial calculation
			label.options.calculatedVisualOffset = newInitialVisualOffset.clone(); // Also update on label object

			// --- IMPORTANT: Reset currentAppliedOffset to the new initial calculation ---
			label.currentAppliedOffset = newInitialVisualOffset.clone();
			// ---

			// Create elements using the NEW initial offset
			label.background = this.createBackgroundMesh(mergedOptions.width, mergedOptions.height, mergedOptions);
			label.background.position.copy(newInitialVisualOffset);
			label.container.add(label.background);

			label.textSprite = this.createTextSprite(newText, mergedOptions);
			label.textSprite.position.copy(newInitialVisualOffset);
			label.container.add(label.textSprite);

			if (mergedOptions.showConnector) {
				label.connector = this.createConnector(newInitialVisualOffset, mergedOptions); // Create with new initial offset
				label.container.add(label.connector);
			}

			// Ensure visibility
			if (label.background) label.background.visible = true;
			if (label.textSprite) label.textSprite.visible = true;
			if (label.connector) label.connector.visible = true;
		} else {
			// Only text or non-appearance options changed
			console.log(`[updateLabelText - ${id}] Only text/minor options changed.`);
			// Update text sprite using the CURRENTLY APPLIED offset
			if (label.textSprite) {
				label.container.remove(label.textSprite);
				label.textSprite.material.map?.dispose();
				label.textSprite.material.dispose();
				label.textSprite = null;
			}
			label.textSprite = this.createTextSprite(newText, mergedOptions);
			// Position using the offset that's currently visually correct
			label.textSprite.position.copy(label.currentAppliedOffset);
			label.textSprite.visible = true;
			label.container.add(label.textSprite);
		}
		console.log(`[updateLabelText - ${id}] Update finished. Sprite:`, label.textSprite);
	}

	getDefaultLabelOptions() {
		return {
			width: 1.5,
			height: 0.4,
			backgroundColor: "#333333",
			textColor: "#ffffff",
			opacity: 0.8,
			showConnector: true,
			connectorPosition: "top", // 'top', 'bottom', 'left', 'right'
			connectorWidth: 2, // Line width in pixels
			connectorLength: 0.5, // World units length
			connectorColor: "#ffffff",
			font: "Bold 24px Arial",
			padding: 10, // Pixels for text canvas
			depthTest: true, // Ensure depth testing is enabled
			sizeAttenuation: true, // For text sprite
			visible: true,
			renderOrderBackground: 1, // Background in front
			renderOrderText: 2, // Text on top
			renderOrderConnector: 0, //
			calculatedVisualOffset: new THREE.Vector3(),
			connectorTarget: new THREE.Vector3(),
			// fadeWithDistance: false,
			// fadeStartDistance: 10,
			// fadeEndDistance: 30,
			// offset: null,
		};
	}

	// Helper to calculate the VISUAL offset based on options
	// This determines where the label box sits relative to the target anchor point
	calculateVisualOffset(options) {
		const width = options.width;
		const height = options.height;
		const connectorLength = options.showConnector ? options.connectorLength : 0;
		// Use the INTENDED position from options for calculation
		const connectorPosition = options.connectorPosition;
		const visualOffset = new THREE.Vector3();

		if (options.showConnector) {
			switch (connectorPosition) {
				case "top": // Label appears ABOVE target
					visualOffset.y = height / 2 + connectorLength;
					break;
				case "left": // Label appears VISUALLY RIGHT of target
					visualOffset.x = width / 2 + connectorLength;
					break;
				case "right": // Label appears VISUALLY LEFT of target
					visualOffset.x = -(width / 2 + connectorLength);
					break;
				case "bottom": // Label appears BELOW target
				default:
					visualOffset.y = -(height / 2 + connectorLength);
					break;
			}
		} else {
			// Default placement slightly above if no connector
			visualOffset.y = height / 2 + 0.1;
		}
		if (options.offset) {
			const explicitOffset = Array.isArray(options.offset)
				? new THREE.Vector3(...options.offset)
				: options.offset;
			visualOffset.add(explicitOffset);
		}
		return visualOffset;
	}

	cleanupLabelElements(label) {
		if (label.textSprite) {
			if (label.textSprite.parent) label.textSprite.parent.remove(label.textSprite);
			label.textSprite.material.map?.dispose();
			label.textSprite.material.dispose();
			label.textSprite = null;
		}
		if (label.background) {
			if (label.background.parent) label.background.parent.remove(label.background);
			label.background.material.dispose();
			label.background.geometry.dispose();
			label.background = null;
		}
		if (label.connector) {
			if (label.connector.parent) label.connector.parent.remove(label.connector);
			label.connector.material.dispose();
			label.connector.geometry.dispose();
			label.connector = null;
		}
	}

	removeLabel(id, notify = true) {
		const label = this.labels.get(id);
		if (!label) return;

		this.cleanupLabelElements(label);
		if (label.container?.parent) label.container.parent.remove(label.container);
		const deleted = this.labels.delete(id);

		if (deleted && notify) {
			this._notifyUpdate();
		}
	}

	clearAllLabels(notify = true) {
		const hadLabels = this.labels.size > 0;
		const labelIds = Array.from(this.labels.keys());
		for (const id of labelIds) {
			this.removeLabel(id, false);
		}
		if (hadLabels && notify) {
			this._notifyUpdate();
		}
	}

	setLabelVisibility(id, visible) {
		const label = this.labels.get(id);
		if (label && label.container) {
			label.container.visible = visible;
			label.options.visible = visible; // Store visibility state
		}
	}

	updateLabelPosition(id, newPosition) {
		const label = this.labels.get(id);
		if (!label || !label.container) return;

		const finalPosition = Array.isArray(newPosition)
			? new THREE.Vector3(...newPosition)
			: newPosition.clone();
		label.container.position.copy(finalPosition); // Update container position
		// Update stored target position in options
		if (label.options) {
			label.options.connectorTarget = finalPosition.clone();
		}
		// No need to notify here, position changes are usually frequent during drag/update
		// Notify should happen when the final position is saved/set.
	}

	// Add this method to properly update the connector start point when flipping
	updateConnectorStartPoint(label, targetVisualOffset, needsFlip) {
		if (!label.connector || !label.options.showConnector) return;

		// Get the current options
		const options = { ...label.options };

		// If we're flipping, we need to use the opposite connector position for calculations
		if (needsFlip) {
			// Temporarily swap the connector position for calculation
			const originalPosition = options.connectorPosition;
			options.connectorPosition =
				originalPosition === "left" ? "right" : originalPosition === "right" ? "left" : originalPosition;

			// Calculate the correct start point based on flipped position
			const newStartPoint = this.calculateConnectorStartPoint(targetVisualOffset, options);

			// Restore original position in options
			options.connectorPosition = originalPosition;

			// Update connector with new start point
			const endPoint = new THREE.Vector3(0, 0, 0);
			if (label.connector.geometry.setPositions) {
				label.connector.geometry.setPositions([
					newStartPoint.x,
					newStartPoint.y,
					newStartPoint.z,
					endPoint.x,
					endPoint.y,
					endPoint.z,
				]);
				label.connector.computeLineDistances();
			}
		} else {
			// Normal case - use standard calculation
			const newStartPoint = this.calculateConnectorStartPoint(targetVisualOffset, options);
			const endPoint = new THREE.Vector3(0, 0, 0);
			if (label.connector.geometry.setPositions) {
				label.connector.geometry.setPositions([
					newStartPoint.x,
					newStartPoint.y,
					newStartPoint.z,
					endPoint.x,
					endPoint.y,
					endPoint.z,
				]);
				label.connector.computeLineDistances();
			}
		}
	}

	update() {
		if (!this.camera || this.labels.size === 0) return;

		const cameraQuaternion = this.camera.quaternion;
		const cameraPosition = this.camera.position;
		this.camera.updateMatrixWorld();
		this._cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();

		this.labels.forEach((label) => {
			if (!label.container || !label.options) return;

			// 1. Billboard
			label.container.quaternion.copy(cameraQuaternion);

			// 2. Dynamic Positioning Check for Left/Right
			let targetVisualOffset = label.options.calculatedVisualOffset.clone();
			const intendedPosition = label.options.connectorPosition;
			let needsFlip = false; // Track if a flip happened

			if (label.options.showConnector && (intendedPosition === "left" || intendedPosition === "right")) {
				// ... (logic to determine needsFlip and calculate targetVisualOffset) ...
				const camToLabelDir = this._tempVec3
					.copy(label.options.connectorTarget)
					.sub(cameraPosition)
					.normalize();
				const screenRight = this._cameraRight.clone().projectOnPlane(camToLabelDir).normalize();
				const intendedOffset = this.calculateVisualOffset(label.options);
				const dot = intendedOffset.dot(screenRight);
				if ((intendedPosition === "left" && dot < 0) || (intendedPosition === "right" && dot > 0)) {
					needsFlip = true;
					const flippedSide = intendedPosition === "left" ? "right" : "left";
					targetVisualOffset = this.calculateVisualOffset({
						...label.options,
						connectorPosition: flippedSide,
					});
				}
			}

			// 3. Apply the potentially updated offset IF it changed
			if (!label.currentAppliedOffset.equals(targetVisualOffset)) {
				// Apply offset to background/textsprite positions
				if (label.background) label.background.position.copy(targetVisualOffset);
				if (label.textSprite) label.textSprite.position.copy(targetVisualOffset);

				// Call our new method to update connector start point properly
				this.updateConnectorStartPoint(label, targetVisualOffset, needsFlip);

				label.currentAppliedOffset.copy(targetVisualOffset);
			}

			if (label.background) {
				// Move all elements forward in the flipped case
				const zBase = needsFlip ? 0.01 : 0;

				// Set appropriate z-offsets with larger gaps between elements
				if (label.connector) {
					// Always put connector furthest back
					label.connector.position.z = zBase - 0.005;
				}

				// Background in the middle
				label.background.position.z = zBase;

				// Text sprite always in front
				if (label.textSprite) {
					label.textSprite.position.z = zBase + 0.005;
				}
			}
			// --- REMOVED Connector Z adjustment ---

			// --- 5. Optional: Distance-based effects & FINAL VISIBILITY ---
			// ... (visibility logic remains the same, using label.options.showConnector) ...
			let finalContainerVisible = label.options.visible;
			let finalConnectorVisible = label.options.showConnector && label.options.visible;
			// ... (fade logic) ...
			// Apply final visibility
			label.container.visible = finalContainerVisible;
			if (label.connector) {
				label.connector.visible = finalConnectorVisible;
			}

			// --- 6. Update LineMaterial Resolution ---
			if (label.connector?.material instanceof LineMaterial) {
				const resolution = this._tempVec3; // Reuse temp vector
				if (this.renderer) this.renderer.getDrawingBufferSize(resolution);
				else resolution.set(window.innerWidth, window.innerHeight);

				if (!label.connector.material.resolution.equals(resolution)) {
					label.connector.material.resolution.copy(resolution);
				}
			}
			// --- End LineMaterial Update ---
		}); // End labels.forEach loop
	} // End update() function

	setupViewerIntegration() {
		if (this.viewer?.update) {
			const originalUpdate = this.viewer.update.bind(this.viewer);
			const self = this;
			this.viewer.update = function (...args) {
				originalUpdate(...args);
				self.update(); // Call labels update after viewer update
			};
			console.log("FloatingLabels integrated into viewer update loop.");
		} else {
			console.warn("Viewer update loop not found for FloatingLabels integration.");
			// Fallback: manual update loop if needed
			// const animate = () => {
			// 	requestAnimationFrame(animate);
			// 	this.update();
			// };
			// animate();
		}
	}

	show() {
		this.labelsGroup.visible = true;
	}

	hide() {
		this.labelsGroup.visible = false;
	}

	dispose() {
		this.hideEditUI();
		if (this.editUI?.parentNode) {
			document.body.removeChild(this.editUI);
			this.editUI = null;
		}
		if (this.viewer?.renderer?.domElement && this.clickHandler) {
			this.viewer.renderer.domElement.removeEventListener("click", this.clickHandler);
		}
		this.clickHandler = null;
		this.clearAllLabels(false); // Clear without final notification
		if (this.labelsGroup?.parent) this.labelsGroup.parent.remove(this.labelsGroup);
		this.labelsGroup = null;
		this.labels.clear();

		// TODO: If viewer integration modified the original update, restore it here if possible/necessary

		this.viewer = null;
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.callbacks = {};
	}
}
