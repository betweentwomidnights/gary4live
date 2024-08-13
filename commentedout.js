const Max = require('max-api');
const fs = require('fs');
const io = require('socket.io-client');
const socket = io('https://g4l.thecollabagepatch.com', {
    transports: ['websocket'], // Force WebSocket usage
    reconnection: true, // Enable auto-reconnection
    reconnectionAttempts: Infinity, // Unlimited reconnection attempts
    reconnectionDelay: 1000, // Wait 1 second before attempting to reconnect
    reconnectionDelayMax: 5000, // Maximum delay between reconnections
    randomizationFactor: 0.5,
    timeout: 300000, // Connection timeout in milliseconds
    pingTimeout: 240000, // How many ms without a pong packet to consider the connection closed
    pingInterval: 120000 // How many ms before sending a new ping packet
});
const path = require('path');

let modelPath = 'thepatch/vanya_ai_dnb_0.1'; // Default model path
let sessionID = null; // Variable to store the session ID
let isProcessing = false;
let promptDuration = 6; // Default prompt duration

// Timeout duration in milliseconds
const timeoutDuration = 500; // .5 seconds

// Initialize WebSocket connection and setup event listeners
function initSocketConnection() {
    socket.on('connect', () => {
        Max.post('Connected to WebSocket server.');
        if (sessionID) {
            socket.emit('verify_session', { session_id: sessionID });
        }
    });

    socket.on('reconnect_attempt', () => {
        Max.post('Attempting to reconnect to WebSocket server...');
    });

    socket.on('reconnect', () => {
        Max.post('Successfully reconnected to WebSocket server.');
    });

    socket.on('reconnect_error', (error) => {
        Max.post('Reconnection error: ' + error.message);
    });

    socket.on('reconnect_failed', () => {
        Max.post('Failed to reconnect to WebSocket server.');
    });

    socket.on('connect_error', (error) => {
        Max.post('Connection error: ' + error.message);
    });

    socket.on('disconnect', (reason) => {
        Max.post('Disconnected from WebSocket server: ' + reason);
        if (reason === 'io server disconnect') {
            socket.connect();  // Optionally try to reconnect automatically
        }
    });

    socket.on('audio_processed', (data) => {
        isProcessing = false; // Reset flag when audio processing is complete
        Max.post('Audio processing successful.');
        sessionID = data.session_id; // Store the session ID
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('audio_processed');
        Max.outlet('progress_update', 100);
    });

    socket.on('music_continued', (data) => {
        isProcessing = false; // Reset flag when audio processing is complete
        Max.post('Music continuation successful.');
        sessionID = data.session_id; // Update the session ID
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('music_continued');
        Max.outlet('progress_update', 100);  // Force the progress to 100% on completion
    });

    socket.on('music_retried', (data) => {
        isProcessing = false; // Reset flag when audio processing is complete
        Max.post('Music retry successful.');
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('music_retried');
        Max.outlet('progress_update', 100);  // Force the progress to 100% on completion
    });

    socket.on('progress_update', (data) => {
        Max.post(`progress update: ${data.progress}%`);
        Max.outlet('progress_update', data.progress);
    });

    socket.on('error', (data) => {
        isProcessing = false; // Reset flag if an error occurs
        Max.post('Error from WebSocket server: ' + data.message);
        Max.outlet('error', data.message);
    });

    socket.on('update_cropped_audio_complete', (data) => {
        sessionID = data.session_id; // Update the session ID
        Max.post('Cropped audio updated successfully.');
    });
}

// Function to handle 'bang' message from Max
Max.addHandler('bang', () => {
    if (!isProcessing) {
        isProcessing = true;
        // Optional: Send a cleanup request if sessionID exists
        if (sessionID) {
            socket.emit('cleanup_session_request', { session_id: sessionID });
        }

        Max.post('Sending audio processing request to WebSocket server with a new session.');
        processAudio('C:/g4l/myBuffer.wav');
        sessionID = null; // Reset the session ID after sending the cleanup request

        // Add timeout to reset isProcessing
        setTimeout(() => {
            isProcessing = false;
        }, timeoutDuration);
    } else {
        Max.post('Processing already in progress.');
    }
});

// Function to handle 'continue' message from Max
Max.addHandler('continue', () => {
    if (!isProcessing && sessionID) {
        isProcessing = true;
        continueMusic();

        // Add timeout to reset isProcessing
        setTimeout(() => {
            isProcessing = false;
        }, timeoutDuration);
    } else {
        Max.post('Either processing already in progress or no session available.');
    }
});

// Function to handle 'retry' message from Max
Max.addHandler('retry', () => {
    if (!isProcessing && sessionID) {
        isProcessing = true;
        socket.emit('retry_music_request', { session_id: sessionID, model_name: modelPath, prompt_duration: promptDuration });

        // Add timeout to reset isProcessing
        setTimeout(() => {
            isProcessing = false;
        }, timeoutDuration);
    } else {
        Max.post('Either processing already in progress or no session available.');
    }
});

// This handler will directly update the model path when text changes
Max.addHandler('text', (newModelPath) => {
    if (typeof newModelPath === 'string') {
        modelPath = newModelPath.trim(); // Ensure to trim any extra whitespace
        Max.post(`Model path updated directly to: ${modelPath}`);
    }
});

// Handler for receiving the prompt duration value
Max.addHandler('prompt_duration', (value) => {
    if (typeof value === 'number' && value >= 1 && value <= 15) {
        promptDuration = value;
        Max.post(`Prompt duration set to: ${promptDuration}`);
    } else {
        Max.post('Invalid prompt duration value. It should be between 1 and 15.');
    }
});

// Handler for the 'crop_audio' event
Max.addHandler('crop_audio', () => {
    const outputAudioPath = 'C:/g4l/myOutput.wav';
    fs.readFile(outputAudioPath, (err, data) => {
        if (err) {
            Max.post(`Error reading output file for cropping: ${err}`);
            return;
        }
        const audioData_base64 = data.toString('base64');
        socket.emit('update_cropped_audio', { session_id: sessionID, audio_data: audioData_base64 });
        Max.post('Sent cropped audio data to backend');
    });
});

// Function to process audio
function processAudio(inputAudioPath) {
    fs.readFile(inputAudioPath, (err, data) => {
        if (err) {
            Max.post(`Error reading audio file: ${err}`);
            isProcessing = false;
            Max.outlet('error', err.toString());
            return;
        }
        const audioData_base64 = data.toString('base64');
        socket.emit('process_audio_request', {
            audio_data: audioData_base64,
            model_name: modelPath,
            prompt_duration: promptDuration // Include prompt duration
        });
    });
}

// Function to continue music
function continueMusic() {
    const outputAudioPath = 'C:/g4l/myOutput.wav';
    fs.readFile(outputAudioPath, (err, data) => {
        if (err) {
            Max.post(`Error reading output file: ${err}`);
            isProcessing = false;
            Max.outlet('error', err.toString());
            return;
        }
        const audioData_base64 = data.toString('base64');
        socket.emit('continue_music_request', { audio_data: audioData_base64, model_name: modelPath, session_id: sessionID, prompt_duration: promptDuration });
    });
}

// Start the WebSocket connection
initSocketConnection();
