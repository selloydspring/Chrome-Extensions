// Visual Audio EQ - Popup Script
// Manages the popup UI and communicates with content scripts

// EQ Presets configuration
const EQ_PRESETS = {
  flat: { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 },
  'bass-boost': { 60: 8, 230: 5, 910: 0, 3600: -2, 14000: -3 },
  'treble-boost': { 60: -3, 230: -2, 910: 0, 3600: 5, 14000: 8 },
  vocal: { 60: -3, 230: 0, 910: 4, 3600: 3, 14000: 1 },
  rock: { 60: 5, 230: 3, 910: -1, 3600: 4, 14000: 5 },
  electronic: { 60: 7, 230: 4, 910: 0, 3600: 2, 14000: 6 }
};

// EQ band frequencies
const EQ_BANDS = [60, 230, 910, 3600, 14000];

// State
let isEnabled = false;
let currentPreset = 'flat';
let visualizerAnimationId = null;
let currentTabId = null;

// DOM Elements
const elements = {
  statusDot: null,
  statusText: null,
  visualizer: null,
  enableBtn: null,
  resetBtn: null,
  masterVolume: null,
  volumeValue: null,
  presetBtns: null,
  eqSliders: {}
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadSettings();
  setupEventListeners();
  await getCurrentTab();
  await checkEQStatus();
  startVisualizerAnimation();
});

// Initialize DOM element references
function initializeElements() {
  elements.statusDot = document.getElementById('status-dot');
  elements.statusText = document.getElementById('status-text');
  elements.visualizer = document.getElementById('visualizer');
  elements.enableBtn = document.getElementById('enable-btn');
  elements.resetBtn = document.getElementById('reset-btn');
  elements.masterVolume = document.getElementById('master-volume');
  elements.volumeValue = document.getElementById('volume-value');
  elements.presetBtns = document.querySelectorAll('.preset-btn');
  
  // Initialize EQ slider references
  EQ_BANDS.forEach(freq => {
    elements.eqSliders[freq] = document.getElementById(`band-${freq}`);
  });
}

