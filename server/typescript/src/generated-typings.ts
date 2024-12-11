export type PolicyId = string;
export type AssetName = string;
export type StringDoaGddGA = string;
/**
 *
 * Generated! Represents an alias to any of the provided schemas
 *
 */
export type AnyOfPolicyIdPolicyIdAssetNameStringDoaGddGAStringDoaGddGA = PolicyId | AssetName | StringDoaGddGA;
export type GetByPolicyId = (policy_id: PolicyId) => Promise<StringDoaGddGA>;
export type GetByPolicyIdAndAssetName = (policy_id: PolicyId, asset_name: AssetName) => Promise<StringDoaGddGA>;