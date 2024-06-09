const Max = require('max-api');
const WebSocket = require('ws');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  Max.post("Connected to Electron WebSocket server");
});

ws.on('close', () => Max.post("Disconnected from Electron WebSocket server"));

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

  fs.copyFileSync('C:/g4l/myOutput.wav', tempFilePath); // Copy the original file to tempFilePath

  ffmpeg(tempFilePath)
    .setStartTime(0)
    .setDuration(Number(end)) // Ensure end is a number
    .output(croppedFilePath)
    .on('start', (cmdline) => {
      Max.post(`Started ffmpeg with command: ${cmdline}`);
    })
    .on('end', () => {
      Max.post('Audio cropping successful.');
      fs.unlinkSync(tempFilePath);
      sendAudioData(croppedFilePath, 'audio_data_output');  // Send the updated audio data back to Electron
      Max.outlet('crop_audio', 'success');  // Explicitly send a message indicating crop success
    })
    .on('error', (err) => {
      Max.post('Error cropping audio: ' + err.message);
      fs.unlinkSync(tempFilePath);
      Max.outlet('crop_audio', 'error');
    })
    .run();
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
        Max.outlet('replace_output'); // Outlet that triggers 'replace C:/g4l/myOutput.wav'
        sendAudioData('C:\\g4l\\myOutput.wav', 'audio_data_output');
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
