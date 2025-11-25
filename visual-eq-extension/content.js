// Visual Audio EQ - Content Script
// Handles audio processing and EQ application on web pages

(function() {
  'use strict';
  
  // Prevent multiple initializations
  if (window.__visualAudioEQLoaded) {
    return;
  }
  window.__visualAudioEQLoaded = true;
  
  // Audio context and nodes
  let audioContext = null;
  let analyser = null;
  let gainNode = null;
  let eqFilters = [];
  let isEnabled = false;
  let connectedElements = new WeakMap();
  
  // EQ band frequencies
  const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000];
  
  // Initialize audio context
  function initAudioContext() {
    if (audioContext) return audioContext;
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser for visualization
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      // Create master gain node
      gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      
      // Create EQ filters (5-band parametric EQ)
      eqFilters = EQ_FREQUENCIES.map(frequency => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1.4; // Bandwidth
        filter.gain.value = 0; // Default flat
        return filter;
      });
      
      // Connect filters in series: source -> filters -> gain -> analyser -> destination
      // Filters will be connected when audio source is connected
      
      return audioContext;
    } catch (error) {
      console.error('Failed to create audio context:', error);
      return null;
    }
  }
  
  // Find all audio/video elements on the page
  function findMediaElements() {
    const elements = [];
    
    // Find HTML5 audio and video elements
    document.querySelectorAll('audio, video').forEach(el => {
      if (!el.paused || el.readyState > 0) {
        elements.push(el);
      }
    });
    
    // Also include elements that might have audio
    document.querySelectorAll('audio, video').forEach(el => {
      if (!elements.includes(el)) {
        elements.push(el);
      }
    });
    
    return elements;
  }
  
  // Connect an audio/video element to the EQ chain
  function connectMediaElement(element) {
    if (connectedElements.has(element)) {
      return connectedElements.get(element);
    }
    
    if (!audioContext) {
      initAudioContext();
    }
    
    if (!audioContext) return null;
    
    try {
      // Resume audio context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Create source from media element
      const source = audioContext.createMediaElementSource(element);
      
      // Connect the chain: source -> filters -> gain -> analyser -> destination
      let lastNode = source;
      
      eqFilters.forEach(filter => {
        lastNode.connect(filter);
        lastNode = filter;
      });
      
      lastNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);
      
      const connection = { source, element };
      connectedElements.set(element, connection);
      
      console.log('Visual Audio EQ: Connected to media element');
      return connection;
    } catch (error) {
      console.error('Failed to connect media element:', error);
      return null;
    }
  }
  
  // Update EQ settings
  function updateEQSettings(settings) {
    if (!settings || !settings.eqSettings) return;
    
    const { eqSettings, masterVolume } = settings;
    
    // Update each EQ band
    EQ_FREQUENCIES.forEach((freq, index) => {
      if (eqFilters[index] && eqSettings[freq] !== undefined) {
        eqFilters[index].gain.value = eqSettings[freq];
      }
    });
    
    // Update master volume
    if (gainNode && masterVolume !== undefined) {
      gainNode.gain.value = masterVolume;
    }
  }
  
  // Get analyser data for visualization
  function getAnalyserData() {
    if (!analyser) return null;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    return Array.from(dataArray);
  }
  
  // Enable EQ processing
  function enableEQ(settings) {
    const mediaElements = findMediaElements();
    
    if (mediaElements.length === 0) {
      return { success: false, message: 'No audio/video elements found' };
    }
    
    let connectedCount = 0;
    mediaElements.forEach(element => {
      const connection = connectMediaElement(element);
      if (connection) {
        connectedCount++;
      }
    });
    
    if (connectedCount > 0) {
      isEnabled = true;
      updateEQSettings(settings);
      
      // Set up observer to catch dynamically added media elements
      setupMediaObserver();
      
      return { success: true, connectedCount };
    }
    
    return { success: false, message: 'Failed to connect to audio' };
  }
  
  // Disable EQ (bypass)
  function disableEQ() {
    isEnabled = false;
    
    // Reset EQ to flat
    eqFilters.forEach(filter => {
      filter.gain.value = 0;
    });
    
    // Reset gain to 1
    if (gainNode) {
      gainNode.gain.value = 1.0;
    }
    
    return { success: true };
  }
  
  // MutationObserver to catch dynamically added media elements
  let mediaObserver = null;
  
  function setupMediaObserver() {
    if (mediaObserver) return;
    
    mediaObserver = new MutationObserver(mutations => {
      if (!isEnabled) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'AUDIO' || node.nodeName === 'VIDEO') {
            connectMediaElement(node);
          }
          
          // Check for nested audio/video elements
          if (node.querySelectorAll) {
            node.querySelectorAll('audio, video').forEach(el => {
              connectMediaElement(el);
            });
          }
        });
      });
    });
    
    mediaObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Message handler for communication with popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_STATUS':
        sendResponse({ isEnabled, hasAudio: findMediaElements().length > 0 });
        break;
        
      case 'ENABLE_EQ':
        sendResponse(enableEQ(message.settings));
        break;
        
      case 'DISABLE_EQ':
        sendResponse(disableEQ());
        break;
        
      case 'UPDATE_EQ':
        updateEQSettings(message.settings);
        sendResponse({ success: true });
        break;
        
      case 'GET_ANALYSER_DATA':
        sendResponse({ data: getAnalyserData() });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open for async response
  });
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (audioContext && document.visibilityState === 'visible') {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    }
  });
  
  console.log('Visual Audio EQ: Content script loaded');
})();
