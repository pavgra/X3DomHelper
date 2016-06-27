/*!
 * X3DomHelper v0.1.0
 * Author - Pavel Grafkin
 * Affiliated - Fraunhofer IGD
 */

//
// Constructor
//

/**
 * @namespace
 * @param {String} domId ID of x3dom element
 */
function X3DomHelper(domId) {
	this.dom = document.getElementById(domId);
	this.runtime = this.dom.runtime;

	// Signals whether all external models are loaded and rendered
	this.inlineLoaded = new Promise(resolve => {
		var inlineList = this.dom.querySelectorAll('inline'),
			loadedCnt = 0;

		if (inlineList.length == 0)
			resolve();

		inlineList.forEach(
			el => el.addEventListener('load', () => {
				if (++loadedCnt >= inlineList.length) resolve();
			})
		);
	});
}

//
// Helpers
//

/**
* Helper. Converts degree to radian
* 
* @param {Number} deg - From -90 to -90°
* @return {Number}
*/

if (typeof getRadian === 'undefined') {
	function getRadian(deg)
	{
	   return Math.PI * deg / 180;
	}
} else console.warn('Function "getRadian" is already defined');

/**
 * Helper. Converts radians to degree
 * 
 * @param  {Number} rad Radians
 * @return {Number}
 */
if (typeof getDegree === 'undefined') {
	function getDegree(rad) {
		return rad * 180 / Math.PI;
	}
} else console.warn('Function "getDegree" is already defined');

/**
 * Helper. Converts HEX color line to internal x3dom color line
 * 
 * @param  {String} hex HEX color line
 * @return {String}
 */
if (typeof hexToRgbLine === 'undefined') {
	function hexToRgbLine(hex) {
		var parts = hex.match(/.{1,2}/g),
			r = parseInt(parts[0], 16) / 255,
			g = parseInt(parts[1], 16) / 255,
			b = parseInt(parts[2], 16) / 255;

		return [r, g, b].join(' ');
	}
} else console.warn('Function "hexToRgbLine" is already defined');

//
// Static variables
//

X3DomHelper.X_AXIS = 'x';
X3DomHelper.Y_AXIS = 'y';

//
// Static methods
//

/**
 * Toggles element's visiblity.
 * @param {DOMNode} el Element to toggle
 * @param {bool} state State to set. True - visible, False - hidden.
 */
X3DomHelper.toggleElement = function(el, state) {
	el.setAttribute('render', state);
}

/**
 * Hides element.
 * @param {DOMNode} el Element to hide
 */
X3DomHelper.hideElement = function(el) {
	X3DomHelper.toggleElement(el, false);
}

/**
 * Shows element.
 * @param {DOMNode} el Element to show
 */
X3DomHelper.showElement = function(el) {
	X3DomHelper.toggleElement(el, true);
}

/**
 * Recolors shape element.
 * 
 * @param  {DOMNode} el Element to highlight
 * @param {String} [color = FF0000] Color to use
 */
X3DomHelper.highlightShape = function(el, color = 'FF0000') {
	var appearance = el.querySelector('appearance'),
		rgb = hexToRgbLine(color);
	// Save original <appearance> tag contents
	if (!el.origAppearance)
		el.origAppearance = appearance.outerHTML;
	// Recolor element
	appearance.outerHTML = '<Appearance><Material diffuseColor="' + rgb + '"></Material></Appearance>';
}

/**
 * Restores original shape color after recoloring with X3DomHelper.highlightShape.
 * 
 * @param  {DOMNode} el Element to highlight
 */
X3DomHelper.restoreShapeColor = function(el) {
	var appearance = el.querySelector('appearance');
	// Return back original color
	appearance.outerHTML = el.origAppearance;
	el.origAppearance = null;
}

//
// Prototype
//

