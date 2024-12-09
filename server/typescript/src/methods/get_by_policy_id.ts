import { GetByPolicyId } from "../generated-typings";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
const indexerdb = "./src/indexer/indexer.db";

const get_by_policy_id: GetByPolicyId = (policy_id) => {
  console.log("fetching policy_id: ", policy_id);
  return Promise.resolve(
    get_by_policy_id_db(policy_id)
  );
};

const get_by_policy_id_db = async (policy_id: string) => {
  const db: any = await connectDB();
  const SQL = "SELECT * FROM metadata WHERE policy_id = ?";
  const rows = await db.all(SQL, [policy_id]);
  await db.close();
  return rows;
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

export default get_by_policy_id;
