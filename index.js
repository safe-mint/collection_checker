const Web3 = require('web3');
const EthEns = require('web3-eth-ens')
const Airtable = require('airtable');
require('dotenv').config();
const { AIRTABLE_API_KEY, AIRTABLE_BASE } = process.env; 
const COLLECTIONS_TABLE_NAME = "Collections"
const APPLICANTS_TABLE_NAME = "Applicants w ens copy"

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE);
const ens = new EthEns(Web3.eth);

// using Promises with Airtable https://github.com/11ty/eleventy/issues/1122
// maybe try Async Airtable https://asyncairtable.com/
async function getAllCollections(base) {
    return new Promise((resolve, reject) => {
        const collections = []
        base(COLLECTIONS_TABLE_NAME).select({
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
            console.log("getAllCollections done!")
            if (err) {
                reject(err);
            } else {
                resolve(collections);
            }
        });
    })
}


async function getAllApplicantsFirstPage(base) {
    const applicants = []
    return new Promise((resolve, reject) => {
        base(APPLICANTS_TABLE_NAME).select({
            view: 'Grid view',
            filterByFormula: "{NFTs Owned} = ''"
        }).firstPage(function(err, records) {
            if (err) { console.error(err); reject(err); }
            records.forEach(function(record) {
                applicants.push(record)
            });
            resolve(applicants)
        });
    })
}

async function getAllApplicants(base) {
    return new Promise((resolve, reject) => {
        const applicants = []
        base(APPLICANTS_TABLE_NAME).select({
            view: "Grid view",
            filterByFormula: "{NFTs Owned} = ''"
        }).eachPage((records, fetchNextPage) => {
            records.forEach((record) => {
                applicants.push(record);
            });
            fetchNextPage();
        }, function done(err) {
            if (err) {
                console.log('error!')
                console.error(err);
                reject(err);
            } else {
                resolve(applicants);
            }
        })
    })
}

async function updateApplicant(applicant, collections, balances, errorMessage) {
    var nftsOwned = []
    var hasBalance = false;
    let numberNftsOwned = 0;
    let numberCollectionsOwned = 0;
    // balances.map((x, i) => {
    //     if (x > 0) {
    //         hasBalance = true;
    //         nftsOwned.push(collections[i].get("Name"))
    //     }
    // })
    Object.entries(balances).forEach(([key, value]) => {
      console.log("value = " + value + " " + parseInt(value))
      numberNftsOwned += parseInt(value)
      if (value > 0) {
        numberCollectionsOwned += 1
        hasBalance = true
        nftsOwned.push(key)
      }
    });

    nftsOwnedStr = nftsOwned.join(", ")
    console.log("nftsOwned: " + nftsOwnedStr)
    if (nftsOwnedStr.trim().length == 0) {
        nftsOwnedStr = "[none]"
    }
    if (errorMessage) {
        nftsOwnedStr = "[error]"
    }
    console.log("num NFTs owned")
    console.log(numberNftsOwned)
    base(APPLICANTS_TABLE_NAME).update([
        {
          "id": applicant.id,
          "fields": {
            "NFTs Owned": nftsOwnedStr,
            "Ownership Checked Last": Date.now(), 
            "Error Message": errorMessage,
            "Number NFTs Owned": numberNftsOwned,
            "Number Collections Owned": numberCollectionsOwned
          }
        }], function(err, records) {
            if (err) {
              console.error(err);
              return;
            }

        }
    );
}



async function processDBs(values, base) {
    console.log("processDBs")
    const collections = values[0];
    const applicants = values[1];
    for(var i=0; i<collections.length; i++) {
        console.log("collectionName: " + collections[i].get("Name"))
    }
    for(var i=0; i<applicants.length; i++) {
        console.log("applicant id: " + applicants[i].id);
    }

    let collectionChecker = new CollectionChecker(process.env.INFURA_ID, collections);
    for(const applicant of applicants) {
        let address = applicant.get("Wallet");
        let errorMessage = null;
        let balances = {}

        if (address) { 
          try {
            console.log("applicant address: " + address)
            balances = await collectionChecker.checkCollections(address);
            console.log("balances: " + balances)
          } catch(error) {
            errorMessage = error.toString()
            console.log(error)
          }
        } else {
          errorMessage = "Wallet address provided is empty" 
        }


        updateApplicant(applicant, collections, balances, errorMessage);

    }
}



class CollectionChecker {
  web3;
  collections;

  constructor(projectId, collections) {
      this.web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + projectId));
      this.collections = collections;
  }

  async checkCollections(address) {
    const balances = {}
    address = address.toLowerCase().trim();
    for (const collection of this.collections) {
      if (collection.get("Name") === "10KTF" ||
        collection.get("Name") == "Adidas Originals" ||
        collection.get("Name") == "Curio Cards" ||
        collection.get("Name") == "Gutter Cat Gang" || 
        collection.get("Name") == "Psychedelics Anonymous" ||
        collection.get("Name") == "SupDucks") { continue }

      const abi = JSON.parse(collection.get("ABI"));
      const contract = new this.web3.eth.Contract(abi, collection.get("Contract")); // (abi, contract_address)

      contract.defaultAccount = address
      const balance = await contract.methods.balanceOf(address).call()
      balances[collection.get("Name")] = balance
    }
    return balances;
  }
}



const collectionsDB = getAllCollections(base);
const applicantsDB = getAllApplicants(base);
Promise.all([collectionsDB, applicantsDB]).then(values => {
    console.log("done with promises")
    processDBs(values);
})

setInterval(() => {}, 1 << 30);


// ------------------------

// class TransactionChecker {
//     web3;
//     account;

//     constructor(projectId, account) {
//         this.web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + projectId));
//         this.account = account.toLowerCase();
//     }

//     async checkBlock() {
//         let block = await this.web3.eth.getBlock('latest');
//         let number = block.number;
//         console.log('Searching block ' + number);

//         if (block != null && block.transactions != null) {
//             for (let txHash of block.transactions) {
//                 let tx = await this.web3.eth.getTransaction(txHash);
//                 if (this.account == tx.to.toLowerCase()) {
//                     console.log('Transaction found on block: ' + number);
//                     console.log({address: tx.from, value: this.web3.utils.fromWei(tx.value, 'ether'), timestamp: new Date()});
//                 }
//             }
//         }
//     }
// }

// function runCollectionChecker() {
//     const address = "0x1b523dc90a79cf5ee5d095825e586e33780f7188";
//     const address2= "0x85278e5fbfa1a7fb8780c0889a1637011c6aaca1"
    
//     let collectionChecker = new CollectionChecker(process.env.INFURA_ID);
//     collectionChecker.checkCollections(address);
//     collectionChecker.checkCollections(address2);
// }



// let txChecker = new TransactionChecker(process.env.INFURA_ID, '0xe1Dd30fecAb8a63105F2C035B084BfC6Ca5B1493');
// setInterval(() => {
//     txChecker.checkBlock();
// }, 15 * 1000);