X3DomHelper.prototype = {
	/**
	 * Get objects required for camera manipulation.
	 * 
	 * @return {object}
	 */
	_getCameraMeta: function() {
		return {
			canvas: this.runtime.canvas,
			viewpoint: this.runtime.viewpoint(),
			 // Current matrix. Initial matrix can be retrieved via viewpoint.getViewMatrix()
			matrix: this.runtime.viewMatrix()
		};
	},

	/**
	 * Updates viewpoint to new matrix. Either instantly or with animation.
	 * 
	 * @param {x3dom.fields.SFMatrix4f} matrix
	 * @param {boolean} animate Use animation?
	 * @param {Number} duration Duration of animation in milliseconds
	 */
	_updateViewpoint: function(matrix, animate, duration) {
		var camera = this._getCameraMeta();

		if (animate)
			camera.canvas.doc._viewarea.animateTo(matrix, camera.viewpoint, duration / 1000);
		else
			camera.viewpoint.setView(matrix);

		// Rendering update
		camera.canvas.doc.needRender = true;
	},

	/** 
	 * Adds event listener to child elements of external model used via "inline" tag.
	 * NOTE:
	 * "No page-wide onclick events are thrown".
	 * Source: http://doc.x3dom.org/tutorials/animationInteraction/picking/index.html
	 * 
	 * @param {string} event
	 * @param {function} callback
	 * @param {string} [inlineSelector=inline]
	 * @param {string} [targetSelector=shape]
	 */
	addInlineListener: function(event, callback, inlineSelector = 'inline', targetSelector = 'shape') {
		this.inlineLoaded.then(() => {
			var inline = this.dom.querySelector(inlineSelector);
			inline.querySelectorAll(targetSelector).forEach(el => el.addEventListener(event, callback));
		});
	},

	/** 
	 * Resets camera position to initially defined in "Viewpoint" tag.
	 */
	resetView: function() {
		this.runtime.resetView();
	},

	/**
	 * Rotates the scene by a certain angle over X- or Y-axis.
	 * @param {String} axis Axis of rotation (x or y)
	 * @param {Number} angle Angle for rotation in degrees
	 * @param {boolean} [animate = true] Use animation?
	 * @param {Number} [duration = 400] Duration of animation in milliseconds
	 */
	rotate: function(axis, angle, animate = true, duration = 400) {
		var camera = this._getCameraMeta(),
			rotationMatrix,
			newMatrix;

		// Covert degrees to radians
		angle = getRadian(angle);

		// Get rotation matrix
		if (axis === X3DomHelper.X_AXIS) {
			rotationMatrix = x3dom.fields.SFMatrix4f.rotationX(angle);
		}
		else if (axis === X3DomHelper.Y_AXIS) {
			rotationMatrix = x3dom.fields.SFMatrix4f.rotationY(angle);
		}
		else {
			throw new RangeError('Axis "' + axis + '" is not supported!');
		}

		// Calculate resulting matrix
		newMatrix = camera.matrix.mult(rotationMatrix);

		// Update viewpoint via setting new matrix
		this._updateViewpoint(newMatrix, animate, duration);
	},

	/**
	 * Produces full 360-degree rotation of model around Y-axis. 
	 * 
	 * @param  {Number} duration Duration of animation in milliseconds
	 */
	rotateRoundY: function(duration = 4000) {
		var halfTime = duration / 2;
		this.rotate(X3DomHelper.Y_AXIS, 180, true, halfTime);
		setTimeout(
			() => this.rotate(X3DomHelper.Y_AXIS, 180, true, halfTime),
			halfTime
		);
	},

	/**
	 * Rotates model over X axis.
	 * @param  {Number} angle Angle for rotation
	 */
	rotateX: function(angle) {
		this.rotate(X3DomHelper.X_AXIS, angle);
	},

	/**
	 * Rotates model over Y axis.
	 * @param  {Number} angle Angle for rotation
	 */
	rotateY: function(angle) {
		this.rotate(X3DomHelper.Y_AXIS, angle);
	},

	/**
	 * Sets background color.
	 * @param {string} color Color to use
	 */
	setSkyColorRGB: function(color) {
		var rgb = hexToRgbLine(color);
		this.dom.querySelector('background').setAttribute('skycolor', rgb);
	},

	/**
	 * Zooms in/out the 3D scene.
	 * @param {Number} zoomValue Value to be zoomed. Negative - zoom out, positive - zoom in.
	 * @param {boolean} [animate = true] Use animation?
	 * @param {Number} [duration = 400] Duration of animation in milliseconds
	 */
	zoom: function(zoomValue = 2, animate = true, duration = 400) {
		var camera = this._getCameraMeta(),
			scalar = zoomValue > 0 ? (1 * zoomValue) : Math.abs(1 / zoomValue),
			scalingMatrix,
			newMatrix;

		// Get transform matrix
		scalingMatrix = x3dom.fields.SFMatrix4f.scale(
			new x3dom.fields.SFVec3f(
				scalar,
				scalar,
				scalar
			)
		);

		// Multiply current matrix with transform one and get resulting matrix
		newMatrix = camera.matrix.mult(scalingMatrix);
		// Update viewpoint via setting new matrix
		this._updateViewpoint(newMatrix, animate, duration);
	},

	/**
	 * Zooms in the 3D scene.
	 * @param {Number} zoomValue Scale of zooming. In range (1, inf)
	 * @param {boolean} [animate = true] Use animation?
	 * @param {Number} [duration = 400] Duration of animation in milliseconds
	 */
	zoomIn: function(zoomValue = 2, animate = true, duration = 400) {
		zoomValue = Math.abs(zoomValue);
		this.zoom(zoomValue, animate, duration);
	},


	/**
	 * Zooms out the 3D scene.
	 * @param {Number} zoomValue Scale of zooming. In range (1, inf)
	 * @param {boolean} [animate = true] Use animation?
	 * @param {Number} [duration = 400] Duration of animation in milliseconds
	 */
	zoomOut: function(zoomValue = 2, animate = true, duration = 400) {
		zoomValue = Math.abs(zoomValue) * -1;
		this.zoom(zoomValue, animate, duration);
	}
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
	module.exports = X3DomHelper;