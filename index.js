import fetch from 'node-fetch';
import { createInterface } from 'readline';
import fs, { read } from 'fs';
import { dirname } from 'path';
const rootFolder = dirname(import.meta.url);

const config = JSON.parse(fs.readFileSync('config.json'));

const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Scan barcode or enter name manually:\n'
});

async function getVinylInfo(name) {
    const url = `https://api.discogs.com/database/search?query=${name}&format=Vinyl&token=${config.token}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.results.length === 0) {
        return {
            name: name,
        };
    } else {
        const releaseId = data.results[0].id;
        const releaseUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}?token=${config.token}`;
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
    // Display the prompt and wait for the user to enter a barcode
    readline.prompt();
    readline.on('line', name => {
        // Fetch and display the vinyl record information
        if (name === "/list") {
            console.log(listRecords(function () { readline.prompt(); }));
        } else if (name.includes("/find")) {
            const query = name.split(' ').slice(1).join(' ');
            searchRecords(query, function () {
                readline.prompt();
            });
        } else if (name.includes("/delete")) {
            const query = name.split(' ').slice(1).join(' ');
            deleteRecord(query, function () {
                readline.prompt();
            });
        } else {
            getVinylInfo(name).then(info => {
                prosess(info, function () {
                    readline.prompt();
                });
            });
        }
    });
}

function searchRecords(query, cb) {
    fs.readFile(config.path, (err, data) => {
        if (err) throw err;
        const records = JSON.parse(data);
        const results = records.filter(record => {
            return record.name.toLowerCase().includes(query.toLowerCase()) ||
                record.result.title.toLowerCase().includes(query.toLowerCase()) ||
                record.result.country.toLowerCase().includes(query.toLowerCase()) ||
                record.result.year.toString().includes(query) ||
                record.result.label.some(label => label.toLowerCase().includes(query.toLowerCase())) ||
                record.result.genre.some(genre => genre.toLowerCase().includes(query.toLowerCase())) ||
                record.result.style.some(style => style.toLowerCase().includes(query.toLowerCase()));
        });
        console.log(results.length + ` result(s) for query "${query}":`);
        for (let i = 0; i < results.length; i++) {
            const record = results[i];
            console.log("----------------------------------------");
            console.log(`Barcode: ${record.name}`);
            console.log(`Title: ${record.result.title}`);
            console.log(`Country: ${record.result.country}`);
            console.log(`Year: ${record.result.year}`);
            console.log(`Genre: ${record.result.genre}`);
            console.log(`Style: ${record.result.style}`);
            console.log(`Format: ${record.result.format}`);
            console.log("PRICES:");
            Object.entries(record.price).forEach(([key, value]) => {
                const price = `${key}: ${value.value} ${value.currency}`;
                console.log(price);
            });
            if (i == results.length - 1) {
                cb();
            }
        }
    });
}

function listRecords(cb) {
    fs.readFile(config.path, (err, data) => {
        if (err) throw err;
        const records = JSON.parse(data);
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            console.log('--------------------------------------------------');
            console.log(`Barcode: ${record.name}`);
            console.log(`Title: ${record.result.title}`);
            console.log(`Country: ${record.result.country}`);
            console.log(`Year: ${record.result.year}`);
            console.log(`Genre: ${record.result.genre}`);
            console.log(`Style: ${record.result.style}`);
            console.log(`Format: ${record.result.format}`);
            console.log("PRICES:");
            Object.entries(record.price).forEach(([key, value]) => {
                const price = `${key}: ${value.value} ${value.currency}`;
                console.log(price);
            });
            if (i == records.length - 1) {
                cb();
            }
        }
    });
}


function deleteRecord(name, cb) {
    fs.readFile(config.path, (err, data) => {
        if (err) throw err;
        const records = JSON.parse(data);
        const recordToDelete = records.find(record => record.name === name);
        if (recordToDelete) {
            console.log(`Are you sure you want to delete the record with barcode "${name}"? (y/n)`);
            process.stdin.once('data', data => {
                readline.clearLine(process.stdout, 0);
                const input = data.toString().trim().toLowerCase();
                if (input === 'y' || input === 'yes') {
                    // Remove the record from the array
                    const updatedRecords = records.filter(record => record.name !== name);
                    fs.writeFile(config.path, JSON.stringify(updatedRecords), (err) => {
                        if (err) throw err;
                        console.log('Record deleted from records.json');
                        cb();
                    });
                } else {
                    console.log('Record not deleted');
                    cb();
                }
            });
        } else {
            console.log(`Record with barcode "${name}" not found in records.json`);
            cb();
        }
    });
}

function prosess(info, cb) {
    console.log("------------------ " + info.name + " ------------------")
    if (info.result === undefined) {
        fs.readFile(config.path, (err, data) => {
            let records;
            try {
                records = JSON.parse(data);
            } catch (e) {
                records = [];
            }
            // Check if the custom record already exists in the array
            const recordExists = records.some(record => record.name === info.name);
            if (recordExists) {
                console.log(`Record with barcode ${info.name} already exists in records.json`);
                cb();
            } else {
                console.log('Result is undefined. Do you want to create a custom record? (y/n)');
                process.stdin.once('data', data => {
                    readline.clearLine(process.stdout, 0);
                    const input = data.toString().trim().toLowerCase();
                    if (input === 'y' || input === 'yes') {
                        readline.question('Enter the title: ', title => {
                            readline.question('Enter the price: ', price => {
                                const customRecord = { name: info.name, title, price };
                                records.push(customRecord);
                                fs.writeFile(config.path, JSON.stringify(records), (err) => {
                                    if (err) throw err;
                                    console.log('Custom record saved to records.json');
                                    cb();
                                });
                            });
                        });
                    } else {
                        console.log('Custom record not created');
                        cb();
                    }
                });
            }
        });
    } else {
        console.log(`Title: ${info.result.title}`);
        console.log(`Country: ${info.result.country}`);
        console.log(`Year: ${info.result.year}`);
        console.log(`Genre: ${info.result.genre}`);
        console.log(`Style: ${info.result.style}`);
        console.log(`Format: ${info.result.format}`);
        console.log("PRICES:");
        Object.entries(info.price).forEach(([key, value]) => {
            const price = `${key}: ${value.value} ${value.currency}`;
            console.log(price);
        });
        fs.readFile(config.path, (err, data) => {
            let records;
            try {
                records = JSON.parse(data);
            } catch (e) {
                records = [];
            }
            // Check if the record is already in the array
            const recordExists = records.some(record => record.name === info.name);
            if (recordExists) {
                console.log(`Record with barcode ${info.name} already exists in records.json`);
                cb();
            } else {
                // Prompt the user to confirm writing the record
                console.log(`Save record with barcode ${info.name} to records.json? (y/n)`);
                process.stdin.once('data', data => {
                    readline.clearLine(process.stdout, 0);
                    const input = data.toString().trim().toLowerCase();
                    if (input === 'y' || input === 'yes') {
                        // Add the record to the array
                        records.push(info);
                        fs.writeFile(config.path, JSON.stringify(records), (err) => {
                            if (err) throw err;
                            console.log('Record saved to records.json');
                            cb();
                        });
                    } else {
                        console.log('Record not saved');
                        cb();
                    }
                });
            }
        });
    }
}

search();