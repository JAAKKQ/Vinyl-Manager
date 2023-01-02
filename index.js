import fetch from 'node-fetch';
import { createInterface } from 'readline';
import fs from 'fs';
import SerialPort from 'serialport';
import http from 'http';

const config = JSON.parse(fs.readFileSync('config.json'));

async function getVinylInfo(barcode) {
    const url = `https://api.discogs.com/database/search?barcode=${barcode}&key=${config.key}&secret=${config.secret}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.results.length === 0) {
        return {
            barcode: 'No record found with barcode: ' + barcode,
        };
    } else {
        const releaseId = data.results[0].id;
        const releaseUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}?key=${config.key}&secret=${config.secret}`;
        const releaseResponse = await fetch(releaseUrl);
        const releaseData = await releaseResponse.json();
        return {
            barcode: barcode,
            result: data.results[0],
            price: releaseData
        };
    };
}

async function getVinylByName(name) {
    const url = `https://api.discogs.com/database/search?query=${name}&key=${config.key}&secret=${config.secret}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.results.length === 0) {
        return {
            name: 'No record found with name: ' + name,
        };
    } else {
        const releaseId = data.results[0].id;
        const releaseUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}?key=${config.key}&secret=${config.secret}`;

        const releaseResponse = await fetch(releaseUrl);
        const releaseData = await releaseResponse.json();
        return {
            name: name,
            result: data.results[0],
            price: releaseData
        };
    };
}


function search() {
    // Set up the readline interface
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Scan barcode or enter name manually:\n'
    });

    // Display the prompt and wait for the user to enter a barcode
    readline.prompt();
    readline.on('line', name => {
        // Fetch and display the vinyl record information
        getVinylByName(name).then(info => {
            prosess(info);
            // Redisplay the prompt
            readline.prompt();
        });
    });
}

function prosess(info) {
    console.log("------------------ " + info.barcode + " ------------------")
    try {
        console.log(info.result.title);
        console.log(info.price);
        fs.readFile('records.json', (err, data) => {
            let records;
            try {
                records = JSON.parse(data);
            } catch (e) {
                records = [];
            }

            // Check if the record is already in the array
            const recordExists = records.some(record => record.barcode === info.barcode);
            if (recordExists) {
                console.log(`Record with barcode ${info.barcode} already exists in records.json`);
                return;
            }

            // Add the record to the array
            records.push(info);
            fs.writeFile('records.json', JSON.stringify(records), (err) => {
                if (err) throw err;
                console.log('Record saved to records.json');
            });
        });
    } catch { }
}


try {
    // Set up the serial port
    const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 9600 });

    // Listen for data from the serial port
    port.on('data', data => {
        const barcode = data.toString().trim();
        // Use the barcode to search for the vinyl record
        getVinylInfo(barcode).then(info => {
            prosess(info);
            // Start prompting the user for a barcode again
            search();
        });
    });
} catch (error) {
    console.error(`Error opening serial port: ${error.message}`);
    // Start prompting the user for a barcode
    search();
}

// Set up the HTTP server
// Set up the HTTP server
const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            // Use the barcode from the POST request body to search for the vinyl record
            getVinylInfo(body).then(info => {
                prosess(info);
            });
            res.end('Success');
        });
    } else {
        res.end('Error: Invalid request method');
    }
});

server.listen(80);
