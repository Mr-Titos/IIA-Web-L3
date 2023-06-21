const fs = require('fs');

const logger = async function log(data) {
    const textToWrite = `${new Date().toLocaleString()} : ${data}`;
  fs.appendFile('logs.txt', textToWrite + '\n', (err) => {
        if (err)
            console.error('Error while writing logs :', err);
        else
            console.log(textToWrite);
  });
}

module.exports = logger;