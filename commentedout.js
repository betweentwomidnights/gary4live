const Max = require('max-api');
const fs = require('fs');
const io = require('socket.io-client');
const socket = io('http://localhost:8000', {

    // our backend url
// const socket = io('https://g4l.thecollabagepatch.com', {
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
let tameTheGaryEnabled = false; // New state variable for the toggle
let variationName = 'accordion_folk';  // Default variation

let isBackendConnected = false;

// Add handler for variation text input
Max.addHandler('set_variation', (newVariation) => {
    if (typeof newVariation === 'string') {
        variationName = newVariation.trim();
        Max.post(`Variation updated to: ${variationName}`);
    }
});

// Update transform handler to use the variationName variable
Max.addHandler('transform', () => {
    if (!isProcessing) {
        isProcessing = true;
        
        const audioPath = sessionID ? 'C:/g4l/myOutput.wav' : 'C:/g4l/myBuffer.wav';
        
        fs.readFile(audioPath, (err, data) => {
            if (err) {
                Max.post(`Error reading audio file: ${err}`);
                isProcessing = false;
                return;
            }
            
            const audioData_base64 = data.toString('base64');
            
            const request = {
                audio_data: audioData_base64,
                variation: variationName,  // Use the stored variation name
                session_id: sessionID
            };

            socket.emit('transform_audio_request', request);
        });

        setTimeout(() => {
            isProcessing = false;
        }, timeoutDuration);
    } else {
        Max.post('Processing already in progress.');
    }
});

// Add handler for undo button
Max.addHandler('undo_transform', () => {
    if (!isProcessing && sessionID) {
        isProcessing = true;
        
        const request = {
            session_id: sessionID
        };

        socket.emit('undo_transform_request', request);

        setTimeout(() => {
            isProcessing = false;
        }, timeoutDuration);
    } else {
        Max.post('Either processing in progress or no session available for undo.');
    }
});

Max.addHandler('tame_gary', (value) => {
    tameTheGaryEnabled = value === 1;
    Max.post(`Tame the Gary ${tameTheGaryEnabled ? 'enabled' : 'disabled'}`);
});

// Timeout duration in milliseconds
const timeoutDuration = 500; // .5 seconds

// Initialize WebSocket connection and setup event listeners
function initSocketConnection() {
    socket.on('connect', () => {
        isBackendConnected = true;
        Max.post('Connected to WebSocket server.');
        Max.outlet('backend_connection', true);
        if (sessionID) {
            socket.emit('verify_session', { session_id: sessionID });
        }
    });

    socket.on('reconnect_attempt', () => {
        Max.post('Attempting to reconnect to WebSocket server...');
    });

    Max.addHandler('reconnect', () => {
        // Only send the connection status
        Max.outlet('backend_connection', true);
        // Reset any error states if needed
        Max.post('Reconnected and reset states');
    });

    socket.on('reconnect_error', (error) => {
        Max.post('Reconnection error: ' + error.message);
    });

    socket.on('reconnect_failed', () => {
        Max.post('Failed to reconnect to WebSocket server.');
    });

    socket.on('connect_error', (error) => {
        isBackendConnected = false;
        Max.post('Connection error: ' + error.message);
        Max.outlet('backend_connection', false);  // Inform about lost backend connection
    });

    socket.on('disconnect', (reason) => {
        isBackendConnected = false;
        Max.post('Disconnected from WebSocket server: ' + reason);
        Max.outlet('backend_connection', false);  // Inform about lost backend connection
        if (reason === 'io server disconnect') {
            socket.connect();
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
        isProcessing = false;
        Max.post('Error from WebSocket server: ' + data.message);
        
        // Check if the error message includes the specific connection error
        if (data.message.includes('Connection refused') || 
            data.message.includes('Failed to establish a new connection')) {
            Max.outlet('error_message', 'transform|terry is asleep right now. he uses alot of gpu ram. you can learn how to spin up your own terry container by bugging kevin in the discord tho: https://discord.gg/VECkyXEnAd');
        } else {
            Max.outlet('error', data.message);
        }
    });

    socket.on('update_cropped_audio_complete', (data) => {
        sessionID = data.session_id; // Update the session ID
        Max.post('Cropped audio updated successfully.');
    });

    // Add new socket listener for transform response
    socket.on('audio_transformed', (data) => {
        isProcessing = false;
        Max.post('Audio transformation successful.');
        sessionID = data.session_id; // Update session ID
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('audio_transformed');
        // Max.outlet('progress_update', 100);
    });
    // Add socket listener for undo response
    socket.on('transform_undone', (data) => {
        isProcessing = false;
        Max.post('Transform undo successful.');
        sessionID = data.session_id;
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('transform_undone');
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
    if (isProcessing) {
        Max.outlet('error_message', 'processing', 'Still processing previous request, wait a sec...');
        Max.post('Processing already in progress.');
        return;
    }
    
    if (!sessionID) {
        // Let's try concatenating the type and message with a delimiter
        Max.outlet('error_message', 'no_session|no audio in the session to continue yet, homie. press bang first.');
        Max.post('No session available - need to press bang first.');
        return;
    }

    isProcessing = true;
    continueMusic();

    setTimeout(() => {
        isProcessing = false;
    }, timeoutDuration);
});

// Function to handle 'retry' message from Max
Max.addHandler('retry', () => {
    if (isProcessing) {
        Max.outlet('error_message', 'processing|Still processing previous request, wait a sec...');
        Max.post('Processing already in progress.');
        return;
    }
    
    if (!sessionID) {
        // Using the same delimiter format as continue
        Max.outlet('error_message', 'no_continuation|no continued audio to retry bro. press continue first.');
        Max.post('No continued audio available - need to press continue first.');
        return;
    }

    isProcessing = true;
    
    const request = {
        session_id: sessionID,
        model_name: modelPath,
        prompt_duration: promptDuration
    };

    // Add Gary-taming parameters if enabled
    if (tameTheGaryEnabled) {
        request.top_k = 150;
        request.cfg_coef = 5;
        request.description = "drums, percussion";
    }

    socket.emit('retry_music_request', request);

    setTimeout(() => {
        isProcessing = false;
    }, timeoutDuration);
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

// Add handler for reset_transform
Max.addHandler('reset_transform', () => {
    Max.post('[commentedout] Reset transform handler triggered');
    
    // If we have an active session, clean it up
    if (sessionID) {
        Max.post('[commentedout] Cleaning up session: ' + sessionID);
        socket.emit('cleanup_session_request', { session_id: sessionID });
        sessionID = null;
    } else {
        Max.post('[commentedout] No active session to clean up');
    }
    
    Max.post('[commentedout] Reset complete');
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
        
        // Base request object
        const request = {
            audio_data: audioData_base64,
            model_name: modelPath,
            prompt_duration: promptDuration
        };

        // Add Gary-taming parameters if enabled
        if (tameTheGaryEnabled) {
            request.top_k = 100;
            request.cfg_coef = 5;
            request.description = "drums, percussion";
        }

        socket.emit('process_audio_request', request);
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
        
        // Base request object
        const request = {
            audio_data: audioData_base64,
            model_name: modelPath,
            session_id: sessionID,
            prompt_duration: promptDuration
        };

        // Add Gary-taming parameters if enabled
        if (tameTheGaryEnabled) {
            request.top_k = 150;
            request.cfg_coef = 5;
            request.description = "drums, percussion";
        }

        socket.emit('continue_music_request', request);
    });
}

// Start the WebSocket connection
initSocketConnection();
