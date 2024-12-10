import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pc from "picocolors"

const startTime = process.hrtime();

const indexerdb = "./src/indexer/indexer.db";
console.log("indexerdb: ", indexerdb);
const network = process.env.NETWORK;
console.log("network: ", network);

// Initialize database connection once
let db: any;

const initializeDB = async () => {
  try {
    db = await open({
      filename: indexerdb,
      driver: sqlite3.Database
    });
    db.configure('busyTimeout', 5000);
    db.exec('PRAGMA journal_mode = WAL');
    console.log("Database connection established.");
    return db;
  } catch (error) {
    console.error("DB error con:", error);
    process.exit(1); // Exit with an error code if DB connection fails at startup
  }
}
// Call initializeDB and setupDatabase before even opening WS connection
initializeDB().then(() => setupDatabase()).catch(error => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});

// WebSocket setup outside of indexer function
console.log("web socket: ", process.env.OGMIOS_WS);
const ws = new WebSocket(process.env.OGMIOS_WS as string);

// WebSocket event handlers
ws.on('open', async () => {
  console.log("Websocket connected to OGMIOS starting sync");
  try {
    await setupIntersection();
    wsprpc(ws, "nextBlock", {}, "nextBlock");
  } catch (error) {
    console.error("Error during WebSocket connection:", error);
  }
});

