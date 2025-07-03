const Max = require('max-api');
const WebSocket = require('ws');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { execSync } = require('child_process');

function checkFfmpegInPath() {
  try {
    // Try to execute ffmpeg -version
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function findFfmpegPath() {
  // Define all possible FFmpeg locations in order of preference
  const possiblePaths = [
    // 1. Natural extraction location (where ffmpeg usually ends up)
    'C:\\g4l\\ffmpeg\\bin\\ffmpeg.exe',
    
    // 2. Manual copy location (current expectation)
    'C:\\g4l\\ffmpeg\\ffmpeg.exe',
    
    // 3. Relative to this script (if bundled with app)
    path.join(__dirname, 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(__dirname, 'ffmpeg', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    
    // 4. Common user installation locations
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe',
    
    // 5. Program Files locations
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    
    // 6. Chocolatey installation
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    'C:\\tools\\ffmpeg\\ffmpeg.exe',
    
    // 7. User AppData (winget/scoop installations)
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'winget', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source*', 'ffmpeg-*', 'bin', 'ffmpeg.exe'),
  ];
  
  // Check each path
  for (const testPath of possiblePaths) {
    Max.post(`Checking FFmpeg at: ${testPath}`);
    
    if (checkFfmpegAtPath(testPath)) {
      Max.post(`✅ Found working FFmpeg at: ${testPath}`);
      return testPath;
    }
  }
  
  return null;
}

function setupFfmpegPath() {
  Max.post('🔍 Searching for FFmpeg...');
  
  // First check if ffmpeg is already accessible in PATH
  if (checkFfmpegInPath()) {
    Max.post('✅ FFmpeg found in system PATH, using system FFmpeg');
    return true;
  }
  
  // If not in PATH, search common installation locations
  const ffmpegPath = findFfmpegPath();
  
  if (ffmpegPath) {
    try {
      ffmpeg.setFfmpegPath(ffmpegPath);
      Max.post(`✅ Successfully configured FFmpeg: ${ffmpegPath}`);
      return true;
    } catch (error) {
      Max.post(`❌ Error setting FFmpeg path: ${error.message}`);
    }
  }
  
  // If we get here, FFmpeg wasn't found anywhere
  Max.post('❌ FFmpeg not found in any expected location!');
  Max.post('📋 To fix this, you can:');
  Max.post('   1. Install FFmpeg via chocolatey: choco install ffmpeg');
  Max.post('   2. Install FFmpeg via winget: winget install ffmpeg');
  Max.post('   3. Download from https://ffmpeg.org and extract to C:\\g4l\\ffmpeg\\');
  Max.post('   4. Add FFmpeg to your system PATH');
  
  return false;
}

// Call this function when initializing your application
setupFfmpegPath();

const ws = new WebSocket('ws://localhost:8080');

let lastErrorMessage = null;  // Track the last error message
let isProcessing = false;

// Define our variations array in the same order as the Max umenu
const VARIATIONS = [
  'accordion_folk',
  'banjo_bluegrass',
  'piano_classical',
  'celtic',
  'strings_quartet',
  'synth_retro',
  'synth_modern',
  'synth_edm',
  'lofi_chill',
  'synth_bass',
  'rock_band',
  'cinematic_epic',
  'retro_rpg',
  'chiptune',
  'steel_drums',
  'gamelan_fusion',
  'music_box',
  'trap_808',
  'lo_fi_drums',
  'boom_bap',
  'percussion_ensemble',
  'future_bass',
  'synthwave_retro',
  'melodic_techno',
  'dubstep_wobble',
  'glitch_hop',
  'digital_disruption',
  'circuit_bent',
  'orchestral_glitch',
  'vapor_drums',
  'industrial_textures',
  'jungle_breaks',


  
  // ... all other variations in the same order as Max umenu
];

ws.on('open', function open() {
  Max.post("Connected to Electron WebSocket server");
});

ws.on('close', () => Max.post("Disconnected from Electron WebSocket server"));

Max.addHandler('set_flowstep', (value) => {
  if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
          action: 'update_flowstep',
          data: value
      }));
      Max.post(`Sent flowstep update to WebSocket server: ${value}`);
  }
});

Max.addHandler('reconnect', () => {
  lastErrorMessage = null;  // Clear any stored error message
  if (ws.readyState === WebSocket.OPEN) {
    // Only send the connection status
    ws.send(JSON.stringify({
      action: 'backend_connection_status',
      data: true
    }));
    Max.post('Sent reconnection status to WebSocket server');
  }
});

Max.addHandler('backend_connection', (...args) => {
  
  Max.post('Full backend_connection message data:');
  Max.post(JSON.stringify({
    args: args,
    firstArg: args[0],
    type: typeof args[0]
  }));
  
  if (ws.readyState === WebSocket.OPEN) {
    // Now we can properly check the value we receive
    const status = args[0] === 1;
    
    ws.send(JSON.stringify({
      action: 'backend_connection_status',
      data: status
    }));
    Max.post(`Sent backend connection status to WebSocket server: ${status}`);
  }
});

