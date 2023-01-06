import fetch from 'node-fetch';
import { createInterface } from 'readline';
import fs, { read } from 'fs';

const config = JSON.parse(fs.readFileSync('config.json'));

const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Scan barcode or enter name manually:\n'
});

const RATE_LIMIT = 1000 / 40; // 40 requests per second
let lastRequestTime = 0;

async function rateLimitedFetch(url) {
    const delay = Math.max(RATE_LIMIT - (Date.now() - lastRequestTime), 0);
    await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestTime = Date.now();
    const response = await fetch(url);
    return response;
}


async function getVinylInfo(name) {
    const url = `https://api.discogs.com/database/search?query=${name}&format=Vinyl&token=${config.token}`;
    const response = await rateLimitedFetch(url);
    const data = await response.json();
    if (data.results.length === 0) {
        return {
            name: name,
        };
    } else {
        const releaseId = data.results[0].id;
        const releaseUrl = `https://api.discogs.com/releases/${releaseId}?token=${config.token}`;
        const releaseResponse = await rateLimitedFetch(releaseUrl);
        const releaseData = await releaseResponse.json();
        const priceUrl = `https://api.discogs.com/marketplace/price_suggestions/${releaseId}?token=${config.token}`;
        const priceResponse = await rateLimitedFetch(priceUrl);
        const priceData = await priceResponse.json();
        return {
            name: name,
            result: data.results[0],
            songs: releaseData.tracklist,
            price: priceData,
        };
    }
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
        } else if (name.includes("/sort")) {
            sortGenre(function () {
                readline.prompt();
            });
        } else if (name.includes("/delete")) {
            const query = name.split(' ').slice(1).join(' ');
            deleteRecord(query, function () {
                readline.prompt();
            });
        } else if (name.includes("/update")) {
            addSongsToData();
        } else if (name == "") {
            readline.prompt();
        } else {
            getVinylInfo(name).then(info => {
                prosess(info, function () {
                    readline.prompt();
                });
            });
        }
    });
}

function sortGenre(cb) {
    fs.readFile(config.path, (err, data) => {
        if (err) throw err;
        const records = JSON.parse(data);
        records.sort(function (a, b) {
            if (a.result.genre[0] < b.result.genre[0]) {
                return -1;
            }
            if (a.result.genre[0] > b.result.genre[0]) {
                return 1;
            }
            return 0;
        });
        let genreCount = new Set(records.map(record => record.result.genre[0])).size;
        // Print the sorted records
        records.forEach(function (record, i) {
            console.log(record.result.title + ': ' + record.result.genre[0]);
            if (i == records.length - 1) {
                console.log("Sorted " + records.length + " records to " + genreCount + " differend genres.")
                cb();
            }
        });
    });
}

function searchRecords(query, cb) {
    fs.readFile(config.path, (err, data) => {
        if (err) throw err;
        const records = JSON.parse(data);
        const results = records.filter(record => {
            return (record.name && record.name.toLowerCase().includes(query.toLowerCase())) ||
                (record.result.title && record.result.title.toLowerCase().includes(query.toLowerCase())) ||
                (record.result.country && record.result.country.toLowerCase().includes(query.toLowerCase())) ||
                (record.result.year && record.result.year.toString().includes(query)) ||
                (record.result.label && record.result.label.some(label => label.toLowerCase().includes(query.toLowerCase()))) ||
                (record.result.genre && record.result.genre.some(genre => genre.toLowerCase().includes(query.toLowerCase()))) ||
                (record.result.style && record.result.style.some(style => style.toLowerCase().includes(query.toLowerCase())));
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
        const totalPrices = getTotalPrices(records);
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
                console.log(`Listed ${records.length} records.`);
                console.log('\x1b[31m%s\x1b[0m', '-------------------------Total prices-------------------------');
                for (const condition in totalPrices) {
                    console.log('\x1b[31m%s\x1b[0m', `${condition}: ${totalPrices[condition]}`);
                }
                console.log('\x1b[31m%s\x1b[0m', '--------------------------------------------------------------');
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

function getTotalPrices(records) {
    // Initialize an object to store the total prices for each condition
    const totalPrices = {};

    // Iterate over the records and add the price of each record to the total price for each condition
    records.forEach(function (record) {
        for (const condition in record.price) {
            if (!totalPrices[condition]) {
                totalPrices[condition] = 0;
            }
            totalPrices[condition] += record.price[condition].value;
        }
    });

    return totalPrices;
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
                                const customRecord = {
                                    "name": info.name,
                                    "result": {
                                        "country": "Custom Record",
                                        "year": "2017",
                                        "format": [
                                            "Vinyl",
                                            "LP",
                                            "Compilation"
                                        ],
                                        "label": [
                                            "Shady Records",
                                            "Aftermath Entertainment",
                                            "Interscope Records",
                                            "Universal International Music B.V."
                                        ],
                                        "type": "release",
                                        "genre": [
                                            "Custom"
                                        ],
                                        "style": [],
                                        "id": 10354932,
                                        "barcode": [
                                            "602557383362",
                                            "6 02557 38336 2"
                                        ],
                                        "user_data": {
                                            "in_wantlist": false,
                                            "in_collection": false
                                        },
                                        "master_id": 1160826,
                                        "master_url": "https://api.discogs.com/masters/1160826",
                                        "uri": "/release/10354932-50-Cent-Best-Of",
                                        "catno": "602557383362",
                                        "title": title,
                                        "thumb": "https://i.discogs.com/S2Tp7kfsEIkhb1CJUgs_eCcnDC_3lxNNfvEFeSQFEpQ/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEwMzU0/OTMyLTE2NDAzNzYx/NzctODEwNi5qcGVn.jpeg",
                                        "cover_image": "https://i.discogs.com/LJeD5iQ5tYX0vDK_Znp02SZZXAPMGmB2M8Z0zgIDO78/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEwMzU0/OTMyLTE2NDAzNzYx/NzctODEwNi5qcGVn.jpeg",
                                        "resource_url": "https://api.discogs.com/releases/10354932",
                                        "community": {
                                            "want": 183,
                                            "have": 1412
                                        },
                                        "format_quantity": 2,
                                        "formats": [
                                            {
                                                "name": "Vinyl",
                                                "qty": "2",
                                                "descriptions": [
                                                    "LP",
                                                    "Compilation"
                                                ]
                                            }
                                        ]
                                    },
                                    "price": {
                                        "Mint (M)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Near Mint (NM or M-)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Very Good Plus (VG+)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Very Good (VG)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Good Plus (G+)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Good (G)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Fair (F)": {
                                            "currency": "EUR",
                                            "value": price
                                        },
                                        "Poor (P)": {
                                            "currency": "EUR",
                                            "value": price
                                        }
                                    }
                                };
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

async function addSongsToData() {
    const data = JSON.parse(fs.readFileSync(config.path));
    const modifiedData = data.map(async (release) => {
        const releaseId = release.id;
        const releaseUrl = `https://api.discogs.com/releases/${releaseId}?token=${config.token}`;
        const releaseResponse = await rateLimitedFetch(releaseUrl);
        const releaseData = await releaseResponse.json();
        console.log("Prosessing: " + release.result.title);
        return {
            ...release,
            songs: releaseData.tracklist,
        };
    });
    const updatedData = await Promise.all(modifiedData);
    fs.writeFileSync(config.path, JSON.stringify(updatedData));
    console.log("Added new songs!")
}

search();