ws.on('message', async (msg: any) => {
  try {
    const response = JSON.parse(msg);

    if (response.id === "find-intersection") {
      if (response.error) { 
        throw new Error("Whoops? Last Byron block disappeared?");
      }
      wsprpc(ws, "nextBlock", {}, "nextBlock");
    }
    
    if (response.result.direction === "forward") {
      await saveMetadata(response.result.block, response);
      wsprpc(ws, "nextBlock", {}, response.id);
    }

    if (response.result.direction === "backward") {
      wsprpc(ws, "nextBlock", {}, response.id);
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

ws.on('close', () => {
  console.log("Connection closed");
});

ws.on('error', (error: any) => {
  console.log("Connection Error: ", error);
});

const wsprpc = (ws: any, method: string, params: object, id: string | number) => {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id
  }));
};

// Check for any last Slots/Blocks in DB and setup intersection
const setupIntersection = async () => {
  const intersectionPoints = await getLastIntersectPoints();
  console.log("Last Intersection Points: ", intersectionPoints);

  const defaultIntersectPointsMainnet = [{
    slot: 16588737,
    id: "4e9bbbb67e3ae262133d94c3da5bffce7b1127fc436e7433b87668dba34c354a"
  }];
  const defaultIntersectPointsPreprod = [{
    slot: 518360,
    id: "f9d8b6c77fedd60c3caf5de0ce63a0aeb9d1753269c9c07503d9aa09d5144481"
  }];
  const customIntersectPoints = [{
    slot: parseInt(process.env.SLOT as string, 10),
    id: process.env.BLOCK_HASH
  }];

  if (intersectionPoints.length > 0) {
    wsprpc(ws, "findIntersection", { points: process.env.USECUSTOM === "true" ? customIntersectPoints : intersectionPoints }, "find-intersection");
  } else {
    const points = process.env.USECUSTOM === "true" ? customIntersectPoints : 
                   (network === "mainnet" ? defaultIntersectPointsMainnet : defaultIntersectPointsPreprod);
    wsprpc(ws, "findIntersection", { points }, "find-intersection");
  }
};

type Block = {
  slot: number,
  id: string,
  era: string,
  transactions: Array<any>
};

const saveMetadata = async ( block: Block, response: any ) => {
  let NFTstats: string = "";
  if (block.transactions && block.transactions.length > 0) {
    await Promise.all(block.transactions.map(async (tx: any) => {
      if (tx.metadata && tx.metadata.labels && (tx.metadata.labels['721'] || tx.metadata.labels['20'])) {
        const labels = tx.metadata.labels;
        const savePromises = ['721', '20'].reduce((acc, type) => {
          if (labels[type] && labels[type].json) {
            const assets = labels[type];
            return Object.keys(assets.json).reduce((acc2, policyId) => {
              if (byteSize(policyId) === 56) {
                return Object.keys(assets.json[policyId]).reduce((acc3, assetName) => {
                  const assetInfo = assets.json[policyId][assetName];
                  /*
                    Label 721: ${pc.magentaBright(nftStats721)} | 
                    Label 20: ${pc.redBright(nftStats20)} | 
                  */
                  NFTstats = `Label: ${pc.redBright(type)} Policy Id: ${pc.magentaBright(policyId)}, Asset Name: ${pc.magentaBright(assetName)}`;
                  // Push the promise returned by dbSave, which matches Promise<void | string>
                  acc3.push(dbSave(block, type, policyId, assetName, JSON.stringify(assetInfo)));
                  return acc3;
                }, acc2);
              }
              return acc2;
            }, acc);
          }
          return acc;
        }, [] as Array<Promise<void | string>>);
        // Wait for all promises to resolve or reject
        Promise.all(savePromises).then(() => {
          displayStatus( response, NFTstats );
        }).catch(error => {
          console.error("An error occurred:", error);
          process.exit(1); // Exit with an error code
        });
      }
    }));
  };
  return null;
};
/* Commenting this out to test a more dynamic metadata detect and label */
/*if (tx.metadata && tx.metadata.labels && tx.metadata.labels['721']) {
  // console.log("parsing tx for metadata");
  // console.log(JSON.stringify(tx.metadata));
  if ( tx.metadata.labels['721'] && tx.metadata.labels['721'].json) {
    const nft = tx.metadata.labels;
    //  console.log('NFT: ', nft);
    Object.keys(nft['721'].json).map((policyId) => {
      // console.log('Policy Id: ', policyId);
      byteSize(policyId) == 56 && Object.keys(nft['721'].json[policyId]).map( async (assetName) => {
        const assetInfo = nft['721'].json[policyId][assetName];
        nftStats721 = `Policy Id: ${policyId}, Asset Name: ${assetName}`
        // console.log('Policy Id: ', policyId, 'assetName: ', assetName);
        // console.log('assetInfo: ', assetInfo);
        // Insert into database
        // await db.run(SQL, [block.slot, block.id, block.era, "721", policyId, assetName, JSON.stringify(assetInfo)]);
        await dbSave(block, "721", policyId, assetName, JSON.stringify(assetInfo));
      });
    });
  };
};
if (tx.metadata && tx.metadata.labels && tx.metadata.labels['20']) {
  // console.log("parsing tx for metadata");
  // console.log(JSON.stringify(tx.metadata));
  if ( tx.metadata.labels['20'] && tx.metadata.labels['20'].json) {
    const ft = tx.metadata.labels;
    //  console.log('FT: ', ft);
    Object.keys(ft['20'].json).map((policyId) => {
      // console.log('Policy Id: ', policyId);
      byteSize(policyId) == 56 && Object.keys(ft['20'].json[policyId]).map( async (assetName) => {
        const assetInfo = ft['20'].json[policyId][assetName];
        nftStats20 = `Policy Id: ${policyId}, Asset Name: ${assetName}`
        // console.log('Policy Id: ', policyId, 'assetName: ', assetName);
        // console.log('assetInfo: ', assetInfo);
        // Insert into database
        // await db.run(SQL, [block.slot, block.id, block.era, "20", policyId, assetName, JSON.stringify(assetInfo)]);
        await dbSave(block, "20", policyId, assetName, JSON.stringify(assetInfo));
      });
    });
  }
};
*/
const getLastIntersectPoints = async () => {
  const SQL = `SELECT slot, block_hash FROM metadata_${network} ORDER BY slot DESC LIMIT 100`;
  const rows = await db.all(SQL);
  let lastIntersectPoints: any = [];
  await rows.map((row: any) => {
    lastIntersectPoints.push({ slot: row.slot, id: row.block_hash });
  });
  return(lastIntersectPoints);
};

const displayStatus = async ( response: any, NFTstats: string ) => {
  const percentLeft = (response.result.tip.slot - response.result.block.slot) / response.result.tip.slot;
  const percentDone = 1 - percentLeft;
  const slotsLeft = response.result.tip.slot - response.result.block.slot;
  //console.clear();
  console.log(
    `Slot: ${pc.greenBright(response.result.block.slot)} of ${pc.greenBright(response.result.tip.slot)} |
     Sync progress: ${pc.yellowBright(Math.round(percentDone * 100))}${pc.yellowBright("% done")} | 
     Slots left: ${pc.blueBright(slotsLeft)} |
     ${NFTstats} |
     ${displayTime()}`
  );
};

const elapsed = process.hrtime(startTime);
const getElapsedTime = () => {
  const seconds = elapsed[0];
  const milliseconds = Math.floor(elapsed[1] / 1e6); // Convert nanoseconds to milliseconds
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const displayTime = () => {
  const elapsedTime = getElapsedTime();
  return(`Elapsed: ${elapsedTime}`);
};

/*DB FUNCTIONS */
const setupDatabase = async () => {
  await createTable();
  process.env.INDEX_DB === "true" && indexTable(); // Assuming this is defined elsewhere
};

const dbSave = async (block: Block, label: string, policyId: string, assetName: string, metadata: string): Promise<void | string> => {
  try {
    const SQL = `INSERT INTO metadata_${network} (slot, block_hash, era, label, policy_id, asset_name, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await Promise.resolve(
      db.run(SQL, [block.slot, block.id, block.era, label, policyId, assetName, metadata])
    );
    return(void 0);
  }catch(error){
    console.error('DB error save:', error);
    process.exit(1); // Exit with an error code
  }; 
};

const createTable = async () => {
  const SQL = `CREATE TABLE IF NOT EXISTS metadata_${network} ( id INTEGER PRIMARY KEY AUTOINCREMENT, slot INTEGER, block_hash VARCHAR, era VARCHAR, label VARCHAR, policy_id VARCHAR, asset_name VARCHAR, metadata TEXT )`;
  await db.run(SQL);
  return null;
};

const indexTable = async () => {
  const SQL = `CREATE INDEX idx_policy_id ON metadata_${network}(policy_id);`;
  const SQL2 = `CREATE INDEX idx_asset_name ON metadata_${network}(asset_name);`;
  const SQL3 = `CREATE INDEX idx_policy_asset ON metadata_${network}(policy_id, asset_name);`;
  try {
    await db.exec('BEGIN TRANSACTION;');
    await db.run(SQL);
    await db.run(SQL2);
    await db.run(SQL3);
    await db.exec('COMMIT;');
  } catch (error) {
    await db.exec('ROLLBACK;');
    console.error('Error creating indexes:', error);
  };
};

// When your script is about to exit
process.on('exit', () => {
  if (db) {
    db.close().then(() => {
      console.log('Database connection closed gracefully.');
    }).catch((err: any) => {
      console.error('Error closing database:', err);
    });
  }
});

// Or if you have a specific error that should lead to program termination:
process.on('uncaughtException', (err) => {
  console.error('Caught exception:', err);
  if (db) {
    db.close().then(() => {
      console.log('Database closed before program exit due to error.');
      process.exit(1);
    }).catch((closeError: any) => {
      console.error('Failed to close database:', closeError);
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
const byteSize = (str: string) => new Blob([str]).size;