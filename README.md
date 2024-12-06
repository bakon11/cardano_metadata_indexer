**Cardano Metadata Indexer**

This indexer requires an instance of Ogmios running with Cardano-node. 
Right now it's only setup to fetch metdata based on CIP-25 with label `721`, which is formated in JSON format not CBOR,
and stores them in a SQLite3 database.

It also includes a small JSON-RPC2.0 API with two methods to fetch assets, `get_by_policy_id` or `get_by_policy_id_and_asset_name`

**Why does this exist**

I find that for most DApp projects I don't need much more than kupo and ogmios. However using the two you don't have the easiest way to access NFT metadata based on CIP-25.
Needing another more complex heavier solution.

This indexer lets you parse and save all metadata from slot of your choosing, it will also pickup last saved slot in case it restarts or crashes.

**How to use it**
On my todo list is to have a simple config file. 

For right now you can go into `server/typescript/src/indexer.ts` and you'll find the configs at the type.

Update `client` variable at top to your own Ogmios instance.
Specifying your own starting point using `slot` and `block hash`.

And if you know a little bit of typescript you can also customize it and specify which policy numbers to index, in the future this will be in a config file.

Then run `npm run indexer` from the `server/typescript` directory will start the indexer.

Then run `npm start` to start the JSON-RPC2.0 api server.(Note: read `Whats left` section).

**Whats Left**
config file for easier confiugring of the indexer.

**client**
The client folder is a installable api client for react.