import { GetByPolicyIdAndAssetName } from "../generated-typings";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
const indexerdb = "./src/indexer/indexer.db";

const get_by_policy_id_and_asset_name: GetByPolicyIdAndAssetName = (policy_id, asset_name) => {
  return Promise.resolve(
    get_by_policy_id_and_asset_name_db(policy_id, asset_name)
  );
};

const get_by_policy_id_and_asset_name_db = async (policy_id: string, asset_name:string) => {
  const db: any = await connectDB();
  try{
    const SQL = `SELECT * FROM metadata_${process.env.NETWORK} WHERE policy_id = ? AND asset_name = ?`;
    const rows = await db.all(SQL, [ policy_id, asset_name ]);
    await db.close();
    return rows;
  }catch(error){
    console.error("Error querying db", error);
    return("error");
  };
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

export default get_by_policy_id_and_asset_name;
