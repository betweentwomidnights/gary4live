const path = require('path');
const Max = require('max-api');
const { PythonShell } = require('python-shell');

let modelPath = 'facebook/musicgen-small';  // default model path
let isInitialized = false;

// Post a message to the Max console when the script is loaded
Max.post(`Loaded the ${path.basename(__filename)} script`);

// Initialization function
Max.addHandler('script_start', () => {
    isInitialized = true;
    Max.post("Script initialized.");
});

// Function to handle 'text' message and argument from Max
Max.addHandler('text', (newModelPath) => {
    modelPath = newModelPath;
    Max.post(`Received text, setting modelPath to: ${modelPath}`);
});

// Function to handle 'bang' message from Max
Max.addHandler('bang', () => {
    Max.post(`Received bang, running Python script using modelPath: ${modelPath}`);
    processAudio();
});

// Function to process audio
function processAudio() {
    const scriptPath = "C:/gary4live/g4l.py";
    const pythonPath = 'C:/gary4live/g4l/Scripts/python';

    let options = {
        mode: 'text',
        pythonPath: pythonPath,
        scriptPath: path.dirname(scriptPath),
        args: [modelPath]
    };

    PythonShell.run(path.basename(scriptPath), options, function (err, results) {
        if (err) {
            Max.post(`PythonShell error: ${err}`);
            Max.outlet('error', err.toString());
            return;
        }

        Max.post(`PythonShell success, results: ${results}`);
        Max.outlet('success');
    });
}