Max.addHandler('error_message', (data) => {
  // Store this error message
  lastErrorMessage = data;
  
  if (ws.readyState === WebSocket.OPEN) {
    const [type, message] = data.split('|');
    
    ws.send(JSON.stringify({
      action: 'error_message',
      data: {
        type,
        message
      }
    }));
    Max.post(`Sent error message to WebSocket server - Type: ${type}, Message: ${message}`);
  }
});

// Handler for receiving variation changes from Max
Max.addHandler('set_variation', (value) => {
  if (ws.readyState === WebSocket.OPEN) {
    // If value is a number (index)
    if (typeof value === 'number') {
      const variationName = VARIATIONS[value];
      if (variationName) {
        ws.send(JSON.stringify({
          action: 'update_variation',
          data: variationName
        }));
        Max.post(`Sent variation update to WebSocket server: ${variationName}`);
      } else {
        Max.post(`Invalid variation index: ${value}`);
      }
    }
    // If value is a string (variation name)
    else if (typeof value === 'string') {
      if (VARIATIONS.includes(value)) {
        ws.send(JSON.stringify({
          action: 'update_variation',
          data: value
        }));
        Max.post(`Sent variation update to WebSocket server: ${value}`);
      } else {
        Max.post(`Invalid variation name: ${value}`);
      }
    }
  }
});

Max.addHandler('tame_gary', (value) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ garyToggle: value }));
    Max.post(`Sent Gary state to WebSocket server: ${value}`);
  }
});

// Max handler to forward progress updates to the Electron app
Max.addHandler('progress_update', (progress) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'progress_update',
      data: progress
    }));
    Max.post(`Sent progress update to WebSocket server: ${progress}`);
  }
});

Max.addHandler('number', (value) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ toggle: value }));
    Max.post(`Sent to WebSocket server: { toggle: ${value} }`);
  }
});

const sendAudioData = (filePath, actionType) => {
  fs.readFile(filePath, { encoding: 'base64' }, (err, base64Data) => {
    if (err) {
      Max.post(`Error reading file: ${err.message}`);
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: actionType, data: base64Data }));
      Max.post(`Sent ${actionType} back to Electron from ${filePath}.`);
    }
  });
};

// Function to handle the crop_audio action from Electron
const handleCropAudio = (end) => {
  const tempFilePath = 'C:/g4l/tempAudio.wav';
  const croppedFilePath = 'C:/g4l/myOutput.wav';

  

  try {
    fs.copyFileSync('C:/g4l/myOutput.wav', tempFilePath); // Copy the original file to tempFilePath

    ffmpeg(tempFilePath)
      .setStartTime(0)
      .setDuration(Number(end))
      .output(croppedFilePath)
      .on('start', (cmdline) => {
        Max.post(`Started ffmpeg with command: ${cmdline}`);
      })
      .on('end', () => {
        Max.post('Audio cropping successful.');
        fs.unlinkSync(tempFilePath);
        
        // First, notify Max that crop was successful
        Max.outlet('crop_audio', 'success');
        
        // Then trigger the replace_output
        Max.outlet('replace_output');
        
        // Finally, send the new audio data back to Electron
        sendAudioData(croppedFilePath, 'audio_data_output');
        
        // Reset processing flag
        isProcessing = false;
      })
      .on('error', (err) => {
        Max.post('Error cropping audio: ' + err.message);
        fs.unlinkSync(tempFilePath);
        Max.outlet('crop_audio', 'error');
        isProcessing = false;
        
        // Notify Electron of the error
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'error_message',
            data: {
              type: 'crop',
              message: 'Failed to crop audio: ' + err.message
            }
          }));
        }
      })
      .run();
  } catch (error) {
    Max.post('Error in crop operation: ' + error.message);
    isProcessing = false;
    Max.outlet('crop_audio', 'error');
  }
};

// Function to handle 'crop' message from Max
Max.addHandler('crop', (end) => {
  if (!isProcessing) {
    isProcessing = true;
    ws.send(JSON.stringify({ action: 'crop', data: end }));
    Max.post(`Sent crop action with end: ${end}`);
  } else {
    Max.post('Processing already in progress.');
  }
});

Max.addHandler('audio_processed', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'audio_processed'
    }));
    Max.post('Sent audio_processed to WebSocket server');
  }
});

Max.addHandler('music_continued', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'music_continued'
    }));
    Max.post('Sent music_continued to WebSocket server');
  }
});

Max.addHandler('music_retried', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'music_retried'
    }));
    Max.post('Sent music_retried to WebSocket server');
  }
});

Max.addHandler('audio_transformed', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'audio_transformed'
    }));
    Max.post('Sent audio_transformed to WebSocket server');
  }
});

Max.addHandler('update_cropped_audio_complete', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'update_cropped_audio_complete'
    }));
    Max.post('Sent update_cropped_audio_complete to WebSocket server');
  }
});

Max.addHandler('stable_audio_generated', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'stable_audio_generated'
    }));
    Max.post('Sent stable_audio_generated to WebSocket server');
  }
});

