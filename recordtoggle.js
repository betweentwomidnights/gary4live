// Initialize mgraphics
mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
var isActive = false; // State of the toggle

function paint() {
    // Clear the background
    mgraphics.set_source_rgba(0, 0, 0, 1); // Black background
    mgraphics.rectangle(0, 0, box.rect[2], box.rect[3]);
    mgraphics.fill();

    // Define circle dimensions and anchor to the top-left
    var circleX = 20; // 20 pixels from the left edge
    var circleY = 20; // 20 pixels from the top edge
    var radius = 15; // Fixed radius

    // Draw the toggle button as a circle
    if (isActive) {
        mgraphics.set_source_rgba(1, 0, 0, 1); // Red when active
    } else {
        mgraphics.set_source_rgba(0, 0, 0, 1); // Black when inactive
    }
    mgraphics.arc(circleX, circleY, radius, 0, 2 * Math.PI);
    mgraphics.fill();
}

// Function to receive messages from Max
function msg_int(v) {
    isActive = v !== 0; // Toggle state changed
    mgraphics.redraw(); // Redraw the UI
}

// On mouse click, toggle the state and send the new state back to Max
function onclick(x, y, button, mod1, shift) {
    isActive = !isActive;
    mgraphics.redraw();
    outlet(0, isActive ? 1 : 0); // Send the new state back to Max
}

// Ensure the UI is redrawn properly on resize
function onresize(width, height) {
    mgraphics.redraw();
}
onresize.local = 1; // Keep function local to this script

// Adjust redraw when the box size changes
function onboxrect() {
    mgraphics.redraw();
}
onboxrect.local = 1; // Keep function local to this script
