# gary4live

this is gary4live. gary iterates on input audio using max for live and musicgen.

 there is an installer for pc as well as for mac, but if you would rather build it yourself, it's really easy.

## update jan 12 2025
### gary's now got a lil buddy inside him...terry

![gary4live](./gary4live%20screenshot.png)

meta's new melodyflow model (terry) can be used inside this device now to transform input audio. it generates audio the same length as the input. you can have terry transform your recorded buffer or the outputs gary gives back (up to ~40 secs). terry's got 'presets' you can choose from.

https://huggingface.co/spaces/facebook/melodyflow (you can play with terry here too)

this repo was designed for the root directory to be placed in C:\\g4l for maximum simplicity. dynamic filepaths are a pain in the ass in the max for live gui. sry.

these paths can be changed with some effort (more instructions at the bottom)

you'll need to install node first. it's not too bad.

https://nodejs.org/en/download/

ffmpeg is needed for cropping to work. it can be a littler harder to install on windows. you may have to update your environment variables. ask claude (lol)

https://ffmpeg.org/download.html



clone this repository:

```
git clone https://github.com/betweentwomidnights/gary4live
```

Rename the directory:

```
mv gary4live g4l
```

Navigate to the `g4l-ui` directory:

```
cd C:\g4l\g4l-ui
```

Install the required packages:

```
npm install
```

To start the application in development mode:

```
npm run start
```

To create the executable that the '2(launch electron)' button triggers in gary4live:

```
npm run package
```

in the ableton browser, add the g4l folder.  

GARY.amxd is the device.

if you want to change filepaths, the two buttons in the m4l gui need to be changed, as well as all the filepaths for myBuffer.wav and myOutput.wav in 'electron-communication.js' and 'commentedout.js'

warning: you are going to give yourself headaches. max rly likes to gaslight.

the final remaining edge cases revolve around these two files: myBuffer.wav and myOutput.wav. if generations get stuck at 80%, or you do not see the 'write' button actually changing myBuffer.wav, you have hit this issue with permissions. using this on mac has produced such errors. 

do NOT:

- drag them into the ableton timeline.
- manually change myBuffer.wav to a 6 minute audio file. it should only be changed by our write function and should be a maximum of 30 seconds.

if you rly wanna learn how to use this thing, head to discord https://discord.gg/VECkyXEnAd and yell at me, or go to https://youtube.com/@thepatch_dev

there is a separate repository for the mac front-end (https://github.com/betweentwomidnights/gary-mac)

demo of the device being used here:

[![demo video](https://img.youtube.com/vi/ZqgcRiAlrHQ/0.jpg)](https://www.youtube.com/watch?v=0plq4OV0ECY)

the backend for this device can be run locally using docker-compose. (https://github.com/betweentwomidnights/gary-backend-combined)
