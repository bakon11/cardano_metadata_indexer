**Cardano Metadata Indexer**

This indexer requires an instance of Ogmios running with Cardano-node. 
Right now it's only setup to fetch metdata based on CIP-25 with label `721`, which is formated in JSON format not CBOR,
and stores them in a SQLite3 database.

It also includes a small JSON-RPC2.0 API with two methods to fetch assets, `get_by_policy_id` or `get_by_policy_id_and_asset_name`

**Why does this exist**

I find that for most DApp projects I don't need much more than kupo and ogmios. However using the two you don't have the easiest way to access NFT metadata based on CIP-25.
Needing another more complex solution like 

This indexer lets you parse and save all metadata from slot of your choosing, it will also pickup last saved slot in case it restarts or crashes.