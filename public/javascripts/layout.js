// settings
const minFontSize = 12;
const maxFontSize = 18;

// capture elements
const content = document.getElementById("Content");

// initialize page font size
const savedSize = localStorage.getItem("fontSize");
if (savedSize) content.style.fontSize = savedSize;

// initialize settings counters
updateSettingsDisplay();

// increment/decrement base font size (12 <= x <= 18)
function zoom(mode) {
	const fontSize = Math.max(Math.min(parseFloat(window.getComputedStyle(content).fontSize) + (mode == "in" ? 1 : -1), maxFontSize), minFontSize);
	content.style.fontSize = `${fontSize}px`;
	localStorage.setItem("fontSize", fontSize);
	updateSettingsDisplay();
}

// update settings counters
function updateSettingsDisplay() {
	document.getElementById("fontSize").innerHTML = window.getComputedStyle(content).fontSize;
}

// site zoom hotkeys
hotkeys("ctrl+=, ctrl+-", function (event, handler) {
	event.preventDefault();
	zoom(handler.key == "ctrl+=" ? "in" : "out");
});