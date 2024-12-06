import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const indexerdb = "./src/indexer/indexer.db";
// console.log("indexerdb: ", indexerdb);

console.log("web socket: ", process.env.OGMIOS_WS);
const ws = new WebSocket( process.env.OGMIOS_WS as string, {
  perMessageDeflate: false
});

const network = process.env.NETWORK;
console.log("network: ", network);

export const runIndexer = async () => {

  console.log("ws: ", ws);
  console.log("Checking for tables");
  await createTable();
  const intersectionPoints = await getLastIntersectPoints();
  
  //Last Shelley block mainnet
  const defaultIntersectPointsMainnet = [{
    slot: 16588737,
    id: "4e9bbbb67e3ae262133d94c3da5bffce7b1127fc436e7433b87668dba34c354a"
  }];
  // Last Shelley blockPreprod
  const defaultIntersectPointsPreprod = [{
    slot: 518360,
    id: "f9d8b6c77fedd60c3caf5de0ce63a0aeb9d1753269c9c07503d9aa09d5144481"
  }];
  const customIntersectPoints = [{
    slot: parseInt(process.env.SLOT as string, 10),
    id: process.env.BLOCK_HASH
  }];
  console.log("Last Intersection Points: ", intersectionPoints);
  console.log("use custom: ",  process.env.USECUSTOM);

  ws.on('open', () => {
    console.log("Websocket connected to OGMIOS");
  });

  ws.once('open', () => {
    console.log("Websocket connected to OGMIOS starting sync");
    intersectionPoints.length > 0 && wsprpc("findIntersection", { points: process.env.USECUSTOM === "true" ? customIntersectPoints : intersectionPoints }, "find-intersection");
    intersectionPoints.length === 0 && wsprpc("findIntersection", { points: process.env.USECUSTOM === "true" ? customIntersectPoints : network === "mainnet" ? defaultIntersectPointsMainnet : defaultIntersectPointsPreprod }, "find-intersection");
  });

  ws.on('close', () => {
    console.log("Connection closed");
  });

  ws.on('error', (error) => {
    console.log("Connection Error: ", error);
  });

  ws.on('message', async ( msg: any ) => {
    const response = JSON.parse(msg);
    // console.log("response on message:", response);

    if (response.id === "find-intersection") {
        if (response.error) { throw "Whoops? Last Byron block disappeared?" };
        wsprpc("nextBlock", {}, "nextBlock");
    };
    
    if (response.result.direction === "forward") {
      console.log("Processing slot: ", response.result.block.slot + " of " + response.result.tip.slot);
      await saveMetadata(response.result.block);
      wsprpc("nextBlock", {}, response.id);
    };

    if (response.result.direction === "backward") {
      // console.log(response.result.block);
      wsprpc("nextBlock", {}, response.id);
    };
  });


};

const wsprpc = (method: string, params:object, id: string | number ) => {
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id
  }));
}

type Block = {
  slot: number,
  id: string,
  era: string,
  transactions: Array<any>
};
const saveMetadata = async (block: Block) => {
  const db: any = await connectDB();
  const SQL = `INSERT INTO metadata_${network} ( slot, block_hash, era, policy_id, asset_name, metadata ) VALUES ( ?, ?, ?, ?, ?, ? )`;
  if (block.transactions && block.transactions.length > 0) {
    await Promise.all(block.transactions.map(async (tx: any) => {
      if (tx.metadata && tx.metadata.labels && tx.metadata.labels['721']) {
        console.log("parsing tx for metadata");
        // console.log(JSON.stringify(tx.metadata));
        if ( tx.metadata.labels['721'] &&  tx.metadata.labels['721'].json) {
          const nft = tx.metadata.labels;
          console.log('NFT: ', nft);
          Object.keys(nft['721'].json).map((policyId) => {
            console.log('Policy Id: ', policyId);
            Object.keys(nft['721'].json[policyId]).map((assetName) => {
              const assetInfo = nft['721'].json[policyId][assetName];
              console.log('assetName: ', assetName);
              console.log('assetInfo: ', assetInfo);
              // Insert into database
              db.run(SQL, [block.slot, block.id, block.era, policyId, assetName, JSON.stringify(assetInfo)]);
            });
          });
        }
      }
    }));
  }
  await db.close();
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

const createTable = async () => {
  const db: any = await connectDB();
  const SQL = `CREATE TABLE IF NOT EXISTS metadata_${network} ( id INTEGER PRIMARY KEY AUTOINCREMENT, slot INTEGER, block_hash TEXT, era TEXT, policy_id TEXT, asset_name TEXT, metadata TEXT )`;
  await db.run(SQL);
  await db.close();
};

const connectDB = async () => {
  try{
    const db = await open({
      filename: indexerdb,
      driver: sqlite3.Database
    });
    return db;
  }catch(error){
    console.error("Error connecting to db", error);
    return;
  };
};

// runIndexer();