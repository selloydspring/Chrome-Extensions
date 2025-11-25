# Chrome-Extensions
My personal repo for chrome extensions

## Visual Audio EQ

A Chrome extension that provides a visual equalizer for audio playback in your browser. Adjust audio frequencies and visualize sound in real-time.

### Features

- **5-Band Equalizer**: Fine-tune your audio with frequency bands at 60Hz, 230Hz, 910Hz, 3.6kHz, and 14kHz
- **Real-time Visualization**: See your audio come to life with animated frequency bars
- **Preset Profiles**: Quick access to common EQ settings:
  - Flat (default)
  - Bass Boost
  - Treble Boost
  - Vocal
  - Rock
  - Electronic
- **Master Volume Control**: Adjust overall volume from 0% to 150%
- **Persistent Settings**: Your preferences are saved between sessions

### Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `visual-eq-extension` folder
5. The extension icon will appear in your browser toolbar

### Usage

1. Navigate to a page with audio/video content (e.g., YouTube, Spotify Web, etc.)
2. Click the Visual Audio EQ extension icon in your toolbar
3. Click "Enable EQ" to activate audio processing
4. Adjust the EQ sliders to customize your sound
5. Use presets for quick audio profiles
6. Adjust master volume as needed

### Requirements

- Chromium-based browser (Chrome, Edge, Brave, etc.)
- Pages must have HTML5 audio or video elements

### Technical Details

The extension uses the Web Audio API to:
- Create a 5-band parametric equalizer
- Provide real-time audio analysis for visualization
- Process audio without affecting video playback

### Permissions

- `activeTab`: Required to access audio on the current tab
- `storage`: Required to save your EQ settings
- `scripting`: Required to inject the audio processor
- `<all_urls>`: Required to work on any website with audio

### License

MIT License - See [LICENSE](LICENSE) for details
