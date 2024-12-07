
![data](https://github.com/user-attachments/assets/b61693db-e44d-4e12-9a2d-b555ccc36525)
**Cardano Metadata Indexer**

This indexer requires an instance of Ogmios running with Cardano-node. 
Right now it's only setup to fetch metdata based on CIP-25 with label `721`, which is formated in JSON format not CBOR,
and stores them in a SQLite3 database.

It also includes a small JSON-RPC2.0 API with two methods to fetch assets, `get_by_policy_id` or `get_by_policy_id_and_asset_name`

**Why does this exist**

I find that for most DApp projects I don't need much more than kupo(https://github.com/cardanosolutions/kupo) and ogmios(https://github.com/cardanosolutions/ogmios/). However using the two you don't have the easiest way to access NFT metadata based on CIP-25.
Needing another more complex heavier solution.

This indexer lets you parse and save all metadata from slot of your choosing, it will also pickup last saved slot in case it restarts or crashes.

**How to use it**
Go into `server/typescript/` and create a `.env` file and fill it out:
```
OGMIOS_WS="ws://192.168.1.1:1337"
NETWORK="mainnet"
SLOT=518360
BLOCK_HASH="f9d8b6c77fedd60c3caf5de0ce63a0aeb9d1753269c9c07503d9aa09d5144481"
USECUSTOM="false"
SERVER_HTTP_PORT=4441
SERVER_WS_PORT=3331
```

And if you know a little bit of typescript you can also customize it a bit and specify which policy numbers to index.
Then run `npm start` from the `server/typescript` directory will start the indexer and the JSON-RPC server api..

**Whats Left**
Documentation for JSON-RPC API to pull data from DB.

**client**
The client folder is a installable api client for react.