// Load saved settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['eqSettings', 'masterVolume', 'currentPreset']);
    
    if (result.eqSettings) {
      EQ_BANDS.forEach(freq => {
        const value = result.eqSettings[freq] || 0;
        elements.eqSliders[freq].value = value;
        updateSliderDisplay(freq, value);
      });
    }
    
    if (result.masterVolume !== undefined) {
      elements.masterVolume.value = result.masterVolume;
      elements.volumeValue.textContent = `${result.masterVolume}%`;
    }
    
    if (result.currentPreset) {
      currentPreset = result.currentPreset;
      updatePresetButtons(currentPreset);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  const eqSettings = {};
  EQ_BANDS.forEach(freq => {
    eqSettings[freq] = parseInt(elements.eqSliders[freq].value);
  });
  
  try {
    await chrome.storage.local.set({
      eqSettings,
      masterVolume: parseInt(elements.masterVolume.value),
      currentPreset
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Get current active tab
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab?.id;
    return tab;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

// Check if EQ is enabled on current tab
async function checkEQStatus() {
  if (!currentTabId) return;
  
  try {
    const response = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_STATUS' });
    if (response && response.isEnabled) {
      setEnabledState(true);
    }
  } catch (error) {
    // Content script might not be loaded yet
    console.log('Content script not ready');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Enable/Disable button
  elements.enableBtn.addEventListener('click', toggleEQ);
  
  // Reset button
  elements.resetBtn.addEventListener('click', resetEQ);
  
  // Master volume
  elements.masterVolume.addEventListener('input', handleVolumeChange);
  
  // EQ sliders
  EQ_BANDS.forEach(freq => {
    elements.eqSliders[freq].addEventListener('input', (e) => handleSliderChange(freq, e));
  });
  
  // Preset buttons
  elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

// Toggle EQ on/off
async function toggleEQ() {
  if (!currentTabId) {
    updateStatus('No active tab');
    return;
  }
  
  try {
    if (!isEnabled) {
      // First, inject the content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content.js']
      });
    }
    
    const response = await chrome.tabs.sendMessage(currentTabId, {
      type: isEnabled ? 'DISABLE_EQ' : 'ENABLE_EQ',
      settings: getCurrentSettings()
    });
    
    if (response && response.success) {
      setEnabledState(!isEnabled);
    } else {
      updateStatus('No audio found');
    }
  } catch (error) {
    console.error('Error toggling EQ:', error);
    updateStatus('Error: Reload page');
  }
}

// Get current EQ settings
function getCurrentSettings() {
  const eqSettings = {};
  EQ_BANDS.forEach(freq => {
    eqSettings[freq] = parseInt(elements.eqSliders[freq].value);
  });
  
  return {
    eqSettings,
    masterVolume: parseInt(elements.masterVolume.value) / 100
  };
}

// Set enabled state
function setEnabledState(enabled) {
  isEnabled = enabled;
  
  if (enabled) {
    elements.statusDot.classList.add('active');
    elements.statusText.textContent = 'Active';
    elements.enableBtn.textContent = 'Disable EQ';
    elements.enableBtn.classList.add('enabled');
  } else {
    elements.statusDot.classList.remove('active');
    elements.statusText.textContent = 'Inactive';
    elements.enableBtn.textContent = 'Enable EQ';
    elements.enableBtn.classList.remove('enabled');
  }
}

// Update status text
function updateStatus(text) {
  elements.statusText.textContent = text;
  setTimeout(() => {
    elements.statusText.textContent = isEnabled ? 'Active' : 'Inactive';
  }, 2000);
}

// Handle EQ slider change
function handleSliderChange(freq, event) {
  const value = parseInt(event.target.value);
  updateSliderDisplay(freq, value);
  
  // Clear active preset when manually adjusting
  currentPreset = null;
  updatePresetButtons(null);
  
  // Send update to content script
  sendEQUpdate();
  saveSettings();
}

// Update slider display value
function updateSliderDisplay(freq, value) {
  const displayElement = document.getElementById(`value-${freq}`);
  if (displayElement) {
    displayElement.textContent = `${value > 0 ? '+' : ''}${value}dB`;
  }
}

// Handle volume change
function handleVolumeChange() {
  const value = elements.masterVolume.value;
  elements.volumeValue.textContent = `${value}%`;
  
  sendEQUpdate();
  saveSettings();
}

// Apply EQ preset
function applyPreset(presetName) {
  const preset = EQ_PRESETS[presetName];
  if (!preset) return;
  
  currentPreset = presetName;
  
  EQ_BANDS.forEach(freq => {
    elements.eqSliders[freq].value = preset[freq];
    updateSliderDisplay(freq, preset[freq]);
  });
  
  updatePresetButtons(presetName);
  sendEQUpdate();
  saveSettings();
}

// Update preset button states
function updatePresetButtons(activePreset) {
  elements.presetBtns.forEach(btn => {
    if (btn.dataset.preset === activePreset) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Reset EQ to flat
function resetEQ() {
  applyPreset('flat');
  elements.masterVolume.value = 100;
  elements.volumeValue.textContent = '100%';
  sendEQUpdate();
  saveSettings();
}

// Send EQ update to content script
async function sendEQUpdate() {
  if (!isEnabled || !currentTabId) return;
  
  try {
    await chrome.tabs.sendMessage(currentTabId, {
      type: 'UPDATE_EQ',
      settings: getCurrentSettings()
    });
  } catch (error) {
    console.error('Error sending EQ update:', error);
  }
}

// Visualizer animation
function startVisualizerAnimation() {
  const canvas = elements.visualizer;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Generate sample visualizer data
  let bars = new Array(32).fill(0);
  let targetBars = new Array(32).fill(0);
  
  function generateTargets() {
    targetBars = targetBars.map(() => Math.random() * (isEnabled ? 0.8 : 0.3));
  }
  
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Update bars with smoothing
    bars = bars.map((bar, i) => {
      const diff = targetBars[i] - bar;
      return bar + diff * 0.1;
    });
    
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(233, 69, 96, 0.8)');
    gradient.addColorStop(0.5, 'rgba(233, 69, 96, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.8)');
    
    // Draw bars
    const barWidth = width / bars.length - 2;
    bars.forEach((bar, i) => {
      const barHeight = bar * height;
      const x = i * (barWidth + 2);
      const y = height - barHeight;
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Add glow effect
      ctx.shadowColor = isEnabled ? 'rgba(0, 217, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 5;
    });
    
    ctx.shadowBlur = 0;
    
    visualizerAnimationId = requestAnimationFrame(animate);
  }
  
  // Generate new targets periodically
  setInterval(generateTargets, 100);
  generateTargets();
  animate();
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  if (visualizerAnimationId) {
    cancelAnimationFrame(visualizerAnimationId);
  }
});
