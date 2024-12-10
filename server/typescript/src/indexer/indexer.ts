import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pc from "picocolors"

const indexerdb = "./src/indexer/indexer.db";
console.log("indexerdb: ", indexerdb);
const network = process.env.NETWORK;
console.log("network: ", network);

// WebSocket setup outside of indexer function
console.log("web socket: ", process.env.OGMIOS_WS);
const ws = new WebSocket(process.env.OGMIOS_WS as string);

let intersectionPoints: any[] = [];

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

const setupIntersection = async () => {
  await createTable();
  intersectionPoints = await getLastIntersectPoints();
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

const wsprpc = (ws: any, method: string, params: object, id: string | number) => {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id
  }));
};

type Block = {
  slot: number,
  id: string,
  era: string,
  transactions: Array<any>
};
const saveMetadata = async ( block: Block, response: any ) => {
  const db: any = await connectDB();
  const SQL = `INSERT INTO metadata_${network} ( slot, block_hash, era, label, policy_id, asset_name, metadata ) VALUES ( ?, ?, ?, ?, ?, ?, ? )`;
  let nftStats721: any;
  let nftStats20: any;
  if (block.transactions && block.transactions.length > 0) {
    await Promise.all(block.transactions.map(async (tx: any) => {
      if (tx.metadata && tx.metadata.labels && tx.metadata.labels['721']) {
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
    }));
  };
  displayStatus( response, nftStats721, nftStats20 );
  await db.close();
  return null;
};

const getLastIntersectPoints = async () => {
  const db: any = await connectDB();
  const SQL = `SELECT slot, block_hash FROM metadata_${network} ORDER BY slot DESC LIMIT 100`;
  const rows = await db.all(SQL);
  await db.close();

  let lastIntersectPoints: any = [];
  await rows.map((row: any) => {
    lastIntersectPoints.push({ slot: row.slot, id: row.block_hash });
  });
  return(lastIntersectPoints);
};

const displayStatus = async ( response: any,  nftStats721: any, nftStats20: any ) => {
  const percentLeft = (response.result.tip.slot - response.result.block.slot) / response.result.tip.slot;
  const percentDone = 1 - percentLeft;
  const slotsLeft = response.result.tip.slot - response.result.block.slot;
  //console.clear();
  console.log(
    `Slot: ${pc.greenBright(response.result.block.slot)} of ${pc.greenBright(response.result.tip.slot)} |
     Sync progress: ${pc.yellowBright(Math.round(percentDone * 100))}${pc.yellowBright("% done")} | 
     Slots left: ${pc.blueBright(slotsLeft)} | 
     Label 721: ${pc.magentaBright(nftStats721)} | 
     Label 20: ${pc.redBright(nftStats20)} | 
     ${displayTime()}`
  );
};

const getElapsedTime = () => {
  const startTime = process.hrtime();
  const elapsed = process.hrtime(startTime);
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
const connectDB = async () => {
  try{
    const db = await open({
      filename: indexerdb,
      driver: sqlite3.Database
    });
    db.configure('busyTimeout', 5000);
    db.exec('PRAGMA journal_mode = WAL');
    return db;
  }catch(error){
    console.error("DB error con:", error);
    process.exit(1); // Exit with an error code
  };
};

const dbSave = async (block: Block, label: string, policyId: string, assetName: string, metadata: string): Promise<void | string> => {
  try {
    const db: any = await connectDB();
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
  const db: any = await connectDB();
  const SQL = `CREATE TABLE IF NOT EXISTS metadata_${network} ( id INTEGER PRIMARY KEY AUTOINCREMENT, slot INTEGER, block_hash VARCHAR, era VARCHAR, label VARCHAR, policy_id VARCHAR, asset_name VARCHAR, metadata TEXT )`;
  await db.run(SQL);
  await db.close();
  return null;
};

const indexTable = async () => {
  const db = await connectDB();
  const SQL = `CREATE INDEX idx_policy_id ON metadata_mainnet(policy_id);`;
  const SQL2 = `CREATE INDEX idx_asset_name ON metadata_mainnet(asset_name);`;
  const SQL3 = `CREATE INDEX idx_policy_asset ON metadata_mainnet(policy_id, asset_name);`;
  try {
    await db.exec('BEGIN TRANSACTION;');
    await db.run(SQL);
    await db.run(SQL2);
    await db.run(SQL3);
    await db.exec('COMMIT;');
    await db.close();
  } catch (error) {
    await db.exec('ROLLBACK;');
    console.error('Error creating indexes:', error);
    if (db) {
      await db.close();
    }
  }
};
process.env.INDEX_DB === "true" && indexTable();
const byteSize = (str: string) => new Blob([str]).size;