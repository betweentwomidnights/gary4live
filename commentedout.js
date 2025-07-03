const Max = require('max-api');
const fs = require('fs');
const io = require('socket.io-client');

const https = require('https');
const http = require('http');

// =============================================================================
// CONFIGURATION - Change these URLs when building from source with localhost
// =============================================================================

// For localhost development with our github repo https://github.com/betweentwomidnights/gary-backend-combined
// Uncomment these lines and comment out the production URLs below:
// const BACKEND_URL = 'http://localhost:8000';
// const STABLE_AUDIO_HOST = 'localhost';
// const STABLE_AUDIO_PORT = 8005;
// const USE_HTTPS = false;

// Production URLs (default):
const BACKEND_URL = 'https://g4l.thecollabagepatch.com';
const STABLE_AUDIO_HOST = 'g4l.thecollabagepatch.com';
const STABLE_AUDIO_PORT = 443;
const USE_HTTPS = true;

// =============================================================================

const socket = io(BACKEND_URL, {
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

// New state variables for stable-audio
let currentBPM = 120; // Default BPM
let stableAudioPrompt = "aggressive techno"; // Default prompt
let isStableAudioProcessing = false;

let stableCFG = 1.0; // Default CFG
let stableSteps = 8; // Default steps

// Handler to receive BPM from Live's transport
Max.addHandler('set_bpm', (bpm) => {
    if (typeof bpm === 'number' && bpm > 0) {
        currentBPM = Math.round(bpm);
        Max.post(`BPM updated to: ${currentBPM}`);
    }
});

Max.addHandler('set_cfg', (cfg) => {
    if (typeof cfg === 'number' && cfg >= 0.5 && cfg <= 2.0) {
        // Quantize to nearest 0.1 increment
        stableCFG = Math.round(cfg * 10) / 10;
        Max.post(`Jerry CFG updated to: ${stableCFG} (from raw: ${cfg})`);
    }
});

// Handler for steps changes  
Max.addHandler('set_steps', (steps) => {
    if (typeof steps === 'number' && steps >= 4 && steps <= 16) {
        stableSteps = Math.round(steps); // Ensure integer
        Max.post(`Jerry steps updated to: ${stableSteps}`);
    }
});

// Handler to set the prompt text
Max.addHandler('set_prompt', (prompt) => {
    if (typeof prompt === 'string') {
        // Remove 'text' prefix that textedit adds
        let cleanPrompt = prompt.trim();
        if (cleanPrompt.startsWith('text ')) {
            cleanPrompt = cleanPrompt.substring(5); // Remove 'text ' (5 characters)
        }
        stableAudioPrompt = cleanPrompt;
        Max.post(`Prompt updated to: ${stableAudioPrompt}`);
    }
});

// Handler for stable-audio generation
Max.addHandler('generate_stable_audio', () => {
    if (isStableAudioProcessing) {
        Max.post('Stable audio generation already in progress...');
        return;
    }

    isStableAudioProcessing = true;
    Max.post(`Generating stable audio: "${stableAudioPrompt}" at ${currentBPM} BPM (CFG: ${stableCFG}, Steps: ${stableSteps})`);
    
    // Construct the full prompt with BPM
    const fullPrompt = `${stableAudioPrompt} ${currentBPM}bpm`;
    
    // Prepare the request payload with new parameters
    const requestData = JSON.stringify({
        prompt: fullPrompt,
        steps: stableSteps,        // Use user-selected steps
        cfg_scale: stableCFG,      // Use user-selected CFG
        return_format: "base64",
        seed: -1 // Random seed
    });

    // Configure the HTTP request using the configuration variables
    const options = {
        hostname: STABLE_AUDIO_HOST,
        port: STABLE_AUDIO_PORT,
        path: '/audio/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
        }
    };

    // Use the appropriate HTTP module based on configuration
    const httpModule = USE_HTTPS ? https : http;

    // Make the HTTP request
    const req = httpModule.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(responseData);
                
                if (response.success && response.audio_base64) {
                    // Convert base64 to buffer and save as myOutput.wav
                    const audioBuffer = Buffer.from(response.audio_base64, 'base64');
                    fs.writeFileSync('C:/g4l/myOutput.wav', audioBuffer);
                    
                    Max.post('Stable audio generation successful!');
                    Max.post(`Generated: ${response.metadata.generation_time}s (${response.metadata.realtime_factor}x RT)`);
                    
                    // Notify Max that audio is ready
                    Max.outlet('stable_audio_generated');
                    
                    // Clear any existing session since this is new audio
                    sessionID = null;
                    
                } else {
                    Max.post(`Stable audio generation failed: ${response.error || 'Unknown error'}`);
                    Max.outlet('error_message', `stable_audio|${response.error || 'Generation failed'}`);
                }
            } catch (error) {
                Max.post(`Error parsing stable audio response: ${error.message}`);
                Max.outlet('error_message', `stable_audio|Failed to parse response`);
            }
            
            isStableAudioProcessing = false;
        });
    });

    req.on('error', (error) => {
        Max.post(`Stable audio request error: ${error.message}`);
        Max.outlet('error_message', `stable_audio|${error.message}`);
        isStableAudioProcessing = false;
    });

    // Send the request
    req.write(requestData);
    req.end();
});



let modelPath = 'thepatch/vanya_ai_dnb_0.1'; // Default model path
let sessionID = null; // Variable to store the session ID
let isProcessing = false;
let promptDuration = 6; // Default prompt duration
let tameTheGaryEnabled = false; // New state variable for the toggle
let variationName = 'accordion_folk';  // Default variation

let isBackendConnected = false;

let currentFlowstep = 0.13; // Default flowstep value
let useMidpointSolver = false; // New state variable for the solver toggle

