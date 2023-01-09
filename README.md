## Use Cases

This program is most useful for vinyl record collectors who want to access and manage information about their collection. 
The program allows the user to search for records by name or barcode, view a list of saved records, sort records by genre, delete records from the list, and add song information to records. 
In addition, the program allows the user to create custom records for items that are not found in the Discogs database.

If you are a vinyl record collector with nodejs knowledge looking for a not really an easy way to manage your collection, this program may be useful for you.

## Viewing Your Collection on the Web

In addition to using the command-line interface (CLI) program to access and manage your vinyl record collection, you also have the option to view your collection on the web. 
There is a website template located in the `www` folder that you can host on a web server and access from anywhere.

To use the website template:

1. Host the contents of the `www` folder on a web server
2. Set the path in the `config.json` file in the root directory of the CLI program to the folder where you are hosting the website template.

With the website template, you will have access to your collection at all times and can easily search your records from any device with an internet connection. You can find mine at [r3ne.net/records](https://r3ne.net/records/).

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. 

### Prerequisites

- Node.js
- npm
- A Discogs API token (sign up for a free account at [discogs.com/developers/](https://www.discogs.com/developers/))

### Installing
1. Clone repo
2. Install dependencies by running InstallModules.bat
3. Create a `config.json` file in the root directory and add your Discogs API token
```json
{
  "token": "discogs-token",
  "path": "records.json"
}
```
4. Start the program by running Run.bat
5. Add records!!
6. Give up because this documentation is very poor


## Using the Program

- To add a vinyl record, enter the name or scan the barcode when prompted
- To view a list of saved records, enter `/list`
- To search for a record within your collection, enter `/find` followed by the search query
- To sort the records by genre, enter `/sort`
- To delete a record from the list, enter `/delete` followed by the record name

## Built With

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Discogs API](https://www.discogs.com/developers/) - Used to retrieve information about vinyl records





