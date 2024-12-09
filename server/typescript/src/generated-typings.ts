export type Network = string;
export type PolicyId = string;
export type AssetName = string;
export type StringDoaGddGA = string;
/**
 *
 * Generated! Represents an alias to any of the provided schemas
 *
 */
export type AnyOfNetworkPolicyIdNetworkPolicyIdAssetNameStringDoaGddGAStringDoaGddGA = Network | PolicyId | AssetName | StringDoaGddGA;
export type GetByPolicyId = (network: Network, policy_id: PolicyId) => Promise<StringDoaGddGA>;
export type GetByPolicyIdAndAssetName = (network: Network, policy_id: PolicyId, asset_name: AssetName) => Promise<StringDoaGddGA>;