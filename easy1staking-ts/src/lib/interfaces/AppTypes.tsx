
export enum EASY1DelegationType {
    Unregistered = 0,
    Undelegated = 1,
    DelegatedOther = 2,
    Delegated = 3,
    ConnectWallet = 4,
    UnsupportedWallet = 5
}

export enum DistributionType {
    FixedAmount = 0,
    MultiplyPerAdaStaked = 1,
    SplitByStakeAmount = 2,
    SplitByCount = 3,
}

export interface Distribution {
    amount: number;
    decimales: number;
    description: string;
    distribution_model: DistributionType;
    min_stake_required: number;
    symbol: string;
    title: string;
    token_image_url: string
}

// WMT Conversion

export interface WmtConversion {
    tx_hash: string;
    tx_time: string;
    amount_wmt_converted: number;
}

export interface WmtConversionStats {
    num_conversions_total: number;
    amount_wmt_converted_total: number
}

// Stake Pool Details
export interface StakePoolAssessment {
    current_pool: StakePoolDetails | undefined;
    easy1_stake_pool: StakePoolDetails
}

export interface StakePoolDetails {
    ticker: string;
    fixed_fee: number;
    variable: number;
    declared_pledge: number;
    live_stake: number;
    saturation: number;
    retired: boolean;
    retiring: boolean;
}
