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

var CONF;

// CONFIG Load 
//
function loadConfig() 
{
    CONF = {}
    if (fs.existsSync('config.json')) {
        const config = JSON.parse(fs.readFileSync('config.json'));
        CONF = {...CONF, ...config};
    }
    else {
        console.log('No config file found..');
        exit(1);
    }

    // Precompute scale ratios
    for(const key in CONF.screens) {
        
        if (!CONF.screens[key]['resolution']) {
            console.error('You must set the "resolution" for each screen in config.json');
            process.exit(1);
        }
        if (!CONF.screens[key]['search']) {
            console.error('You must set the "search" string for each screen in config.json');
            process.exit(1);
        }
        if (!CONF.screens[key]['target']) {
            console.error('You must set the "target" name for each screen in config.json');
            process.exit(1);
        }
        if (!CONF.screens[key]['v_scale']) CONF.screens[key]['v_scale'] = 1;
        if (!CONF.screens[key]['h_scale']) CONF.screens[key]['h_scale'] = 1;
        if (!CONF.screens[key]['player']) CONF.screens[key]['player'] = CONF.screens[key]['resolution']
        if (!CONF.screens[key]['align']) CONF.screens[key]['align'] = "center";
        if (!CONF.screens[key]['force']) CONF.screens[key]['force'] = false;

        // Crop Ratio
        CONF.screens[key]['cropratio'] = CONF.screens[key]['resolution'][0] / CONF.screens[key]['resolution'][1]; 
    }

    if (!CONF.path || !fs.existsSync(CONF.path)) {
    console.error('You must set a valid "path" in config.json');
    process.exit(1);
    }
}
loadConfig()

// Find FFMPEG
//
var ffmpeg = 'ffmpeg';

// Convert file
//
function processFile(filePath) 
{
    // valid
    if (!filePath) return;
    const filename = path.basename(filePath);
    const folder = path.dirname(filePath);
    if (!fs.existsSync(filePath)) return;

    // process each screen
    for (const key in CONF.screens) 
    {
        const screen = CONF.screens[key];
        if (!filename.includes(screen.search)) continue;

        // Skip if target file already exists
        const outputFilename = filename.replace(screen.search, screen.target);
        const outputPath = path.join(folder, outputFilename);
        if (fs.existsSync(outputPath) && !CONF.force && !screen.force) continue;  

        console.log(`------\nConverting ${filePath} to ${outputPath}\n`);
        
        // Crop Ratio inside original file
        const ratio = screen.cropratio;
        var crop = `\
        w='if(gt(a,${ratio}),ih*${ratio},iw)':
        h='if(gt(a,${ratio}),ih,iw/${ratio})':
        x='(iw-min(iw,ih*${ratio}))/2':
        y='(ih-min(ih,iw/${ratio}))/2'`
        
        // Scale to target resolution
        const scale = screen.resolution[0]*CONF.screens[key]['h_scale'] + ':' + screen.resolution[1]*CONF.screens[key]['v_scale'];
        
        // Pad to output resolution
        var pad;
        if (screen.align == "origin") 
            pad = `${screen.player[0]}:${screen.player[1]}:0:0:black`;
        else if (screen.align == "center") 
            pad = `${screen.player[0]}:${screen.player[1]}:(ow-iw)/2:(oh-ih)/2:black`;
        
        // Execute
        execSync(`ffmpeg -y -i "${filePath}" -vf "crop=${crop},scale=${scale},setsar=1/1,pad=${pad}" -c:a aac -b:a 128k -ar 44100 -c:v libx264 -profile:v main -level:v 4.1 -b:v 8M -maxrate 10M -bufsize 12M -tune fastdecode -g 50 -keyint_min 25 -metadata:s:v:0 "pixel_aspect=1/1" -movflags +faststart -x264-params "no-scenecut=1:nal-hrd=cbr" -pix_fmt yuv420p "${outputPath}"`);
        console.log(`Converted file ${outputFilename} in ${scale} pixels`);
    }
}

// Recursive folder processing
//
function processFolder(folder) 
{
    fs.readdirSync(folder).forEach(file => {
        
        const filePath = path.join(folder, file);
        
        // ignore hidden / conflict files
        if (file.startsWith('.')) return;
        if (file.includes('sync-conflict')) return;

        // process
        if (fs.lstatSync(filePath).isDirectory()) processFolder(filePath);
        else processFile(filePath);
    });
}

var isRunning = false;
var scheduledRun = null;

// Run (periodic)
//
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
    
    console.log('\nDONE.\n');
    isRunning = false;
    
    // disable forced run after first run
    CONF.force = false;
    for (const key in CONF.screens) CONF.screens[key].force = false;
    
    if (CONF.retry > 0) {
        console.log('Waiting for next run in '+CONF.retry+' minutes (press key to trigger manually)');
        scheduledRun = setTimeout(run, CONF.retry*60*1000);
    }
}

// If force is set in config, prompt confirmation
let force = CONF.force;
for (const key in CONF.screens) force = force || CONF.screens[key].force;
if (force) {
    console.log('WARNING: Force mode is enabled in config.json');
    console.log('\tIt will force conversion of all files, even if target file already exists.');
    console.log('\tDo you confirm? (y/n)');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('', (answer) => {
        rl.close();
        if (answer != 'y') {
            console.log('Change config.json to disable force mode.');
            process.exit();
        }
    });
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

run();