ws.on('message', function incoming(data) {
  try {
    const command = JSON.parse(data);
    Max.post(`Received command: ${JSON.stringify(command)}`); // Debugging log
    switch (command.action) {
      case 'write_buffer':
        Max.outlet('write_buffer');
        setTimeout(() => sendAudioData('C:\\g4l\\myBuffer.wav', 'audio_data_buffer'), 1000);
        break;
        case 'load_output':
          // First pause any ongoing playback
          Max.outlet('pause');
          // Wait a brief moment for pause to take effect
          setTimeout(() => {
            // Reset the playback position
            Max.outlet('reset');
            // Replace the audio file
            Max.outlet('replace_output');
            // Send the audio data back to Electron
            sendAudioData('C:\\g4l\\myOutput.wav', 'audio_data_output');
            // Notify Electron that we've reset the playback state
            ws.send(JSON.stringify({
              action: 'playback_state_update',
              data: {
                isPlaying: false,
                position: 0
              }
            }));
          }, 100);
          break;
      case 'play':
        Max.outlet('play');  // Assumes there's a Max outlet configured to handle this
        break;
      case 'fix_toggle':
        Max.outlet('fix_toggle');  // Assumes there's a Max outlet configured to handle this
        break;
      case 'pause':
        Max.outlet('pause'); // Assumes there's a Max outlet configured to handle this
        break;
      case 'reset':
        Max.outlet('reset'); // Assumes there's a Max outlet configured to handle this
        break;
      case 'bang':
        Max.outlet('bang'); // Assumes there's a Max outlet configured to handle this
        break;
      case 'continue':
        Max.outlet('continue'); // Assumes there's a Max outlet configured to handle this
        break;
      case 'retry':
        Max.outlet('retry'); // Assumes there's a Max outlet configured to handle this
        break;
      case 'update_model_path':
        console.log('Updating model path with:', command.data);
        Max.outlet('forward_model_path', command.data);
        break;
      case 'update_prompt_duration':
        console.log('Updating prompt_duration with:', command.data);
        Max.outlet('update_prompt_duration', command.data);
        break;
      case 'crop':
        const { data } = command;
        handleCropAudio(data);
        break;
      case 'update_gary_state':
        const garyState = command.data.garyToggle;
        Max.outlet('update_gary_state', garyState); // This will connect to a route object in Max
        break;
      // When receiving variation updates from Electron
      case 'update_variation':
        // Find the index of the variation in our array
        const index = VARIATIONS.indexOf(command.data);
        if (index !== -1) {
          Max.outlet('update_variation', index);  // Send the index instead of the string
        }
        break;
      case 'transform':
        Max.outlet('transform');
        break;
      case 'undo_transform':
        Max.outlet('undo_transform');
        break;
      case 'reset_transform':
          Max.outlet('reset_transform');
          // Then handle the syncing of current state
          if (command.data && typeof command.data === 'object') {
            // Update model path if provided
            if (command.data.modelPath) {
              Max.outlet('forward_model_path', command.data.modelPath);
            }
            // Update prompt duration if provided
            if (command.data.promptDuration) {
              Max.outlet('update_prompt_duration', command.data.promptDuration);
            }
            // Update variation if provided
            if (command.data.variation) {
              const index = VARIATIONS.indexOf(command.data.variation);
              if (index !== -1) {
                Max.outlet('update_variation', index);
              }
            }
          }
        break;
        case 'backend_connection_status':
          Max.outlet('backend_connection_status', command.data);
        break;
        case 'update_flowstep':
          console.log('Updating flowstep with:', command.data);
          Max.outlet('update_flowstep', command.data);  // This will connect to our live.dial
        break;
        case 'update_prompt':
          let cleanData = command.data;
          if (typeof cleanData === 'string' && cleanData.startsWith('"') && cleanData.endsWith('"')) {
            cleanData = cleanData.slice(1, -1); // Remove first and last characters
          }
          Max.outlet('forward_prompt', cleanData);
        break;
        case 'generate_stable_audio':
          console.log('Triggering stable audio generation');
          Max.outlet('generate_stable_audio');
        break;
        case 'update_jerry_cfg':
          console.log('Updating Jerry CFG with:', command.data);
          Max.outlet('forward_jerry_cfg', command.data);
        break;

        case 'update_jerry_steps':
          console.log('Updating Jerry steps with:', command.data);
          Max.outlet('forward_jerry_steps', command.data);
        break;
      default:
        Max.post(`Unhandled action: ${command.action}`);
    }
  } catch (error) {
    console.error('Error parsing incoming data:', error);
    Max.post('Error parsing incoming data: ' + error.message);
  }
});

function initSocketConnection() {
  ws.on('open', function open() {
    Max.post('Connected to Electron WebSocket server.');
  });

  ws.on('close', () => {
    Max.post('Disconnected from Electron WebSocket server.');
  });

  ws.on('error', (error) => {
    Max.post('WebSocket error: ' + error.message);
  });
}

// Initialize WebSocket connection and setup event listeners
initSocketConnection();