let lastProgressUpdate = 0;
let lastProgressTime = Date.now();
let progressTimeout = null;

Max.addHandler('set_solver', (value) => {
    useMidpointSolver = value === 1;
    Max.post(`Solver set to: ${useMidpointSolver ? 'midpoint' : 'euler (default)'}`);
});

Max.addHandler('set_flowstep', (value) => {
    // Convert the 0-127 range to 0.05-0.15 range
    if (typeof value === 'number') {
        currentFlowstep = 0.05 + (value / 127) * 0.10;
        currentFlowstep = Math.round(currentFlowstep * 1000) / 1000; // Round to 3 decimal places
        Max.post(`Flowstep updated to: ${currentFlowstep}`);
    }
});

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
        
        // Add memory monitoring
        const memBefore = process.memoryUsage();
        Max.post(`Memory before transform: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
        
        fs.readFile(audioPath, (err, data) => {
            if (err) {
                Max.post(`Error reading audio file: ${err}`);
                isProcessing = false;
                return;
            }
            
            try {
                // Check file size before processing
                const fileSizeMB = data.length / 1024 / 1024;
                Max.post(`Audio file size: ${fileSizeMB.toFixed(2)}MB`);
                
                if (fileSizeMB > 50) { // 50MB limit
                    Max.post('Audio file too large for transform');
                    isProcessing = false;
                    return;
                }
                
                const audioData_base64 = data.toString('base64');
                
                const request = {
                    audio_data: audioData_base64,
                    variation: variationName,
                    session_id: sessionID,
                    flowstep: currentFlowstep
                };

                // Only add solver parameter if midpoint is selected
                if (useMidpointSolver) {
                    request.solver = 'midpoint';
                    Max.post('Using midpoint solver (faster, 64 steps)');
                } else {
                    Max.post('Using default euler solver (higher quality, 25 steps)');
                }

                socket.emit('transform_audio_request', request);
                
                // Force garbage collection hint
                if (global.gc) {
                    global.gc();
                }
                
                // Log memory after processing
                const memAfter = process.memoryUsage();
                Max.post(`Memory after transform: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
                
            } catch (error) {
                Max.post(`Error processing transform: ${error.message}`);
                isProcessing = false;
            }
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

    // Add these socket listeners to handle queue events
    socket.on('queue_status', (data) => {
        // Always post the message
        Max.post(data.message);
        
        // Send queue metrics to Max outlets
        Max.outlet('queue_status', data.position, data.total_queued);
        Max.outlet('time_estimate', data.estimated_seconds);
        
        // Additional debug logging
        Max.post(`Debug - Position: ${data.position}, Total: ${data.total_queued}, Wait: ${data.estimated_seconds}s`);
    });
    
    socket.on('processing_started', (data) => {
        Max.post('Request is now being processed');
        // No need to change isProcessing, it should stay true
    });
    
    socket.on('queue_update', (data) => {
        Max.post(data.message);
        Max.outlet('queue_update', data.position, data.total_queued);
        if (data.estimated_seconds) {
            Max.outlet('time_update', data.estimated_seconds);
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
        clearTimeout(progressTimeout);
        lastProgressUpdate = data.progress;
        lastProgressTime = Date.now();
        Max.post(`progress update: ${data.progress}%`);
        Max.outlet('progress_update', data.progress);
        
        // Set timeout for next expected update
        progressTimeout = setTimeout(() => {
            if (Date.now() - lastProgressTime > 5000 && sessionID) { // Only if sessionID exists
                // Request progress status
                socket.emit('request_progress_status', {
                    session_id: sessionID,
                    last_progress: lastProgressUpdate
                });
            }
        }, 5000);
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
        
        // NEW: Forward session event to electron
        Max.outlet('update_cropped_audio_complete');
    });

    // Add new socket listener for transform response
    socket.on('audio_transformed', (data) => {
        isProcessing = false;
        Max.post('Audio transformation successful.');
        sessionID = data.session_id; // Update session ID
        const outputBuffer = Buffer.from(data.audio_data, 'base64');
        fs.writeFileSync('C:/g4l/myOutput.wav', outputBuffer);
        Max.outlet('audio_transformed');
        Max.outlet('progress_update', 100);
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
        Max.outlet('error_message', 'processing|Still processing previous request, wait a sec...');
        Max.post('Processing already in progress.');
        return;
    }
    
    if (!sessionID) {
        // NEW: Check if we have output audio to continue from (Jerry case)
        const outputAudioPath = 'C:/g4l/myOutput.wav';
        
        if (fs.existsSync(outputAudioPath)) {
            Max.post('No session found, but output audio exists. Creating session and continuing...');
            
            // Read the output audio and send as new session
            fs.readFile(outputAudioPath, (err, data) => {
                if (err) {
                    Max.post(`Error reading output file for continue: ${err}`);
                    Max.outlet('error_message', 'no_session|no audio available to continue from.');
                    return;
                }
                
                const audioData_base64 = data.toString('base64');
                
                const request = {
                    audio_data: audioData_base64,  // Send the Jerry audio
                    model_name: modelPath,
                    prompt_duration: promptDuration
                    // No session_id - will be auto-created
                };

                // Add Gary-taming parameters if enabled
                if (tameTheGaryEnabled) {
                    request.top_k = 150;
                    request.cfg_coef = 5;
                    request.description = "drums, percussion";
                }

                socket.emit('continue_music_request', request);
                isProcessing = true;
                
                setTimeout(() => {
                    isProcessing = false;
                }, timeoutDuration);
            });
            
            return;
        } else {
            // No session and no output audio - show original error
            Max.outlet('error_message', 'no_session|no audio in the session to continue yet, homie. press bang first.');
            Max.post('No session available - need to press bang first.');
            return;
        }
    }

    // Existing logic for when session exists
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
