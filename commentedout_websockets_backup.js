const Max = require('max-api');
const fs = require('fs');
const io = require('socket.io-client');
const socket = io('https://d8a7-72-211-181-187.ngrok-free.app');
const path = require('path');

let modelPath = 'facebook/musicgen-small'; // default model path

// Initialize WebSocket connection and setup event listeners
function initSocketConnection() {
    socket.on('connect', () => {
        Max.post('Connected to WebSocket server.');
    });

    socket.on('audio_processed', (data) => {
        Max.post('Audio processing successful.');
        // Decode the base64 string to binary data
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        // Write the binary data to 'myOutput.wav'
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('audio_processed');
    });

    socket.on('music_continued', (data) => {
        Max.post('Music continuation successful.');
        // Decode the base64 string to binary data
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        // Write the binary data back to 'myOutput.wav'
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('music_continued');
    });

    socket.on('status', (data) => {
        Max.post(data.message);
    });

    socket.on('error', (data) => {
        Max.post('Error from WebSocket server: ' + data.message);
        Max.outlet('error', data.message);
    });

    socket.on('disconnect', () => {
        Max.post('Disconnected from WebSocket server.');
    });
}

// Post a message to the Max console when the script is loaded
Max.post(`Loaded the ${path.basename(__filename)} script`);

// Function to handle 'text' message and argument from Max
Max.addHandler('text', (newModelPath) => {
    modelPath = newModelPath;
    Max.post(`Received text, setting modelPath to: ${modelPath}`);
});

// Function to handle 'bang' message from Max
Max.addHandler('bang', () => {
    Max.post('Received bang, sending audio processing request to WebSocket server.');
    processAudio('C:/g4l/myBuffer.wav');
});

// Function to handle 'continue' message from Max
Max.addHandler('continue', () => {
    Max.post('Received continue, sending music continuation request to WebSocket server.');
    continueMusic();
});

// Function to process audio
function processAudio(inputAudioPath) {
    fs.readFile(inputAudioPath, (err, data) => {
        if (err) {
            Max.post(`Error reading audio file: ${err}`);
            Max.outlet('error', err.toString());
            return;
        }
        const audioData_base64 = data.toString('base64');
        socket.emit('process_audio_request', { audio_data: audioData_base64, model_name: modelPath });
    });
}

// Function to continue music
function continueMusic() {
    const outputAudioPath = 'C:/g4l/myOutput.wav';  // Use the output file from previous processing
    fs.readFile(outputAudioPath, (err, data) => {
        if (err) {
            Max.post(`Error reading output file: ${err}`);
            Max.outlet('error', err.toString());
            return;
        }
        const audioData_base64 = data.toString('base64');
        socket.emit('continue_music_request', { audio_data: audioData_base64, model_name: modelPath });
    });
}

// Start the WebSocket connection
initSocketConnection();
