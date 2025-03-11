// NodeJS script that watch a folder recursively, find all video files containing _LED_ in their name, and convert them to a format that can be used by the LED matrix.
// The script will output the converted files in the same folder, with the same name but replacing _LED_ by _LED256_ in the filename.
// Files are skipped if target _LED256_ file already exists.

// THe conversion is done by ffmpeg.
// Output file must be 800x600 pixels, with original file as a 256x256 pixels square in the top left corner.

// Usage: node convert.js <folder>
// Example: node convert.js /data

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { exit } from 'process';
import readline from 'readline';

var CONF= {
    'path': null,
    'pattern': '_LED_',
    'force': false,
    'output': [1920,1080],
    'screens': {
        '256': [256, 256, 0.5],
        '512': [512, 512, 0.5],
    },
    'retry': 15
}

// load 
if (fs.existsSync('config.json')) {
    const config = JSON.parse(fs.readFileSync('config.json'));
    CONF = {...CONF, ...config};
}
else {
    console.log('No config file found..');
    exit(1);
}

// Precompute scale ratios
Object.keys(CONF.screens).forEach((key) => {
    if (CONF.screens.length < 3) CONF.screens[key].push(1); // 1:1
    CONF.screens[key][3] = CONF.screens[key][0]*CONF.screens[key][2] / CONF.screens[key][1]; // Crop Ratio
});


if (!CONF.path) {
  console.error('You must set the folder path in config.json');
  process.exit(1);
}

function processFile(filePath) {
    if (!filePath) return;
    
    const filename = path.basename(filePath);
    const folder = path.dirname(filePath);
    if (!fs.existsSync(filePath)) return;

    // Ignore files that do not contain CONF.searchfor
    if (!filename.includes(CONF.searchfor)) return;

    // Ignore files that already have a LED resolution
    for (const key of Object.keys(CONF.screens))
        if (filename.includes(`_LED${key}_`)) return;

    // Rescale
    Object.keys(CONF.screens).forEach((key) => {
        const outputFilename = filename.replace('_LED_', `_LED${key}_`);
        const outputPath = path.join(folder, outputFilename);

        // Skip if target file already exists
        if (fs.existsSync(outputPath) && !CONF.force) return;  

        console.log(`Converting ${filePath} to ${outputPath}`);
        const scale = CONF.screens[key];

        var crop = `crop=in_h*${scale[3]}:in_h:(in_w-in_h*${scale[3]})/2:0`;
        if (scale[3] > 1) crop = `crop=in_w:in_w/${scale[3]}:0:(in_h-in_w/${scale[3]})/2`;

        execSync(`ffmpeg -y -i "${filePath}" -vf "${crop},scale=${scale[0]}:${scale[1]},setsar=1/1,pad=${CONF.output[0]}:${CONF.output[1]}:0:0:black" "${outputPath}"`);
        console.log(`Converted file ${outputFilename} in ${scale[0]}x${scale[1]} pixels`);
    
    });
}

function processFolder(folder) 
{
    
    fs.readdirSync(folder).forEach(file => {
        
        // ignore hidden files
        const filePath = path.join(folder, file);
        
        if (fs.lstatSync(filePath).isDirectory()) {
            // if hidden folder, ignore
            if (file.startsWith('.')) {
                // console.log(`Ignoring hidden folder ${file}`);
                return;
            }
            processFolder(filePath);
        }
        else {
            // ignore hidden files
            if (file.startsWith('.')) {
                // console.log(`Ignoring hidden file ${file}`);
                return;
            }
            processFile(filePath);
        }
    });
    
    
}

var isRunning = false;
var scheduledRun = null;

function run() {
    if (scheduledRun) clearTimeout(scheduledRun);
    if (isRunning) {
        console.log('Already running..');
        return;
    }
    isRunning = true;
    console.log(`------------------------`);
    console.log(" ▗▄▖ ▗▖ ▗▖▗▄▄▄▖▗▄▖  ▗▄▄▖ ▗▄▖ ▗▖  ▗▖▗▖  ▗▖▗▄▄▄▖▗▄▄▖▗▄▄▄▖▗▄▄▄▖▗▄▄▖ ")
    console.log("▐▌ ▐▌▐▌ ▐▌  █ ▐▌ ▐▌▐▌   ▐▌ ▐▌▐▛▚▖▐▌▐▌  ▐▌▐▌   ▐▌ ▐▌ █  ▐▌   ▐▌ ▐▌")
    console.log("▐▛▀▜▌▐▌ ▐▌  █ ▐▌ ▐▌▐▌   ▐▌ ▐▌▐▌ ▝▜▌▐▌  ▐▌▐▛▀▀▘▐▛▀▚▖ █  ▐▛▀▀▘▐▛▀▚▖")
    console.log("▐▌ ▐▌▝▚▄▞▘  █ ▝▚▄▞▘▝▚▄▄▖▝▚▄▞▘▐▌  ▐▌ ▝▚▞▘ ▐▙▄▄▖▐▌ ▐▌ █  ▐▙▄▄▖▐▌ ▐▌")
    console.log("                                                                 ")
    console.log("                                                                 ")
    console.log("RUN: ");
    Object.keys(CONF).forEach((key) => {
        console.log(`${key.padEnd(10)}: ${JSON.stringify(CONF[key])}`);
    })

    processFolder(CONF.path);
    
    console.log('DONE.\n');
    console.log('Waiting for next run in '+CONF.retry+' minutes (press key to trigger manually)');
    isRunning = false;
    scheduledRun = setTimeout(run, CONF.retry*60*1000);
}

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if ((key.ctrl && key.name === 'c') || (key.name === 'q')) {
        console.log('Exiting..');
        process.exit();
    } else {
        run();
    }
})

// initial processing
run()

