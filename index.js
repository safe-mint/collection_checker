const Web3 = require('web3');
const Airtable = require('airtable');
require('dotenv').config();
const { AIRTABLE_API_KEY, AIRTABLE_BASE } = process.env; 

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE);

// using Promises with Airtable https://github.com/11ty/eleventy/issues/1122
// maybe try Async Airtable https://asyncairtable.com/
async function getAllCollections(base) {
    return new Promise((resolve, reject) => {
        const collections = []
        base('Collections').select({
            view: "Grid view"
        }).eachPage(function page(records, fetchNextPage) {
            // This function (`page`) will get called for each page of records.
        
            records.forEach(function(record) {
                collections.push(record);
            });
        
            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.
            fetchNextPage();
        
        }, function done(err) {
            console.log("done!")
            if (err) {
                reject(err);
            } else {
                resolve(collections);
            }
        });
    })
}

const collection = getAllCollections(base);

collection.then(records => {
    console.log(records[0].get("Name"))
})


class CollectionChecker {
  web3;
  account;

  constructor(projectId, account) {
      this.web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + projectId));
  }

  async checkCollections(address) {
    address = address.toLowerCase();
    for (const collection of COLLECTIONS) {
      const abi = JSON.parse(collection[2]);
      const contract = new this.web3.eth.Contract(abi, collection[1]); // (abi, contract_address)
      //contract.defaultAccount = this.account
      const balance = await contract.methods.balanceOf(address).call()
      console.log(address + " has " + balance + " " + collection[0]);

    }
  }
}

class TransactionChecker {
    web3;
    account;

    constructor(projectId, account) {
        this.web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + projectId));
        this.account = account.toLowerCase();
    }

    async checkBlock() {
        let block = await this.web3.eth.getBlock('latest');
        let number = block.number;
        console.log('Searching block ' + number);

        if (block != null && block.transactions != null) {
            for (let txHash of block.transactions) {
                let tx = await this.web3.eth.getTransaction(txHash);
                if (this.account == tx.to.toLowerCase()) {
                    console.log('Transaction found on block: ' + number);
                    console.log({address: tx.from, value: this.web3.utils.fromWei(tx.value, 'ether'), timestamp: new Date()});
                }
            }
        }
    }
}

function runCollectionChecker() {
    const address = "0x1b523dc90a79cf5ee5d095825e586e33780f7188";
    const address2= "0x85278e5fbfa1a7fb8780c0889a1637011c6aaca1"
    
    let collectionChecker = new CollectionChecker(process.env.INFURA_ID);
    collectionChecker.checkCollections(address);
    collectionChecker.checkCollections(address2);
}



// let txChecker = new TransactionChecker(process.env.INFURA_ID, '0xe1Dd30fecAb8a63105F2C035B084BfC6Ca5B1493');
// setInterval(() => {
//     txChecker.checkBlock();
// }, 15 * 1000);